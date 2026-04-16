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
import { buildCkdComprehensiveCards } from './ckdComprehensiveCardBuilder.js';

function extractBundleResources(
  prefetchValue: unknown,
  expectedType?: string,
): Array<Record<string, unknown>> {
  if (!prefetchValue || typeof prefetchValue !== 'object') return [];
  const obj = prefetchValue as Record<string, unknown>;
  if (obj.resourceType === 'Bundle') {
    const entry = (obj.entry as Array<{ resource?: Record<string, unknown> }> | undefined) ?? [];
    const resources = entry.map((e) => e.resource).filter(Boolean) as Array<Record<string, unknown>>;
    if (!expectedType) return resources;
    return resources.filter((r) => r.resourceType === expectedType);
  }
  if (obj.resourceType) {
    if (!expectedType || obj.resourceType === expectedType) return [obj as Record<string, unknown>];
    return [];
  }
  return [];
}

function stripPatientPrefix(id: string): string {
  if (id.startsWith('Patient/')) return id.slice('Patient/'.length);
  return id;
}

function toNumber(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

function hasObsWithLoinc(observations: Array<Record<string, unknown>>, loincCodes: string[]): boolean {
  return observations.some((o) => {
    const coding = (o.code as any)?.coding;
    if (!Array.isArray(coding)) return false;
    return coding.some((c: any) => c?.system === 'http://loinc.org' && loincCodes.includes(c?.code));
  });
}

function getMostRecentIssuedDate(observation: Record<string, unknown>): string | null {
  const issued = (observation as any)?.issued;
  return typeof issued === 'string' ? issued : null;
}

function buildRiskTs(input: CkdRiskPrefetchInput): CkdRiskElmResult {
  const { patient, conditions, observations } = input;

  const birthDate = (patient as any)?.birthDate;
  const ageOver60 =
    typeof birthDate === 'string'
      ? (() => {
          const d = new Date(birthDate);
          if (Number.isNaN(d.getTime())) return null;
          const now = new Date();
          let age = now.getFullYear() - d.getFullYear();
          const m = now.getMonth() - d.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
          return age > 60;
        })()
      : null;

  const condHasCodingFrom = (systems: string[]) =>
    conditions.some(
      (c) =>
        Array.isArray((c.code as any)?.coding) &&
        (c.code as any).coding.some((cd: any) => systems.includes(cd?.system)),
    );

  const condMatch = (pred: (cd: any) => boolean) =>
    conditions.some(
      (c) =>
        Array.isArray((c.code as any)?.coding) &&
        (c.code as any).coding.some((cd: any) => pred(cd)),
    );

  const icdOrSnomed = ['http://hl7.org/fhir/sid/icd-10-cm', 'http://snomed.info/sct'];

  const hasAnyDxCoding = condHasCodingFrom(icdOrSnomed);
  const hasDiabetes = !hasAnyDxCoding
    ? null
    : condMatch(
        (cd) =>
          (cd?.system === 'http://hl7.org/fhir/sid/icd-10-cm' &&
            typeof cd?.code === 'string' &&
            (cd.code.startsWith('E10') || cd.code.startsWith('E11'))) ||
          (cd?.system === 'http://snomed.info/sct' &&
            typeof cd?.code === 'string' &&
            (cd.code === '44054006' || cd.code === '73211009')),
      );

  const hasHypertension = !hasAnyDxCoding
    ? null
    : condMatch(
        (cd) =>
          (cd?.system === 'http://hl7.org/fhir/sid/icd-10-cm' &&
            typeof cd?.code === 'string' &&
            cd.code.startsWith('I10')) ||
          (cd?.system === 'http://snomed.info/sct' &&
            typeof cd?.code === 'string' &&
            cd.code === '38341003'),
      );

  const hasHeartDisease = !hasAnyDxCoding
    ? null
    : condMatch(
        (cd) =>
          (cd?.system === 'http://hl7.org/fhir/sid/icd-10-cm' &&
            typeof cd?.code === 'string' &&
            (cd.code.startsWith('I25') || cd.code.startsWith('I50'))) ||
          (cd?.system === 'http://snomed.info/sct' &&
            typeof cd?.code === 'string' &&
            (cd.code === '53741008' || cd.code === '84114007')),
      );

  // BMI ≥ 30 優先；無 BMI 時再看 ICD-10 E66
  const bmiObs = observations
    .filter((o) => hasObsWithLoinc([o], ['39156-5']))
    .slice()
    .sort((a, b) => (getMostRecentIssuedDate(a) ?? '').localeCompare(getMostRecentIssuedDate(b) ?? ''))
    .pop();
  const bmiValue =
    bmiObs && typeof (bmiObs as any)?.valueQuantity?.value === 'number'
      ? (bmiObs as any).valueQuantity.value
      : null;

  const hasObesity =
    bmiValue != null
      ? bmiValue >= 30
      : !conditions.some(
            (c) =>
              Array.isArray((c.code as any)?.coding) &&
              (c.code as any).coding.some((cd: any) => cd?.system === 'http://hl7.org/fhir/sid/icd-10-cm'),
          )
        ? null
        : condMatch(
            (cd) =>
              cd?.system === 'http://hl7.org/fhir/sid/icd-10-cm' &&
              typeof cd?.code === 'string' &&
              cd.code.startsWith('E66'),
          );

  const egfrCodes = ['62238-1', '33914-3'];
  const uacrCodes = ['9318-7', '32294-1'];

  const mostRecentByCodes = (codes: string[]) =>
    observations
      .filter((o) => hasObsWithLoinc([o], codes))
      .slice()
      .sort((a, b) => (getMostRecentIssuedDate(a) ?? '').localeCompare(getMostRecentIssuedDate(b) ?? ''))
      .pop();

  const egfrObs = mostRecentByCodes(egfrCodes);
  const egfrValue = toNumber((egfrObs as any)?.valueQuantity?.value);
  const egfrUnit = typeof (egfrObs as any)?.valueQuantity?.unit === 'string' ? (egfrObs as any).valueQuantity.unit : null;

  const uacrObs = mostRecentByCodes(uacrCodes);
  const uacrValue = toNumber((uacrObs as any)?.valueQuantity?.value);
  const uacrUnit = typeof (uacrObs as any)?.valueQuantity?.unit === 'string' ? (uacrObs as any).valueQuantity.unit : null;

  const missEgfr = egfrObs == null;
  const missUacr = uacrObs == null;

  return {
    AgeOver60: ageOver60,
    HasDiabetes: hasDiabetes,
    HasHypertension: hasHypertension,
    HasHeartDisease: hasHeartDisease,
    HasObesity: hasObesity,
    HasAkiHistory: null,
    HasFamilyHistoryOfCKD: null,
    FamilyHistoryOrAKI: null,

    MostRecentEgfrValue: egfrValue,
    MostRecentEgfrUnit: egfrUnit,
    MostRecentUacrValue: uacrValue,
    MostRecentUacrUnit: uacrUnit,

    MissingeGFR: missEgfr,
    MissinguACR: missUacr,
    MissingeGFRRecommendation: missEgfr ? 'eGFR not recorded in past 12 months — order eGFR (blood test)' : null,
    MissinguACRRecommendation: missUacr ? 'uACR not recorded in past 12 months — order uACR (urine test)' : null,
  };
}

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
  const useElm = String(process.env.USE_ELM ?? 'false').toLowerCase() === 'true';

  let engine: 'ELM' | 'TS' | 'TS_FALLBACK' = 'TS';
  let riskResult: CkdRiskElmResult;
  let comprehensiveResult: CkdComprehensiveElmResult;

  if (useElm) {
    try {
      // 先跑 CKD_Risk（提供 most-recent values + missing），再跑 CKD_Comprehensive（CPG define）
      riskResult = await evaluateCkdRiskWithElm(input);
      comprehensiveResult = await evaluateCkdComprehensiveWithElm(input);
      engine = 'ELM';
    } catch {
      // ELM 執行失敗時仍回卡片：降級到 TS，並在卡片 extension 標記 TS_FALLBACK（便於 QA）
      riskResult = buildRiskTs(input);
      comprehensiveResult = buildComprehensiveTs(riskResult);
      engine = 'TS_FALLBACK';
    }
  } else {
    // 未啟用 ELM：用 TS 對齊層（可在未部署/未重編譯 ELM 時使用）
    riskResult = buildRiskTs(input);
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

