/*
 * 更新時間：2026-04-16 16:44
 * 作者：CDS Service
 * 摘要：補強 handleCkdRiskHook 可讀性註解（prefetch/hybrid 合併策略、USE_ELM 分支與 fallback；不影響行為）
 *
 * 更新時間：2026-04-16 10:08
 * 作者：CDS Service
 * 摘要：ckd-risk v1 改為預設 hybrid：prefetch 優先；缺少則伺服端向 FHIR 取 Patient/Condition/Observation 補齊
 *
 * 更新時間：2026-04-16 14:59
 * 作者：CDS Service
 * 摘要：ckd-risk 擴充風險因子：支援 AKI（ICD-10 N17*）與家族史 CKD（FamilyMemberHistory + SNOMED 709044004）；prefetch/hybrid 補齊 conditionsAll + familyHistory
 *
 * 更新時間：2026-04-15 17:46
 * 作者：CDS Service
 * 摘要：ckd-risk v1 改為規則集合（Risk flags + eGFR/uACR missing reminders），僅使用 prefetch；USE_ELM 可真跑 CKD_Risk ELM，失敗則 TS_FALLBACK
 *
 * 更新時間：2026-04-15 15:05
 * 作者：CDS Service
 * 摘要：cards[].extension 增加規則引擎標記（ELM / TS / TS_FALLBACK），便於 Postman/E2E 判斷是否真跑 ELM
 *
 * 更新時間：2026-04-15 14:51
 * 作者：CDS Service
 * 摘要：新增 USE_ELM=true 時以 cql-execution 執行 ELM（elm/EGFR_Check.json），取代 TS 對齊層決策（失敗則 fallback）
 *
 * 更新時間：2026-04-15 09:43
 * 作者：CDS Service
 * 摘要：階段四 — 複查卡片補上 CDS Hooks links、source.url（FHIR 檢驗歷程連結）；仍以 Fastify 實作等同教學 Express
 *
 * 更新時間：2026-04-15 09:32
 * 作者：CDS Service
 * 摘要：階段三 — 依 cql/EGFR_Check.cql 規則（TS 對齊層）觸發 eGFR 複查建議卡片
 *
 * 更新時間：2026-04-15 09:08
 * 作者：CDS Service
 * 摘要：步驟二 — 使用 extractEGFRValue 解析 prefetch 數值；prefetch 不足時 fallback fhirClient
 *
 * 更新時間：2026-04-14 12:00
 * 作者：CDS Service
 * 摘要：POST /cds-services/ckd-risk — 解析 prefetch、fallback FHIR、回傳 cards
 */
import { evaluateCkdRiskWithElm, type CkdRiskPrefetchInput, type CkdRiskElmResult } from '../cql/ckdRiskElmExecutor.js';
import {
  getPatient,
  searchActiveConditions,
  searchAllConditions,
  searchFamilyMemberHistory,
  searchObservationsForCkdRisk,
} from '../fhir/fhirClient.js';
import { buildCkdRiskCards } from './ckdRiskCardBuilder.js';
import { extractBundleResources, stripPatientPrefix, getUseElm, formatError } from './utils.js';

/** CDS Hooks 請求（精簡，僅處理本 hook 所需欄位） */
export interface CdsHooksRequest {
  hook?: string;
  context?: { patientId?: string };
  prefetch?: Record<string, unknown>;
}

/** CDS Hooks Card（精簡；可含 links） */
export interface CdsCard {
  uuid?: string;
  summary: string;
  indicator: 'info' | 'warning' | 'critical';
  source?: { label: string; url?: string };
  detail?: string;
  links?: Array<{ label: string; type?: string; url: string }>;
  extension?: Array<{ url: string; valueString?: string }>;
}

function buildEgfrObservationHistoryUrl(patientLogicalId: string): string {
  const base = (process.env.FHIR_BASE_URL ?? 'http://localhost:9090/fhir').replace(/\/$/, '');
  const p = encodeURIComponent(patientLogicalId);
  return `${base}/Observation?patient=${p}&code=62238-1`;
}

export interface CdsHooksResponse {
  cards: CdsCard[];
}

function dedupeByResourceTypeAndId(items: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const out: Array<Record<string, unknown>> = [];
  for (const r of items) {
    const rt = typeof (r as any)?.resourceType === 'string' ? String((r as any).resourceType) : '';
    const id = typeof (r as any)?.id === 'string' ? String((r as any).id) : '';
    const key = `${rt}/${id}`;
    if (rt && id) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(r);
  }
  return out;
}

function getIssuedString(o: Record<string, unknown>): string {
  const issued = (o as any).issued;
  return typeof issued === 'string' ? issued : '';
}

function mostRecentObsByLoincCodes(
  observations: Array<Record<string, unknown>>,
  codes: string[],
): Record<string, unknown> | undefined {
  return observations
    .filter(
      (o) =>
        Array.isArray((o.code as any)?.coding) &&
        (o.code as any).coding.some(
          (cd: any) => cd?.system === 'http://loinc.org' && codes.includes(cd?.code),
        ),
    )
    .slice()
    .sort((a, b) => getIssuedString(a).localeCompare(getIssuedString(b)))
    .pop();
}

