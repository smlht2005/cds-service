/*
 * 更新時間：2026-04-16 14:09
 * 作者：CDS Service
 * 摘要：新增 CKD_Comprehensive ELM executor（載入 CKD_Comprehensive + CKD_Risk + FHIRHelpers），回傳五個 CPG define 結果
 */
import fs from 'node:fs';
import path from 'node:path';
import cql from 'cql-execution';
import { PatientSource } from 'cql-exec-fhir';
import type { CkdRiskPrefetchInput } from './ckdRiskElmExecutor.js';

export interface CkdComprehensiveElmResult {
  HighRiskProfile: boolean | null;
  AnnualUACROverdue: boolean | null;
  ImmediateReferralNeeded: boolean | null;
  CriticalTestingGap: boolean | null;
  ComprehensiveRiskScore: number | null;
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

function asBooleanOrNull(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  return null;
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

export async function evaluateCkdComprehensiveWithElm(
  input: CkdRiskPrefetchInput,
  options?: { elmPath?: string },
): Promise<CkdComprehensiveElmResult> {
  const comprehensiveElmPath =
    options?.elmPath ?? path.resolve(process.cwd(), 'elm', 'CKD_Comprehensive.json');
  const ckdElmPath = path.resolve(process.cwd(), 'elm', 'CKD_Risk.json');
  const fhirHelpersElmPath = path.resolve(process.cwd(), 'elm', 'FHIRHelpers.json');

  const comprehensiveElmJson = readElmLibraryFromDisk(comprehensiveElmPath);
  const ckdElmJson = readElmLibraryFromDisk(ckdElmPath);
  const fhirHelpersElmJson = readElmLibraryFromDisk(fhirHelpersElmPath);

  const repo = new cql.Repository({
    CKD_Comprehensive: comprehensiveElmJson,
    CKD_Risk: ckdElmJson,
    FHIRHelpers: fhirHelpersElmJson,
  });

  const lib =
    repo.resolve('CKD_Comprehensive', '1.0.0') ??
    new cql.Library(comprehensiveElmJson as any, repo);
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
    HighRiskProfile: asBooleanOrNull(exprs?.['HighRiskProfile']),
    AnnualUACROverdue: asBooleanOrNull(exprs?.['AnnualUACROverdue']),
    ImmediateReferralNeeded: asBooleanOrNull(exprs?.['ImmediateReferralNeeded']),
    CriticalTestingGap: asBooleanOrNull(exprs?.['CriticalTestingGap']),
    ComprehensiveRiskScore: asNumber(exprs?.['ComprehensiveRiskScore']),
  };
}

