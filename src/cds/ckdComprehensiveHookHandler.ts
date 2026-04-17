/*
 * 更新時間：2026-04-16 16:41
 * 作者：CDS Service
 * 摘要：補強 handleCkdComprehensiveHook 可讀性註解（prefetch 合併、hybrid 取數、USE_ELM 分支與 fallback）
 *
 * 更新時間：2026-04-16 14:12
 * 作者：CDS Service
 * 摘要：對齊 tri-state：HighRiskProfile/ComprehensiveRiskScore 遇到 null 不當成 false；AnnualUACROverdue 在 HighRiskProfile=null 時回傳 null
 *
 * 更新時間：2026-04-16 14:09
 * 作者：CDS Service
 * 摘要：新增 POST /cds-services/ckd-comprehensive（hybrid：prefetch 優先；缺少則向 FHIR 取 Patient/Condition/Observation 補齊；USE_ELM 支援 CKD_Comprehensive ELM）
 */
import { evaluateCkdRiskWithElm, type CkdRiskElmResult, type CkdRiskPrefetchInput } from '../cql/ckdRiskElmExecutor.js';
import { evaluateCkdComprehensiveWithElm, type CkdComprehensiveElmResult } from '../cql/ckdComprehensiveElmExecutor.js';
import { getPatient, searchActiveConditions, searchObservationsForCkdRisk } from '../fhir/fhirClient.js';
import type { CdsHooksRequest, CdsHooksResponse } from './ckdHookHandler.js';
import { evaluateCkdRiskWithTs } from './ckdHookHandler.js';
import { buildCkdComprehensiveCards } from './ckdComprehensiveCardBuilder.js';
import { extractBundleResources, stripPatientPrefix, getUseElm, formatError } from './utils.js';

function buildComprehensiveTs(risk: CkdRiskElmResult): CkdComprehensiveElmResult {
  const highRisk =
    (risk.HasDiabetes === true) || (risk.HasHypertension === true) || (risk.AgeOver60 === true)
      ? true
      : (risk.HasDiabetes === null) || (risk.HasHypertension === null) || (risk.AgeOver60 === null)
        ? null
        : false;

  const annualUacrOverdue =
    highRisk === null ? null : (highRisk === true && risk.MissinguACR);

  const immediateReferral =
    risk.MostRecentEgfrValue != null ? risk.MostRecentEgfrValue < 30 : null;

  const criticalTestingGap = risk.MissingeGFR && risk.MissinguACR;

  const score =
    risk.HasDiabetes === null ||
    risk.HasHypertension === null ||
    risk.HasHeartDisease === null ||
    risk.HasObesity === null ||
    risk.AgeOver60 === null
      ? null
      : (risk.HasDiabetes === true ? 1 : 0) +
        (risk.HasHypertension === true ? 1 : 0) +
        (risk.HasHeartDisease === true ? 1 : 0) +
        (risk.HasObesity === true ? 1 : 0) +
        (risk.AgeOver60 === true ? 1 : 0);

  return {
    HighRiskProfile: highRisk,
    AnnualUACROverdue: annualUacrOverdue,
    ImmediateReferralNeeded: immediateReferral,
    CriticalTestingGap: criticalTestingGap,
    ComprehensiveRiskScore: score,
  };
}

export async function handleCkdComprehensiveHook(body: CdsHooksRequest): Promise<CdsHooksResponse> {
  // 1) 取得 patientId（CDS Hooks context 可能是 "Patient/{id}" 或 "{id}"）
  const patientIdRaw = body?.context?.patientId ? String(body.context.patientId) : '';
  const patientId = patientIdRaw ? stripPatientPrefix(patientIdRaw) : '';
  if (!patientId) {
    throw new Error('Missing context.patientId');
  }

  // 2) Prefetch（hybrid 模式：prefetch 優先；缺少才向 FHIR 補齊）
  const prefetch = (body?.prefetch ?? {}) as Record<string, unknown>;
  const prefetchPatient = extractBundleResources(prefetch.patient, 'Patient')[0] ?? null;
  const prefetchConditions = extractBundleResources(prefetch.conditions, 'Condition');
  const prefetchObservations = extractBundleResources(prefetch.observations, 'Observation');
  const prefetchLatestEgfr = extractBundleResources(prefetch.latestEgfr, 'Observation');

  // 3) 前端為了 debug 會額外 prefetched `latestEgfr`（Observation）
  //    後端仍以 `observations` 為主，但若提供 `latestEgfr`，這裡做去重後合併進去，避免漏掉最新值。
  const observationsMerged = [...prefetchObservations];
  for (const o of prefetchLatestEgfr) {
    const id = typeof (o as any)?.id === 'string' ? (o as any).id : undefined;
    const exists = id
      ? observationsMerged.some((x) => typeof (x as any)?.id === 'string' && (x as any).id === id)
      : false;
    if (!exists) observationsMerged.push(o);
  }

  // 4) hybrid 取數：prefetch 有就用，沒有才打 FHIR
  const patient = prefetchPatient ?? (await getPatient(patientId));
  const conditions =
    prefetchConditions.length ? prefetchConditions : await searchActiveConditions(patientId);
  const observations =
    observationsMerged.length ? observationsMerged : await searchObservationsForCkdRisk(patientId);

  // 5) ckd-comprehensive 本身不依賴家族史/AKI；
  //    但 CKD_Risk 的 defines 有 tri-state（資料不足 -> null）的語意，因此這裡明確傳入空陣列，
  //    讓 executor/TS fallback 以「未提供」處理（對應 define = null）。
  const familyHistories: Array<Record<string, unknown>> = [];
  const input: CkdRiskPrefetchInput = { patient, conditions, observations, familyHistories };

  // 6) 決定用哪個引擎：USE_ELM=true 走 ELM（失敗則 TS_FALLBACK），否則純 TS
  const useElm = getUseElm();

  let engine: 'ELM' | 'TS' | 'TS_FALLBACK' = 'TS';
  let riskResult: CkdRiskElmResult;
  let comprehensiveResult: CkdComprehensiveElmResult;

  if (useElm) {
    try {
      // 先跑 CKD_Risk（提供 most-recent values + missing），再跑 CKD_Comprehensive（CPG define）
      riskResult = await evaluateCkdRiskWithElm(input);
      comprehensiveResult = await evaluateCkdComprehensiveWithElm(input);
      engine = 'ELM';
    } catch (err) {
      // ELM 執行失敗時仍回卡片：降級到 TS，並在卡片 extension 標記 TS_FALLBACK（便於 QA）
      console.error('[ckd-comprehensive] ELM execution failed, falling back to TS:', formatError(err));
      riskResult = evaluateCkdRiskWithTs(input);
      comprehensiveResult = buildComprehensiveTs(riskResult);
      engine = 'TS_FALLBACK';
    }
  } else {
    // 未啟用 ELM：用 TS 對齊層（可在未部署/未重編譯 ELM 時使用）
    riskResult = evaluateCkdRiskWithTs(input);
    comprehensiveResult = buildComprehensiveTs(riskResult);
    engine = 'TS';
  }

  // 7) 將 Risk + Comprehensive 的結果轉成 cards（由 card builder 統一處理卡片優先序與 extension）
  const cards = buildCkdComprehensiveCards({
    engine,
    risk: riskResult,
    comprehensive: comprehensiveResult,
  });

  return { cards };
}

