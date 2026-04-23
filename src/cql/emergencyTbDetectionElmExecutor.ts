/*
 * 更新時間：2026-04-22 17:50
 * 作者：CDS Service
 * 摘要：PR #3 follow-up：新增 TbActiveDiagnosisCount / TbLatentDiagnosisCount / TbContactCount /
 *       TbInfectionFlagCount 四個精確計數欄位至 EmergencyTbDetectionElmResult，
 *       對應 CQL 中新增的同名 define，讓 handler ELM reasons 使用正確計數（非 TbDiagnosisCount 膨脹值）。
 *
 * 更新時間：2026-04-22 10:54
 * 作者：CDS Service
 * 摘要：Phase 3.3 — 新增 observations 輸入與 TbLabObservationCount 回傳（讓 ELM 成為 TB-Lab-Monitoring 的真相來源）。
 *       per-code 最新值的分組仍留在 handler TS 側，避免 CQL 內 hardcode 多組 NHI/LOINC。
 *
 * 更新時間：2026-04-22 10:14
 * 作者：CDS Service
 * 摘要：Phase 2.2 — 以 cql-execution 執行 elm/Emergency_TB_Detection.json。
 *       由 tbValueSetLoader 建立 cql.CodeService（canonical URL → concept 清單），
 *       再以 PatientSource.FHIRv401 載入 Bundle；對應 CQL define：
 *         HasActiveTbDiagnosis / HasLatentTbDiagnosis / IsTbContact /
 *         HasFirstLineTbMed / HasSecondLineTbMedWithTbDx / HasInfectionControlFlag /
 *         PatientHasTBOrLTBI / TbDiagnosisCount / TbFirstLineMedCount / TbSecondLineMedCount。
 */

import fs from 'node:fs';
import path from 'node:path';
import cql from 'cql-execution';
import { PatientSource } from 'cql-exec-fhir';
import { ensureTbValueSets, getTbValueSet, type TbValueSetKey } from './tbValueSetLoader.js';

export interface EmergencyTbDetectionElmInput {
  patient: Record<string, unknown>;
  conditions: Array<Record<string, unknown>>;
  medicationRequests: Array<Record<string, unknown>>;
  medicationStatements: Array<Record<string, unknown>>;
  flags: Array<Record<string, unknown>>;
  observations?: Array<Record<string, unknown>>;
}

export interface EmergencyTbDetectionElmResult {
  patientHasTbOrLtbi: boolean;
  hasActiveTbDiagnosis: boolean;
  hasLatentTbDiagnosis: boolean;
  isTbContact: boolean;
  hasFirstLineTbMed: boolean;
  hasSecondLineTbMedWithTbDx: boolean;
  hasInfectionControlFlag: boolean;
  /** 全量 TB-Diagnoses 計數（含所有子類型）；detail 顯示請用精確計數欄位。 */
  tbDiagnosisCount: number;
  /** 精確計數：Active TB（A15–A19 / Z16.34），含 resolved 近 2 年。 */
  tbActiveDiagnosisCount: number;
  /** 精確計數：LTBI（R76.1）active 條件。 */
  tbLatentDiagnosisCount: number;
  /** 精確計數：TB Contact（Z20.1）active 條件。 */
  tbContactCount: number;
  /** 精確計數：active Flag 且含有效 code。 */
  tbInfectionFlagCount: number;
  tbFirstLineMedCount: number;
  tbSecondLineMedCount: number;
  tbLabObservationCount: number;
}

const elmCache = new Map<string, unknown>();

function readElmLibraryFromDisk(elmPath: string): unknown {
  if (elmCache.has(elmPath)) return elmCache.get(elmPath)!;
  const raw = fs.readFileSync(elmPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  elmCache.set(elmPath, parsed);
  return parsed;
}

/** MedicationRequest/MedicationStatement 測資常用 medicationCodeableConcept；CQL filter 以 medication 取 CodeableConcept。 */
function normalizeMedicationForElm(res: Record<string, unknown>): Record<string, unknown> {
  if (res.medication != null) return res;
  const mcc = res.medicationCodeableConcept;
  if (mcc != null) {
    return { ...res, medication: mcc };
  }
  return res;
}

function buildBundle(input: EmergencyTbDetectionElmInput): Record<string, unknown> {
  const entry: Array<{ resource: Record<string, unknown> }> = [];
  entry.push({ resource: input.patient });
  for (const c of input.conditions) entry.push({ resource: c });
  for (const mr of input.medicationRequests) entry.push({ resource: normalizeMedicationForElm(mr) });
  for (const ms of input.medicationStatements)
    entry.push({ resource: normalizeMedicationForElm(ms) });
  for (const f of input.flags) entry.push({ resource: f });
  const observations = input.observations ?? [];
  for (const o of observations) entry.push({ resource: o });
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry,
  };
}

