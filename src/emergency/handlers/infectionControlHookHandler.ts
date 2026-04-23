/*
 * 更新時間：2026-04-20 16:01
 * 作者：CDS Service
 * 摘要：info 卡片文案對齊 skipFlags 行為：EMERGENCY_INFECT_CTRL_SKIP_FLAGS=true 時明示「忽略 Flag 線索」
 *
 * 更新時間：2026-04-20 13:55
 * 作者：CDS Service
 * 摘要：USE_ELM 時執行 Infection_Control_Warning ELM，失敗 TS_FALLBACK；cards 加 urn:cds-service:rule-engine
 *
 * 更新時間：2026-04-20 10:25
 * 作者：CDS Service
 * 摘要：對齊急診 PDF／HIR：ICD-10 HIV 擴充 B20–B24；新增 ATC J05*（ARV 抗病毒）領藥線索
 *
 * 更新時間：2026-04-20 10:05
 * 作者：CDS Service
 * 摘要：Flag 僅採 resource.status=active（FHIR 搜尋未必支援 status 參數）
 *
 * 更新時間：2026-04-17 11:55
 * 作者：CDS Service
 * 摘要：infection-control-warning patient-view：Flag／ATC J04* 用藥／TB-HIV 相關 ICD-10（規則請對齊院內 PDF）
 */

import { randomUUID } from 'node:crypto';
import type { CdsHooksRequest, CdsHooksResponse } from '../../cds/ckdHookHandler.js';
import { extractBundleResources, formatError, getUseElm, stripPatientPrefix } from '../../cds/utils.js';
import { evaluateEmergencyInfectionControlWithElm } from '../../cql/emergencyInfectionControlElmExecutor.js';
import {
  getPatient,
  searchActiveConditions,
  searchFlagsForPatient,
  searchMedicationStatementsForPatient,
} from '../../fhir/fhirClient.js';

/** 結核化療常用 ATC 前綴（WHO ATC） */
const ATC_TB_PREFIX = 'J04';
/** 全身用抗病毒製劑（含 ARV），WHO ATC 常見於 J05*（請對齊院內藥典／PDF） */
const ATC_ARV_PREFIX = 'J05';

const EXT_RULE_ENGINE = 'urn:cds-service:rule-engine';
const EXT_EMERGENCY_RULE = 'urn:cds:emergency:rule';

function envFlagTrue(name: string): boolean {
  return String(process.env[name] ?? '')
    .trim()
    .toLowerCase() === 'true';
}

/** 若為 true，僅依用藥與診斷判斷，忽略 Flag（避免院內 Flag 過多造成誤警）。 */
function skipFlags(): boolean {
  return envFlagTrue('EMERGENCY_INFECT_CTRL_SKIP_FLAGS');
}

function flattenCodings(obj: unknown): Array<{ system?: string; code?: string }> {
  if (!obj || typeof obj !== 'object') return [];
  const out: Array<{ system?: string; code?: string }> = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (Array.isArray(n.coding)) {
      for (const c of n.coding) {
        if (c && typeof c === 'object') {
          const cc = c as { system?: string; code?: string };
          out.push({ system: cc.system, code: cc.code });
        }
      }
    }
    for (const v of Object.values(n)) {
      if (v && typeof v === 'object') walk(v);
    }
  };
  walk(obj);
  return out;
}

function isTbOrHivIcd10(code: string): boolean {
  const c = code.toUpperCase().replace(/\./g, '');
  if (/^B2[0-4]/.test(c)) return true;
  if (/^A1[5-9]/.test(c)) return true;
  return false;
}

function conditionMatchesTbHiv(cond: Record<string, unknown>): boolean {
  const codings = flattenCodings(cond.code);
  return codings.some((cd) => {
    const sys = (cd.system ?? '').toLowerCase();
    const code = typeof cd.code === 'string' ? cd.code : '';
    if (!code) return false;
    const icd =
      sys.includes('icd-10') || sys.includes('icd10') || sys === 'http://hl7.org/fhir/sid/icd-10';
    if (!icd && !sys.includes('icd')) return false;
    return isTbOrHivIcd10(code);
  });
}

function medicationStatementHasAtcPrefix(
  ms: Record<string, unknown>,
  atcPrefix: string,
): boolean {
  const codings = flattenCodings(ms.medicationCodeableConcept);
  const p = atcPrefix.toUpperCase();
  return codings.some((cd) => {
    const sys = (cd.system ?? '').toLowerCase();
    const code = typeof cd.code === 'string' ? cd.code : '';
    if (!code) return false;
    if (sys.includes('atc') || sys.includes('whocc')) {
      return code.toUpperCase().startsWith(p);
    }
    return false;
  });
}

function medicationStatementHasTbAtc(ms: Record<string, unknown>): boolean {
  return medicationStatementHasAtcPrefix(ms, ATC_TB_PREFIX);
}

function medicationStatementHasArvAtc(ms: Record<string, unknown>): boolean {
  return medicationStatementHasAtcPrefix(ms, ATC_ARV_PREFIX);
}

