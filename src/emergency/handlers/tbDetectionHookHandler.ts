/*
 * 更新時間：2026-04-22 11:35
 * 作者：CDS Service
 * 摘要：Test-plan 修正（3 個邊界情境失敗）：
 *       1. buildTbDetectionCards 在 ELM mode（elmSummary 存在）改用 ELM 布林決定 reasons/indicator，
 *          TS signals 僅用於 detail 計數文字（全 ELM 化收尾）。
 *       2. 後端資料取得改為查所有 Condition（不加 clinical-status=active 過濾），
 *          讓 ELM 自行依 2yr resolved window 判斷；TS fallback 仍保留 active 過濾。
 *
 * 更新時間：2026-04-22 10:56
 * 作者：CDS Service
 * 摘要：Phase 3.3 — ELM 路徑新增傳入 observations 並讀 TbLabObservationCount；
 *       rule-engine extension 加入 elm_lab_obs_count 以供觀測；TS 側 per-code 展示邏輯維持不動。
 *
 * 更新時間：2026-04-22 10:40
 * 作者：CDS Service
 * 摘要：Phase 3.1 — 新增 Observation 讀取（prefetch observations 或 fallback tbFhirClient.searchObservationsForPatient）；
 *       以 TB-Lab-Monitoring ValueSet 分組取每個命中 code 的最新 effectiveDateTime／valueQuantity／component，
 *       彙整為「最近一次安全性監測」摘要並 append 到卡片 detail；ELM/TS/TS_FALLBACK 三路徑均附加。
 *
 * 更新時間：2026-04-22 10:22
 * 作者：CDS Service
 * 摘要：Phase 2.3 — USE_ELM 分支：呼叫 evaluateEmergencyTbDetectionWithElm 執行 elm/Emergency_TB_Detection.json；
 *       執行成功則 engine=ELM（card extension urn:cds-service:rule-engine=ELM），失敗則 engine=TS_FALLBACK 並續用 TS 對齊層；
 *       rule-engine extension 新增 ELM 布林摘要與 ELM-TS 一致性 flag，方便日後回歸。
 *
 * 更新時間：2026-04-22 09:22
 * 作者：CDS Service
 * 摘要：新增急診 TB Detection patient-view handler。以 Emergency_TB_Detection.cql 為規格，
 *       TS 主路徑依本次匯入之 4 份 FHIR ValueSet（canonical URL 由 tbValueSetLoader 載入快取）比對：
 *       活動性 TB（A15–A19 / Z16.34）、LTBI（R76.1）、TB 接觸者（Z20.1）、一線／二線藥物、感控 Flag。
 */

import { randomUUID } from 'node:crypto';
import type { CdsHooksRequest, CdsHooksResponse } from '../../cds/ckdHookHandler.js';
import { extractBundleResources, formatError, getUseElm, stripPatientPrefix } from '../../cds/utils.js';
import {
  ensureTbValueSets,
  getTbValueSet,
  codeableInValueSet,
  firstMatchedCode,
  normalizeCode,
} from '../../cql/tbValueSetLoader.js';
import {
  evaluateEmergencyTbDetectionWithElm,
  type EmergencyTbDetectionElmResult,
} from '../../cql/emergencyTbDetectionElmExecutor.js';
import {
  getPatient,
  searchActiveConditions,
  searchFlagsForPatient,
  searchMedicationStatementsForPatient,
} from '../../fhir/fhirClient.js';
import {
  searchMedicationRequestsForPatient,
  searchObservationsForPatient,
  searchAllConditionsForPatient,
} from '../../fhir/tbFhirClient.js';

const EXT_RULE_ENGINE = 'urn:cds-service:rule-engine';
const EXT_EMERGENCY_RULE = 'urn:cds:emergency:rule';

interface TbSignals {
  activeTbDx: number;
  latentTbDx: number;
  contactTbDx: number;
  firstLineMeds: number;
  secondLineMeds: number;
  infectionFlags: number;
}

function clinicalStatusActive(cond: Record<string, unknown>): boolean {
  const cs = cond.clinicalStatus as
    | { coding?: Array<{ code?: string }>; text?: string }
    | string
    | undefined;
  if (!cs) return false;
  if (typeof cs === 'string') return cs.toLowerCase() === 'active';
  if (Array.isArray(cs.coding)) {
    return cs.coding.some((c) => (c?.code ?? '').toLowerCase() === 'active');
  }
  if (typeof cs.text === 'string') return cs.text.toLowerCase() === 'active';
  return false;
}

