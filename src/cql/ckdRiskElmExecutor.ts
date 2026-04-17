/*
 * 更新時間：2026-04-16 14:59
 * 作者：CDS Service
 * 摘要：CKD_Risk ELM executor 支援 AKI 病史（N17*）與家族史 CKD（FamilyMemberHistory + SNOMED 709044004）；bundle 納入 FamilyMemberHistory
 *
 * 更新時間：2026-04-15 17:50
 * 作者：CDS Service
 * 摘要：以 cql-execution + cql-exec-fhir 執行 elm/CKD_Risk.json（flags + reminders + most-recent values），供 ckd-risk cards 組裝
 *
 * 注意：本模組只負責「規則執行」，不處理 HTTP / FHIR 查詢（由 handler 以 prefetch 提供資料）。
 */
import fs from 'node:fs';
import path from 'node:path';
import cql from 'cql-execution';
import { PatientSource } from 'cql-exec-fhir';

export interface CkdRiskPrefetchInput {
  patient: Record<string, unknown>;
  conditions: Array<Record<string, unknown>>;
  observations: Array<Record<string, unknown>>;
  familyHistories: Array<Record<string, unknown>>;
}

export interface CkdRiskElmResult {
  // risk factor flags
  AgeOver60: boolean | null;
  HasDiabetes: boolean | null;
  HasHypertension: boolean | null;
  HasHeartDisease: boolean | null;
  HasObesity: boolean | null;
  HasAkiHistory: boolean | null;
  HasFamilyHistoryOfCKD: boolean | null;
  FamilyHistoryOrAKI: boolean | null;

  // most recent values
  MostRecentEgfrValue: number | null;
  MostRecentEgfrUnit: string | null;
  MostRecentUacrValue: number | null;
  MostRecentUacrUnit: string | null;

  // reminders
  MissingeGFR: boolean;
  MissinguACR: boolean;
  MissingeGFRRecommendation: string | null;
  MissinguACRRecommendation: string | null;
}

const elmCache = new Map<string, unknown>();

function readElmLibraryFromDisk(elmPath: string): unknown {
  if (elmCache.has(elmPath)) return elmCache.get(elmPath)!;
  const raw = fs.readFileSync(elmPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  elmCache.set(elmPath, parsed);
  return parsed;
}

function buildPatientBundle(input: CkdRiskPrefetchInput): Record<string, unknown> {
  const entry: Array<{ resource: Record<string, unknown> }> = [];
  entry.push({ resource: input.patient });
  for (const c of input.conditions) entry.push({ resource: c });
  for (const o of input.observations) entry.push({ resource: o });
  for (const fh of input.familyHistories) entry.push({ resource: fh });

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry,
  };
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

function asBooleanOrNull(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  return null;
}

function asBoolean(v: unknown): boolean {
  return typeof v === 'boolean' ? v : false;
}

export async function evaluateCkdRiskWithElm(
  input: CkdRiskPrefetchInput,
  options?: { elmPath?: string },
): Promise<CkdRiskElmResult> {
  const ckdElmPath =
    options?.elmPath ?? path.resolve(process.cwd(), 'elm', 'CKD_Risk.json');
  const fhirHelpersElmPath = path.resolve(process.cwd(), 'elm', 'FHIRHelpers.json');

  const ckdElmJson = readElmLibraryFromDisk(ckdElmPath);
  const fhirHelpersElmJson = readElmLibraryFromDisk(fhirHelpersElmPath);

  const repo = new cql.Repository({
    CKD_Risk: ckdElmJson,
    FHIRHelpers: fhirHelpersElmJson,
  });

  const lib = repo.resolve('CKD_Risk', '1.0.0') ?? new cql.Library(ckdElmJson, repo);
  const executor = new cql.Executor(lib);

  const bundle = buildPatientBundle(input);
  const patientSource = PatientSource.FHIRv401();
  patientSource.loadBundles([bundle]);

  const results = await executor.exec(patientSource);
  const patientResultsMap = (results as { patientResults?: Record<string, unknown> }).patientResults;
  const firstPatientId = patientResultsMap ? Object.keys(patientResultsMap)[0] : undefined;
  const exprs = (firstPatientId ? patientResultsMap?.[firstPatientId] : undefined) as
    | Record<string, unknown>
    | undefined;

  return {
    AgeOver60: asBooleanOrNull(exprs?.['AgeOver60']),
    HasDiabetes: asBooleanOrNull(exprs?.['HasDiabetes']),
    HasHypertension: asBooleanOrNull(exprs?.['HasHypertension']),
    HasHeartDisease: asBooleanOrNull(exprs?.['HasHeartDisease']),
    HasObesity: asBooleanOrNull(exprs?.['HasObesity']),
    HasAkiHistory: asBooleanOrNull(exprs?.['HasAkiHistory']),
    HasFamilyHistoryOfCKD: asBooleanOrNull(exprs?.['HasFamilyHistoryOfCKD']),
    FamilyHistoryOrAKI: asBooleanOrNull(exprs?.['FamilyHistoryOrAKI']),

    MostRecentEgfrValue: asNumber(exprs?.['MostRecentEgfrValue']),
    MostRecentEgfrUnit: asString(exprs?.['MostRecentEgfrUnit']),
    MostRecentUacrValue: asNumber(exprs?.['MostRecentUacrValue']),
    MostRecentUacrUnit: asString(exprs?.['MostRecentUacrUnit']),

    MissingeGFR: asBoolean(exprs?.['MissingeGFR']),
    MissinguACR: asBoolean(exprs?.['MissinguACR']),
    MissingeGFRRecommendation: asString(exprs?.['MissingeGFRRecommendation']),
    MissinguACRRecommendation: asString(exprs?.['MissinguACRRecommendation']),
  };
}