function flagHasMeaningfulCode(f: Record<string, unknown>): boolean {
  const code = f.code as Record<string, unknown> | undefined;
  if (!code) return false;
  const text = typeof code.text === 'string' ? code.text.trim() : '';
  if (text.length > 0) return true;
  const codings = flattenCodings(code);
  return codings.length > 0;
}

/** FHIR R4 Flag.status；搜尋端不帶 status 參數時由此過濾「作用中」。 */
function isFlagResourceActive(f: Record<string, unknown>): boolean {
  return f.status === 'active';
}

function buildInfectionCards(params: {
  engine: 'ELM' | 'TS' | 'TS_FALLBACK';
  flags: number;
  tbMeds: number;
  arvMeds: number;
  tbHivConditions: number;
  skip: boolean;
}): CdsHooksResponse {
  const { engine, flags, tbMeds, arvMeds, tbHivConditions, skip } = params;
  const ruleExt = {
    url: EXT_EMERGENCY_RULE,
    valueString: `flags=${flags};tb_atc_meds=${tbMeds};arv_atc_meds=${arvMeds};tb_hiv_conditions=${tbHivConditions};skip_flags=${skip}`,
  };
  const engineExt = { url: EXT_RULE_ENGINE, valueString: engine };

  const reasons: string[] = [];
  if (!skip && flags > 0) reasons.push(`作用中 Flag（病患歷史特殊註記）${flags} 筆`);
  if (tbMeds > 0) reasons.push(`疑似結核相關用藥（ATC ${ATC_TB_PREFIX}*）${tbMeds} 筆`);
  if (arvMeds > 0) reasons.push(`疑似抗病毒／ARV 領藥紀錄（ATC ${ATC_ARV_PREFIX}*）${arvMeds} 筆`);
  if (tbHivConditions > 0) {
    reasons.push(`活動性診斷含 TB／HIV（ICD-10 B20–B24 或 A15–A19）${tbHivConditions} 筆`);
  }

  if (reasons.length > 0) {
    return {
      cards: [
        {
          uuid: randomUUID(),
          summary: '列管／感控相關線索 — 請覆核',
          indicator: 'warning',
          detail: `${reasons.join('；')}。\n（規則為系統預設摘要，務必以院內感控／PDF 為準。）`,
          source: { label: 'Emergency CDS', url: process.env.CDS_GUIDELINE_URL },
          extension: [engineExt, ruleExt],
        },
      ],
    };
  }

  return {
    cards: [
      {
        uuid: randomUUID(),
        summary: '未偵測到感控預設規則之線索',
        indicator: 'info',
        detail:
          `目前未符合${skip ? '（本次設定已忽略 Flag 線索）' : '作用中 Flag'}、ATC J04*／J05*（結核／ARV）用藥、TB／HIV 相關 ICD-10（B20–B24、A15–A19）條件。可調整 EMERGENCY_INFECT_CTRL_SKIP_FLAGS 或擴充規則。`,
        extension: [engineExt],
      },
    ],
  };
}

export async function handleInfectionControlHook(body: CdsHooksRequest): Promise<CdsHooksResponse> {
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

  const pfPatientList = extractBundleResources(pf.patient, 'Patient');
  const pfPatient = pfPatientList[0] ?? null;
  const patientForElm = (pfPatient ?? (await getPatient(patientId))) as Record<string, unknown>;

  const pfFlags = extractBundleResources(pf.flags, 'Flag');
  const flagsRaw = skipFlags()
    ? []
    : pf.flags
      ? pfFlags
      : await searchFlagsForPatient(patientId);
  const flags = flagsRaw.filter(isFlagResourceActive).filter(flagHasMeaningfulCode);

  const pfMs = extractBundleResources(pf.medicationStatements, 'MedicationStatement');
  const medStatements = pf.medicationStatements
    ? pfMs
    : await searchMedicationStatementsForPatient(patientId);

  const pfConds = extractBundleResources(pf.conditions, 'Condition');
  const conditions = pf.conditions ? pfConds : await searchActiveConditions(patientId);

  const tbHivConditions = conditions.filter(conditionMatchesTbHiv);
  const tbMeds = medStatements.filter(medicationStatementHasTbAtc);
  const arvMeds = medStatements.filter(medicationStatementHasArvAtc);

  const useElm = getUseElm();
  let engine: 'ELM' | 'TS' | 'TS_FALLBACK' = useElm ? 'ELM' : 'TS';

  if (useElm) {
    try {
      const elm = await evaluateEmergencyInfectionControlWithElm({
        patient: patientForElm,
        flags,
        medicationStatements: medStatements,
        conditions,
        skipFlags: skipFlags(),
      });
      return buildInfectionCards({
        engine,
        flags: elm.flagCount,
        tbMeds: elm.tbMedCount,
        arvMeds: elm.arvMedCount,
        tbHivConditions: elm.tbHivConditionCount,
        skip: skipFlags(),
      });
    } catch (err) {
      console.error('[infection-control-warning] ELM execution failed, falling back to TS:', formatError(err));
      engine = 'TS_FALLBACK';
    }
  }

  return buildInfectionCards({
    engine,
    flags: flags.length,
    tbMeds: tbMeds.length,
    arvMeds: arvMeds.length,
    tbHivConditions: tbHivConditions.length,
    skip: skipFlags(),
  });
}