function classifyTbCondition(
  cond: Record<string, unknown>,
): 'active' | 'latent' | 'contact' | null {
  const match = firstMatchedCode(cond.code, getTbValueSet('diagnoses'));
  if (!match) return null;
  const norm = normalizeCode(match.code);
  if (/^A1[5-9]/.test(norm)) return 'active';
  if (norm === 'Z1634') return 'active';
  if (norm === 'R761') return 'latent';
  if (norm === 'Z201') return 'contact';
  return null;
}

function medicationCodeable(resource: Record<string, unknown>): unknown {
  if (resource.medicationCodeableConcept) return resource.medicationCodeableConcept;
  if (resource.medication && typeof resource.medication === 'object') return resource.medication;
  return null;
}

function medicationMatches(
  resource: Record<string, unknown>,
  key: 'medsFirstLine' | 'medsSecondLine',
): boolean {
  const codeable = medicationCodeable(resource);
  if (!codeable) return false;
  return codeableInValueSet(codeable, getTbValueSet(key));
}

function flagHasMeaningfulCode(f: Record<string, unknown>): boolean {
  const code = f.code as Record<string, unknown> | undefined;
  if (!code) return false;
  const text = typeof code.text === 'string' ? code.text.trim() : '';
  if (text.length > 0) return true;
  const codings = Array.isArray(code.coding) ? code.coding : [];
  return codings.length > 0;
}

function isFlagResourceActive(f: Record<string, unknown>): boolean {
  return f.status === 'active';
}

/** 取 Observation 的 effective 時間（優先 dateTime → instant → period.start → issued） */
function pickObservationEffective(obs: Record<string, unknown>): string | null {
  if (typeof obs.effectiveDateTime === 'string' && obs.effectiveDateTime) return obs.effectiveDateTime;
  if (typeof obs.effectiveInstant === 'string' && obs.effectiveInstant) return obs.effectiveInstant;
  const ep = obs.effectivePeriod as { start?: string } | undefined;
  if (ep?.start) return ep.start;
  if (typeof obs.issued === 'string' && obs.issued) return obs.issued;
  return null;
}

/** 從 Observation.code 找出對應 ValueSet 命中那一筆 coding 的 display（沒有則 fallback 其他來源） */
function findDisplayForMatch(
  codeable: unknown,
  matched: { system?: string; code: string },
): string {
  if (codeable && typeof codeable === 'object') {
    const cc = codeable as { coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string };
    const coding = Array.isArray(cc.coding) ? cc.coding : [];
    const hit = coding.find(
      (c) =>
        (c?.code ?? '') === matched.code &&
        (matched.system == null || (c?.system ?? '') === matched.system),
    );
    if (hit?.display) return String(hit.display);
    if (cc.text) return String(cc.text);
    if (coding[0]?.display) return String(coding[0].display);
  }
  return matched.code;
}

/** 將 Observation 的 value 壓成一行字；支援 valueQuantity / valueString / component（CBC） */
function formatObservationValue(obs: Record<string, unknown>): string {
  const vq = obs.valueQuantity as { value?: number; unit?: string } | undefined;
  if (vq && typeof vq.value === 'number') {
    return `${vq.value}${vq.unit ? ' ' + vq.unit : ''}`;
  }
  if (typeof obs.valueString === 'string' && obs.valueString) return obs.valueString;
  const comps = Array.isArray(obs.component) ? (obs.component as Array<Record<string, unknown>>) : [];
  if (comps.length > 0) {
    const parts: string[] = [];
    for (const c of comps) {
      const code = c.code as { text?: string; coding?: Array<{ display?: string }> } | undefined;
      const label = code?.text || code?.coding?.[0]?.display || '';
      const cq = c.valueQuantity as { value?: number; unit?: string } | undefined;
      if (cq && typeof cq.value === 'number') {
        parts.push(`${label}=${cq.value}${cq.unit ? ' ' + cq.unit : ''}`);
      }
    }
    if (parts.length > 0) return parts.join(', ');
  }
  return '—';
}

interface LatestSafetyLab {
  key: string;
  display: string;
  time: string;
  valueStr: string;
}

