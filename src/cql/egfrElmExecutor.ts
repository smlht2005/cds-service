/*
 * 更新時間：2026-04-15 15:18
 * 作者：CDS Service
 * 摘要：ELM 執行前正規化 eGFR 單位（mL/min/1.73m2 → mL/min/1.73/m2），避免 UCUM 驗證失敗
 *
 * 更新時間：2026-04-15 15:07
 * 作者：CDS Service
 * 摘要：PatientSource 改用 FHIRv401（對齊 using FHIR 4.0.1 / FHIRHelpers），避免 USE_ELM 誤 fallback
 *
 * 更新時間：2026-04-15 13:20
 * 作者：CDS Service
 * 摘要：以 cql-execution + cql-exec-fhir 執行 elm/EGFR_Check.json（Needs Recheck / Recommendation*）
 *
 * 注意：本模組只負責「規則執行」，不處理 HTTP / FHIR 查詢（由 resolver/handler 負責）。
 */
import fs from 'node:fs';
import path from 'node:path';

import cql from 'cql-execution';
import { PatientSource } from 'cql-exec-fhir';

export interface EgfrElmEvaluationInput {
  patient: Record<string, unknown>;
  latestEgfr: Record<string, unknown> | null;
  latestCreatinine?: Record<string, unknown> | null;
}

export interface EgfrElmEvaluationResult {
  needsRecheck: boolean;
  recommendationSummary?: string;
  recommendationDetail?: string;
}

function normalizeEgfrObservationForElm(
  obs: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!obs) return null;
  const vq = obs.valueQuantity as { unit?: unknown; code?: unknown } | undefined;
  if (!vq) return obs;

  const unit = typeof vq.unit === 'string' ? vq.unit : undefined;
  const code = typeof vq.code === 'string' ? vq.code : undefined;
  const bad = 'mL/min/1.73m2';
  const fixed = 'mL/min/1.73/m2';

  if (unit !== bad && code !== bad) return obs;

  return {
    ...obs,
    valueQuantity: {
      ...(obs.valueQuantity as Record<string, unknown>),
      ...(unit === bad ? { unit: fixed } : null),
      ...(code === bad ? { code: fixed } : null),
    },
  };
}

function readElmLibraryFromDisk(elmPath: string): unknown {
  const raw = fs.readFileSync(elmPath, 'utf8');
  return JSON.parse(raw) as unknown;
}

function buildPatientBundle(input: EgfrElmEvaluationInput): Record<string, unknown> {
  const entry: Array<{ resource: Record<string, unknown> }> = [];

  entry.push({ resource: input.patient });
  const egfrForElm = normalizeEgfrObservationForElm(input.latestEgfr);
  if (egfrForElm) entry.push({ resource: egfrForElm });
  if (input.latestCreatinine) entry.push({ resource: input.latestCreatinine });

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry,
  };
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asBoolean(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

/**
 * 以 ELM 引擎執行 CQL 定義：
 * - Needs Recheck
 * - Recommendation Summary
 * - Recommendation Detail
 */
export async function evaluateEgfrRecheckWithElm(
  input: EgfrElmEvaluationInput,
  options?: { elmPath?: string },
): Promise<EgfrElmEvaluationResult> {
  const egfrElmPath =
    options?.elmPath ??
    path.resolve(process.cwd(), 'elm', 'EGFR_Check.json');
  const fhirHelpersElmPath = path.resolve(process.cwd(), 'elm', 'FHIRHelpers.json');

  const egfrElmJson = readElmLibraryFromDisk(egfrElmPath);
  const fhirHelpersElmJson = readElmLibraryFromDisk(fhirHelpersElmPath);

  const repo = new cql.Repository({
    EGFR_Check: egfrElmJson,
    FHIRHelpers: fhirHelpersElmJson,
  });

  const lib = repo.resolve('EGFR_Check', '1.0.0') ?? new cql.Library(egfrElmJson, repo);
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

  const needsRecheck = asBoolean(exprs?.['Needs Recheck']) ?? false;
  const recommendationSummary = asString(exprs?.['Recommendation Summary']);
  const recommendationDetail = asString(exprs?.['Recommendation Detail']);

  return {
    needsRecheck,
    recommendationSummary,
    recommendationDetail,
  };
}

