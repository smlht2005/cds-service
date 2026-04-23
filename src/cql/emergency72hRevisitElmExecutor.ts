/*
 * 更新時間：2026-04-20 13:55
 * 作者：CDS Service
 * 摘要：以 cql-execution 執行 elm/Emergency_72h_Revisit.json；parameter Now／WindowHours／MinEncounters／ClassCodes；Encounter.class 正規化以對齊 CQL Coding
 */

import fs from 'node:fs';
import path from 'node:path';
import cql from 'cql-execution';
import { PatientSource } from 'cql-exec-fhir';

export interface Emergency72hRevisitElmInput {
  patient: Record<string, unknown>;
  encounters: Array<Record<string, unknown>>;
  windowHours: number;
  minEncounters: number;
  now: Date;
  classAllowCodes: string[];
}

export interface Emergency72hRevisitElmResult {
  countInWindow: number;
  meetsThreshold: boolean;
}

const elmCache = new Map<string, unknown>();

function readElmLibraryFromDisk(elmPath: string): unknown {
  if (elmCache.has(elmPath)) return elmCache.get(elmPath)!;
  const raw = fs.readFileSync(elmPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  elmCache.set(elmPath, parsed);
  return parsed;
}

/** CQL 模型將 Encounter.class 視為 Coding；若僅有 coding[] 則補上頂層 code／system 供 ClassAllowed。 */
function normalizeEncounterForElm(enc: Record<string, unknown>): Record<string, unknown> {
  const encClass = enc.class as { coding?: Array<{ system?: string; code?: string }>; code?: string } | undefined;
  if (!encClass || encClass.code) return enc;
  const first = encClass.coding?.[0];
  if (!first?.code) return enc;
  return {
    ...enc,
    class: {
      system: first.system,
      code: first.code,
      display: (first as { display?: string }).display,
    },
  };
}

function buildBundle(input: Emergency72hRevisitElmInput): Record<string, unknown> {
  const entry: Array<{ resource: Record<string, unknown> }> = [];
  entry.push({ resource: input.patient });
  for (const e of input.encounters) entry.push({ resource: normalizeEncounterForElm(e) });
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

export async function evaluateEmergency72hRevisitWithElm(
  input: Emergency72hRevisitElmInput,
  options?: { elmPath?: string },
): Promise<Emergency72hRevisitElmResult> {
  const elmPath =
    options?.elmPath ?? path.resolve(process.cwd(), 'elm', 'Emergency_72h_Revisit.json');
  const fhirHelpersElmPath = path.resolve(process.cwd(), 'elm', 'FHIRHelpers.json');

  const mainElm = readElmLibraryFromDisk(elmPath);
  const fhirHelpersElmJson = readElmLibraryFromDisk(fhirHelpersElmPath);

  const repo = new cql.Repository({
    Emergency_72h_Revisit: mainElm,
    FHIRHelpers: fhirHelpersElmJson,
  });

  const lib =
    repo.resolve('Emergency_72h_Revisit', '1.0.0') ?? new cql.Library(mainElm as object, repo);

  const nowDt = cql.DateTime.fromJSDate(input.now);
  const executor = new cql.Executor(lib, undefined, {
    WindowHours: input.windowHours,
    MinEncounters: input.minEncounters,
    Now: nowDt,
    ClassCodes: input.classAllowCodes,
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
    countInWindow: asInt(exprs?.CountInWindow),
    meetsThreshold: asBoolean(exprs?.MeetsThreshold),
  };
}