export function evaluateCkdRiskWithTs(input: CkdRiskPrefetchInput): CkdRiskElmResult {
  const { patient, conditions, observations, familyHistories } = input;

  const hasAnyCondCoding = (systems: string[]) =>
    conditions.some((c) =>
      Array.isArray((c.code as any)?.coding) &&
      (c.code as any).coding.some((cd: any) => systems.includes(cd?.system)),
    );
  const condMatch = (pred: (cd: any) => boolean) =>
    conditions.some(
      (c) =>
        Array.isArray((c.code as any)?.coding) &&
        (c.code as any).coding.some((cd: any) => pred(cd)),
    );

  const dmHtnHeartSystems = ['http://hl7.org/fhir/sid/icd-10-cm', 'http://snomed.info/sct'];

  const AgeOver60 =
    typeof (patient as any).birthDate === 'string'
      ? (() => {
          const bd = new Date((patient as any).birthDate);
          if (Number.isNaN(bd.getTime())) return null;
          const now = new Date();
          let years = now.getFullYear() - bd.getFullYear();
          const m = now.getMonth() - bd.getMonth();
          if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) years -= 1;
          return years > 60;
        })()
      : null;

  const HasDiabetes = !hasAnyCondCoding(dmHtnHeartSystems)
    ? null
    : condMatch((cd) =>
        (cd?.system === 'http://hl7.org/fhir/sid/icd-10-cm' &&
          typeof cd?.code === 'string' &&
          (cd.code.startsWith('E10') || cd.code.startsWith('E11'))) ||
        (cd?.system === 'http://snomed.info/sct' &&
          (cd?.code === '44054006' || cd?.code === '73211009')),
      );

  const HasHypertension = !hasAnyCondCoding(dmHtnHeartSystems)
    ? null
    : condMatch((cd) =>
        (cd?.system === 'http://hl7.org/fhir/sid/icd-10-cm' &&
          typeof cd?.code === 'string' &&
          cd.code.startsWith('I10')) ||
        (cd?.system === 'http://snomed.info/sct' && cd?.code === '38341003'),
      );

  const HasHeartDisease = !hasAnyCondCoding(dmHtnHeartSystems)
    ? null
    : condMatch((cd) =>
        (cd?.system === 'http://hl7.org/fhir/sid/icd-10-cm' &&
          typeof cd?.code === 'string' &&
          (cd.code.startsWith('I25') || cd.code.startsWith('I50'))) ||
        (cd?.system === 'http://snomed.info/sct' &&
          (cd?.code === '53741008' || cd?.code === '84114007')),
      );

  const bmiObs = mostRecentObsByLoincCodes(observations, ['39156-5']);
  const bmiValue =
    typeof (bmiObs as any)?.valueQuantity?.value === 'number'
      ? (bmiObs as any).valueQuantity.value
      : null;
  const HasObesity =
    bmiValue != null
      ? bmiValue >= 30
      : (() => {
          const icdOnly = ['http://hl7.org/fhir/sid/icd-10-cm'];
          const hasIcd = hasAnyCondCoding(icdOnly);
          if (!hasIcd) return null;
          return condMatch(
            (cd) =>
              cd?.system === 'http://hl7.org/fhir/sid/icd-10-cm' &&
              typeof cd?.code === 'string' &&
              cd.code.startsWith('E66'),
          );
        })();

  const egfrObs = mostRecentObsByLoincCodes(observations, ['62238-1', '33914-3']);
  const uacrObs = mostRecentObsByLoincCodes(observations, ['9318-7', '32294-1']);
  const MostRecentEgfrValue =
    typeof (egfrObs as any)?.valueQuantity?.value === 'number'
      ? (egfrObs as any).valueQuantity.value
      : null;
  const MostRecentEgfrUnit =
    typeof (egfrObs as any)?.valueQuantity?.unit === 'string'
      ? (egfrObs as any).valueQuantity.unit
      : null;
  const MostRecentUacrValue =
    typeof (uacrObs as any)?.valueQuantity?.value === 'number'
      ? (uacrObs as any).valueQuantity.value
      : null;
  const MostRecentUacrUnit =
    typeof (uacrObs as any)?.valueQuantity?.unit === 'string'
      ? (uacrObs as any).valueQuantity.unit
      : null;

  const MissingeGFR = !egfrObs;
  const MissinguACR = !uacrObs;

  const hasIcd10Condition = hasAnyCondCoding(['http://hl7.org/fhir/sid/icd-10-cm']);
  const HasAkiHistory = !hasIcd10Condition
    ? null
    : condMatch(
        (cd: any) =>
          cd?.system === 'http://hl7.org/fhir/sid/icd-10-cm' &&
          typeof cd?.code === 'string' &&
          cd.code.startsWith('N17'),
      );

  const hasAnyFamilyHistory = Array.isArray(familyHistories) && familyHistories.length > 0;
  const HasFamilyHistoryOfCKD = !hasAnyFamilyHistory
    ? null
    : familyHistories.some((f) => {
        const cond = (f as any)?.condition;
        if (!Array.isArray(cond)) return false;
        return cond.some((fc: any) => {
          const coding = fc?.code?.coding;
          if (!Array.isArray(coding)) return false;
          return coding.some(
            (cd: any) =>
              cd?.system === 'http://snomed.info/sct' &&
              typeof cd?.code === 'string' &&
              cd.code === '709044004',
          );
        });
      });

  const FamilyHistoryOrAKI =
    HasAkiHistory === true || HasFamilyHistoryOfCKD === true
      ? true
      : HasAkiHistory === false && HasFamilyHistoryOfCKD === false
        ? false
        : null;

  return {
    AgeOver60,
    HasDiabetes,
    HasHypertension,
    HasHeartDisease,
    HasObesity,
    HasAkiHistory,
    HasFamilyHistoryOfCKD,
    FamilyHistoryOrAKI,
    MostRecentEgfrValue,
    MostRecentEgfrUnit,
    MostRecentUacrValue,
    MostRecentUacrUnit,
    MissingeGFR,
    MissinguACR,
    MissingeGFRRecommendation: MissingeGFR
      ? 'eGFR not recorded in past 12 months — order eGFR (blood test)'
      : null,
    MissinguACRRecommendation: MissinguACR
      ? 'uACR not recorded in past 12 months — order uACR (urine test)'
      : null,
  };
}