/** 以 TB-Lab-Monitoring ValueSet 過濾 Observation，同一命中 code 取最新 effective 時間；無命中則回 null。 */
function buildLatestSafetyLabs(
  observations: Array<Record<string, unknown>>,
): LatestSafetyLab[] {
  const vs = getTbValueSet('labMonitoring');
  const latestByCode = new Map<string, LatestSafetyLab>();
  for (const obs of observations) {
    const match = firstMatchedCode(obs.code, vs);
    if (!match) continue;
    const time = pickObservationEffective(obs);
    if (!time) continue;
    const key = `${match.system ?? ''}|${match.code}`;
    const existing = latestByCode.get(key);
    if (!existing || existing.time < time) {
      latestByCode.set(key, {
        key,
        display: findDisplayForMatch(obs.code, match),
        time,
        valueStr: formatObservationValue(obs),
      });
    }
  }
  return [...latestByCode.values()].sort((a, b) => b.time.localeCompare(a.time));
}

function formatSafetyLabsForDetail(labs: LatestSafetyLab[]): string | null {
  if (labs.length === 0) return null;
  const lines = labs.map((l) => `• ${l.display}：${l.valueStr}（${l.time}）`);
  return `最近一次安全性監測（TB-Lab-Monitoring）：\n${lines.join('\n')}`;
}

function countSignals(
  conditions: Array<Record<string, unknown>>,
  medRequests: Array<Record<string, unknown>>,
  medStatements: Array<Record<string, unknown>>,
  flags: Array<Record<string, unknown>>,
): TbSignals {
  let activeTbDx = 0;
  let latentTbDx = 0;
  let contactTbDx = 0;
  for (const c of conditions) {
    if (!clinicalStatusActive(c)) continue;
    const kind = classifyTbCondition(c);
    if (kind === 'active') activeTbDx += 1;
    else if (kind === 'latent') latentTbDx += 1;
    else if (kind === 'contact') contactTbDx += 1;
  }

  let firstLineMeds = 0;
  let secondLineMeds = 0;
  for (const mr of medRequests) {
    if (medicationMatches(mr, 'medsFirstLine')) firstLineMeds += 1;
    if (medicationMatches(mr, 'medsSecondLine')) secondLineMeds += 1;
  }
  for (const ms of medStatements) {
    if (medicationMatches(ms, 'medsFirstLine')) firstLineMeds += 1;
    if (medicationMatches(ms, 'medsSecondLine')) secondLineMeds += 1;
  }

  const infectionFlags = flags.filter(isFlagResourceActive).filter(flagHasMeaningfulCode).length;

  return { activeTbDx, latentTbDx, contactTbDx, firstLineMeds, secondLineMeds, infectionFlags };
}