function asBoolean(v: unknown): boolean {
  return typeof v === 'boolean' ? v : false;
}

function asInt(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
  return 0;
}

/**
 * 以快取中的 TB ValueSet 建構 cql.CodeService 可用的 ValueSetDictionary。
 * ElM 內 ValueSet 以 canonical URL 當作 id，version 對齊本次匯入之 '2.1'。
 */
function buildTbCodeService(): cql.CodeService {
  const KEYS: TbValueSetKey[] = ['diagnoses', 'medsFirstLine', 'medsSecondLine', 'labMonitoring'];
  const dict: Record<string, Record<string, Array<{ code: string; system: string; version?: string }>>> = {};
  for (const key of KEYS) {
    const e = getTbValueSet(key);
    const version = e.version || '';
    const list = e.rawConcepts.map((c) => ({
      code: c.code,
      system: c.system ?? '',
      version,
    }));
    const perVersion = (dict[e.url] ??= {});
    perVersion[version] = list;
  }
  return new cql.CodeService(dict);
}

export async function evaluateEmergencyTbDetectionWithElm(
  input: EmergencyTbDetectionElmInput,
  options?: { elmPath?: string },
): Promise<EmergencyTbDetectionElmResult> {
  const elmPath =
    options?.elmPath ?? path.resolve(process.cwd(), 'elm', 'Emergency_TB_Detection.json');
  const fhirHelpersElmPath = path.resolve(process.cwd(), 'elm', 'FHIRHelpers.json');

  const mainElm = readElmLibraryFromDisk(elmPath);
  const fhirHelpersElmJson = readElmLibraryFromDisk(fhirHelpersElmPath);

  // TB ValueSet 快取須已就緒（上游 handler 會呼叫 ensureTbValueSets）。
  await ensureTbValueSets();
  const codeService = buildTbCodeService();

  const repo = new cql.Repository({
    Emergency_TB_Detection: mainElm,
    FHIRHelpers: fhirHelpersElmJson,
  });

  const lib =
    repo.resolve('Emergency_TB_Detection', '1.0.0') ?? new cql.Library(mainElm as object, repo);

  const executor = new cql.Executor(lib, codeService);

  const bundle = buildBundle(input);
  const patientSource = PatientSource.FHIRv401();
  patientSource.loadBundles([bundle]);

  const results = await executor.exec(patientSource);
  const patientResultsMap = (results as { patientResults?: Record<string, unknown> }).patientResults;
  const firstPatientId = patientResultsMap ? Object.keys(patientResultsMap)[0] : undefined;
  const exprs = (firstPatientId ? patientResultsMap?.[firstPatientId] : undefined) as
    | Record<string, unknown>
    | undefined;

  return {
    patientHasTbOrLtbi: asBoolean(exprs?.PatientHasTBOrLTBI),
    hasActiveTbDiagnosis: asBoolean(exprs?.HasActiveTbDiagnosis),
    hasLatentTbDiagnosis: asBoolean(exprs?.HasLatentTbDiagnosis),
    isTbContact: asBoolean(exprs?.IsTbContact),
    hasFirstLineTbMed: asBoolean(exprs?.HasFirstLineTbMed),
    hasSecondLineTbMedWithTbDx: asBoolean(exprs?.HasSecondLineTbMedWithTbDx),
    hasInfectionControlFlag: asBoolean(exprs?.HasInfectionControlFlag),
    tbDiagnosisCount: asInt(exprs?.TbDiagnosisCount),
    tbActiveDiagnosisCount: asInt(exprs?.TbActiveDiagnosisCount),
    tbLatentDiagnosisCount: asInt(exprs?.TbLatentDiagnosisCount),
    tbContactCount: asInt(exprs?.TbContactCount),
    tbInfectionFlagCount: asInt(exprs?.TbInfectionFlagCount),
    tbFirstLineMedCount: asInt(exprs?.TbFirstLineMedCount),
    tbSecondLineMedCount: asInt(exprs?.TbSecondLineMedCount),
    tbLabObservationCount: asInt(exprs?.TbLabObservationCount),
  };
}