/**
 * 處理 ckd-risk v1：預設 hybrid（prefetch 優先；缺少則伺服端向 FHIR 取資料補齊）。
 */
export async function handleCkdRiskHook(body: CdsHooksRequest): Promise<CdsHooksResponse> {
  // 1) 取得 patientId（CDS Hooks context 可能是 "Patient/{id}" 或 "{id}"）
  const rawId = body.context?.patientId;
  if (!rawId) {
    return {
      cards: [
        {
          summary: '缺少 patientId',
          indicator: 'warning',
          detail: '請在 context 中提供 patientId。',
        },
      ],
    };
  }

  const patientId = stripPatientPrefix(rawId);

  // 2) Prefetch（hybrid）：優先使用 request.prefetch；缺少時才向 FHIR 補齊
  //    ckd-risk v1.1 除了 conditions/observations，也支援：
  //    - conditionsAll：包含 inactive condition（用於 AKI 病史）
  //    - familyHistory：FamilyMemberHistory（用於 CKD 家族史）
  const pf = body.prefetch ?? {};
  const patientList = extractBundleResources(pf.patient, 'Patient');
  const pfPatient = patientList[0] ?? null;
  const pfConditions = extractBundleResources(pf.conditions, 'Condition');
  const pfConditionsAll = extractBundleResources((pf as any).conditionsAll, 'Condition');
  const pfObservations = extractBundleResources(pf.observations, 'Observation');
  const pfFamilyHistory = extractBundleResources((pf as any).familyHistory, 'FamilyMemberHistory');

  // 3) hybrid 取數：prefetch 有就用，沒有才打 FHIR
  const patient = pfPatient ?? (await getPatient(patientId));
  const conditions = dedupeByResourceTypeAndId(
    pf.conditions || (pf as any).conditionsAll
      ? [...pfConditions, ...pfConditionsAll]
      : [
          ...(await searchActiveConditions(patientId)),
          ...(await searchAllConditions(patientId)),
        ],
  );
  const observations = pf.observations ? pfObservations : await searchObservationsForCkdRisk(patientId);
  const familyHistories = (pf as any).familyHistory ? pfFamilyHistory : await searchFamilyMemberHistory(patientId);

  // 4) 決定用哪個引擎：USE_ELM=true 走 ELM（失敗則 TS_FALLBACK），否則純 TS
  const useElm = getUseElm();
  let engine: 'ELM' | 'TS' | 'TS_FALLBACK' = useElm ? 'ELM' : 'TS';

  const input: CkdRiskPrefetchInput = { patient, conditions, observations, familyHistories };

  const result: CkdRiskElmResult = useElm
    ? await (async () => {
        try {
          return await evaluateCkdRiskWithElm(input);
        } catch (err) {
          // ELM 執行失敗時仍回卡片：降級到 TS，並在 cards.extension 標記 TS_FALLBACK（便於 QA）
          console.error('[ckd-risk] ELM execution failed, falling back to TS:', formatError(err));
          engine = 'TS_FALLBACK';
          return evaluateCkdRiskWithTs(input);
        }
      })()
    : evaluateCkdRiskWithTs(input);

  // 5) 依風險因子旗標 + 缺漏檢測結果產生 cards（統一由 card builder 處理文案、優先序與 extension）
  const cards = buildCkdRiskCards({ engine, result });
  return { cards };
}
