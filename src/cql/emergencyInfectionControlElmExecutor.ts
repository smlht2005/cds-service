/*
 * 更新時間：2026-04-20 13:55
 * 作者：CDS Service
 * 摘要：以 cql-execution 執行 elm/Infection_Control_Warning.json；parameter SkipFlags；供急診 infection-control-warning USE_ELM 分支
 */

import fs from 'node:fs';
import path from 'node:path';
import cql from 'cql-execution';
import { PatientSource } from 'cql-exec-fhir';

export interface EmergencyInfectionControlElmInput {
  patient: Record<string, unknown>;
  flags: Array<Record<string, unknown>>;
  medicationStatements: Array<Record<string, unknown>>;
  conditions: Array<Record<string, unknown>>;
  skipFlags: boolean;
}

export interface EmergencyInfectionControlElmResult {
  hasAlert: boolean;
  flagCount: number;
  tbMedCount: number;
  arvMedCount: number;
  tbHivConditionCount: number;
}

const elmCache = new Map<string, unknown>();

function readElmLibraryFromDisk(elmPath: string): unknown {
  if (elmCache.has(elmPath)) return elmCache.get(elmPath)!;
  const raw = fs.readFileSync(elmPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  elmCache.set(elmPath, parsed);
  return parsed;
}

/** CQL 以 `medication`（CodeableConcept）取 ATC；JSON 測資常用 `medicationCodeableConcept`。 */
function normalizeMedicationStatementForElm(ms: Record<string, unknown>): Record<string, unknown> {
  const mcc = ms.medicationCodeableConcept as Record<string, unknown> | undefined;
  if (mcc && ms.medication == null) {
    return { ...ms, medication: mcc };
  }
  return ms;
}

function buildBundle(input: EmergencyInfectionControlElmInput): Record<string, unknown> {
  const entry: Array<{ resource: Record<string, unknown> }> = [];
  entry.push({ resource: input.patient });
  for (const f of input.flags) entry.push({ resource: f });
  for (const ms of input.medicationStatements) {
    entry.push({ resource: normalizeMedicationStatementForElm(ms) });
  }
  for (const c of input.conditions) entry.push({ resource: c });
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

export async function evaluateEmergencyInfectionControlWithElm(
  input: EmergencyInfectionControlElmInput,
  options?: { elmPath?: string },
): Promise<EmergencyInfectionControlElmResult> {
  const elmPath =
    options?.elmPath ?? path.resolve(process.cwd(), 'elm', 'Infection_Control_Warning.json');
  const fhirHelpersElmPath = path.resolve(process.cwd(), 'elm', 'FHIRHelpers.json');

  const mainElm = readElmLibraryFromDisk(elmPath);
  const fhirHelpersElmJson = readElmLibraryFromDisk(fhirHelpersElmPath);

  const repo = new cql.Repository({
    Infection_Control_Warning: mainElm,
    FHIRHelpers: fhirHelpersElmJson,
  });

  const lib =
    repo.resolve('Infection_Control_Warning', '1.0.0') ?? new cql.Library(mainElm as object, repo);
  const executor = new cql.Executor(lib, undefined, {
    SkipFlags: input.skipFlags,
  });

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
    hasAlert: asBoolean(exprs?.HasAlert),
    flagCount: asInt(exprs?.FlagCount),
    tbMedCount: asInt(exprs?.TbMedCount),
    arvMedCount: asInt(exprs?.ArvMedCount),
    tbHivConditionCount: asInt(exprs?.TbHivConditionCount),
  };
}