function buildTbDetectionCards(
  engine: 'TS' | 'ELM' | 'TS_FALLBACK',
  s: TbSignals,
  elmSummary?: EmergencyTbDetectionElmResult,
  safetyLabsSummary?: string | null,
): CdsHooksResponse {
  const tsFragment =
    `active_tb_dx=${s.activeTbDx};latent_tb_dx=${s.latentTbDx};contact_tb_dx=${s.contactTbDx};` +
    `first_line_meds=${s.firstLineMeds};second_line_meds=${s.secondLineMeds};` +
    `infection_flags=${s.infectionFlags}`;
  const elmFragment = elmSummary
    ? `;elm_active=${elmSummary.hasActiveTbDiagnosis};elm_latent=${elmSummary.hasLatentTbDiagnosis};` +
      `elm_contact=${elmSummary.isTbContact};elm_first_line=${elmSummary.hasFirstLineTbMed};` +
      `elm_second_line_with_tb=${elmSummary.hasSecondLineTbMedWithTbDx};elm_flag=${elmSummary.hasInfectionControlFlag};` +
      `elm_lab_obs_count=${elmSummary.tbLabObservationCount}`
    : '';
  const ruleExt = {
    url: EXT_EMERGENCY_RULE,
    valueString: tsFragment + elmFragment,
  };
  const engineExt = { url: EXT_RULE_ENGINE, valueString: engine };

  const safetyBlock = safetyLabsSummary ? `\n\n${safetyLabsSummary}` : '';

  // ELM 模式：以 ELM 布林為單一真相來源決定 reasons / indicator
  if (elmSummary) {
    const elmReasons: string[] = [];
    if (elmSummary.hasActiveTbDiagnosis)
      elmReasons.push(`活動性結核診斷（A15–A19／Z16.34）${s.activeTbDx || ''}筆（ELM 確認）`);
    if (elmSummary.hasLatentTbDiagnosis)
      elmReasons.push(`潛伏結核感染（R76.1）${s.latentTbDx || ''}筆（ELM 確認）`);
    if (elmSummary.isTbContact)
      elmReasons.push(`結核接觸者（Z20.1）${s.contactTbDx || ''}筆（ELM 確認）`);
    if (elmSummary.hasFirstLineTbMed)
      elmReasons.push(`一線結核用藥（ValueSet tb-meds-firstline）${s.firstLineMeds || ''}筆（ELM 確認）`);
    if (elmSummary.hasSecondLineTbMedWithTbDx)
      elmReasons.push(`二線結核用藥搭配 TB 診斷（ValueSet tb-meds-secondline）${s.secondLineMeds || ''}筆（ELM 確認）`);
    if (elmSummary.hasInfectionControlFlag)
      elmReasons.push(`作用中感控 Flag（含具意義代碼）${s.infectionFlags || ''}筆（ELM 確認）`);

    if (elmReasons.length > 0) {
      return {
        cards: [
          {
            uuid: randomUUID(),
            summary: '疑似結核／LTBI／接觸者 — 請覆核並啟動隔離／通報流程',
            indicator: 'warning',
            detail:
              `${elmReasons.join('；')}。\n規則依據：Emergency_TB_Detection.cql（ELM 執行）。${safetyBlock}`,
            source: { label: 'Emergency CDS (TB Detection)', url: process.env.CDS_GUIDELINE_URL },
            extension: [engineExt, ruleExt],
          },
        ],
      };
    }
    if (s.secondLineMeds > 0 && !elmSummary.hasSecondLineTbMedWithTbDx) {
      return {
        cards: [
          {
            uuid: randomUUID(),
            summary: '偵測到二線藥物但無 TB 診斷，不觸發結核預警',
            indicator: 'info',
            detail:
              `二線藥物 ${s.secondLineMeds} 筆（非 TB 專用），ELM 確認無對應 TB 診斷，依規則不觸發警示。${safetyBlock}`,
            source: { label: 'Emergency CDS (TB Detection)' },
            extension: [engineExt, ruleExt],
          },
        ],
      };
    }
    return {
      cards: [
        {
          uuid: randomUUID(),
          summary: '未偵測到結核／LTBI／接觸者線索',
          indicator: 'info',
          detail: `ELM 確認：目前未符合 TB-Diagnoses / 一線或二線藥物 / 感控 Flag 任一條件。${safetyBlock}`,
          extension: [engineExt, ruleExt],
        },
      ],
    };
  }

  // TS / TS_FALLBACK 模式：以 TS 計數決定
  const secondLineWithTb = s.activeTbDx > 0 && s.secondLineMeds > 0;
  const reasons: string[] = [];
  if (s.activeTbDx > 0) reasons.push(`活動性結核診斷（A15–A19／Z16.34）${s.activeTbDx} 筆`);
  if (s.latentTbDx > 0) reasons.push(`潛伏結核感染（R76.1）${s.latentTbDx} 筆`);
  if (s.contactTbDx > 0) reasons.push(`結核接觸者（Z20.1）${s.contactTbDx} 筆`);
  if (s.firstLineMeds > 0) reasons.push(`一線結核用藥（ValueSet tb-meds-firstline）${s.firstLineMeds} 筆`);
  if (secondLineWithTb) {
    reasons.push(`二線結核用藥搭配 TB 診斷（ValueSet tb-meds-secondline）${s.secondLineMeds} 筆`);
  }
  if (s.infectionFlags > 0) reasons.push(`作用中感控 Flag（含具意義代碼）${s.infectionFlags} 筆`);

  if (reasons.length > 0) {
    return {
      cards: [
        {
          uuid: randomUUID(),
          summary: '疑似結核／LTBI／接觸者 — 請覆核並啟動隔離／通報流程',
          indicator: 'warning',
          detail:
            `${reasons.join('；')}。\n規則依據：Emergency_TB_Detection.cql（ValueSet canonical URL 由 HAPI FHIR 提供）。${safetyBlock}`,
          source: { label: 'Emergency CDS (TB Detection)', url: process.env.CDS_GUIDELINE_URL },
          extension: [engineExt, ruleExt],
        },
      ],
    };
  }

  // 只有二線藥物但未搭配 TB 診斷：改以 info 指示「非 TB 用藥、無需觸發」
  if (s.secondLineMeds > 0 && s.activeTbDx === 0) {
    return {
      cards: [
        {
          uuid: randomUUID(),
          summary: '偵測到二線藥物但無 TB 診斷，不觸發結核預警',
          indicator: 'info',
          detail:
            `二線藥物 ${s.secondLineMeds} 筆（非 TB 專用），未找到對應的 A15–A19／Z16.34 TB 診斷，依規則不觸發警示。${safetyBlock}`,
          source: { label: 'Emergency CDS (TB Detection)' },
          extension: [engineExt, ruleExt],
        },
      ],
    };
  }

  return {
    cards: [
      {
        uuid: randomUUID(),
        summary: '未偵測到結核／LTBI／接觸者線索',
        indicator: 'info',
        detail: `目前未符合 TB-Diagnoses / 一線或二線藥物 / 感控 Flag 任一條件。${safetyBlock}`,
        extension: [engineExt, ruleExt],
      },
    ],
  };
}

export async function handleTbDetectionHook(body: CdsHooksRequest): Promise<CdsHooksResponse> {
  const rawId = body.context?.patientId;
  if (!rawId) {
    return {
      cards: [
        {
          uuid: randomUUID(),
          summary: '缺少 patientId',
          indicator: 'warning',
          detail: '請在 context 中提供 patientId。',
        },
      ],
    };
  }

  const patientId = stripPatientPrefix(rawId);
  const pf = body.prefetch ?? {};

  try {
    await ensureTbValueSets();
  } catch (err) {
    return {
      cards: [
        {
          uuid: randomUUID(),
          summary: 'TB Detection 初始化失敗（ValueSet 未載入）',
          indicator: 'warning',
          detail: `無法自 FHIR Server 載入 TB 相關 ValueSet：${formatError(err)}。請先以 curl PUT 四份 ValueSet 到 HAPI FHIR。`,
        },
      ],
    };
  }

  const pfPatientList = extractBundleResources(pf.patient, 'Patient');

  const pfConds = extractBundleResources(pf.conditions, 'Condition');
  // ELM 路徑需要所有 Condition（含 resolved）以讓 ELM 評估 2yr window；
  // TS_FALLBACK 路徑的 countSignals() 內部仍以 clinicalStatusActive() 過濾。
  const useElmEarly = getUseElm();
  const conditions = pf.conditions
    ? pfConds
    : useElmEarly
      ? await searchAllConditionsForPatient(patientId)
      : await searchActiveConditions(patientId);

  const pfMrs = extractBundleResources(pf.medicationRequests, 'MedicationRequest');
  const medRequests = pf.medicationRequests
    ? pfMrs
    : await searchMedicationRequestsForPatient(patientId);

  const pfMs = extractBundleResources(pf.medicationStatements, 'MedicationStatement');
  const medStatements = pf.medicationStatements
    ? pfMs
    : await searchMedicationStatementsForPatient(patientId);

  const pfFlags = extractBundleResources(pf.flags, 'Flag');
  const flags = pf.flags ? pfFlags : await searchFlagsForPatient(patientId);

  const pfObs = extractBundleResources(
    (pf as Record<string, unknown>).observations,
    'Observation',
  );
  const observations = (pf as Record<string, unknown>).observations
    ? pfObs
    : await searchObservationsForPatient(patientId);

  const signals = countSignals(conditions, medRequests, medStatements, flags);
  const safetyLabsSummary = formatSafetyLabsForDetail(buildLatestSafetyLabs(observations));

  if (useElmEarly) {
    const pfPatient = pfPatientList[0] ?? (await getPatient(patientId));
    try {
      const elm = await evaluateEmergencyTbDetectionWithElm({
        patient: pfPatient as Record<string, unknown>,
        conditions,
        medicationRequests: medRequests,
        medicationStatements: medStatements,
        flags,
        observations,
      });
      return buildTbDetectionCards('ELM', signals, elm, safetyLabsSummary);
    } catch (err) {
      console.error(
        '[tb-detection] ELM execution failed, falling back to TS:',
        formatError(err),
      );
      return buildTbDetectionCards('TS_FALLBACK', signals, undefined, safetyLabsSummary);
    }
  }

  return buildTbDetectionCards('TS', signals, undefined, safetyLabsSummary);
}
