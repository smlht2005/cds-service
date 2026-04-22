/*
 * 更新時間：2026-04-22 14:00
 * 作者：CDS Service
 * 摘要：PR #3 Copilot review：移除本地重複的 createFhirInstance，改 import 自 fhirClient.ts，消除重複工廠。
 *
 * 更新時間：2026-04-22 11:35
 * 作者：CDS Service
 * 摘要：新增 searchAllConditionsForPatient（不加 clinical-status 過濾）供 ELM 路徑使用，
 *       讓 ELM 自行依 2yr resolved window 判斷；TS_FALLBACK 仍沿用 fhirClient.searchActiveConditions。
 *
 * 更新時間：2026-04-22 09:22
 * 作者：CDS Service
 * 摘要：新增 TB Detection 服務專用 FHIR 查詢（ValueSet by canonical url、MedicationRequest search），
 *       與 src/fhir/fhirClient.ts 共用 FHIR_BASE_URL 設定但獨立 axios instance，避免動到既有 client。
 */

import { createFhirInstance } from './fhirClient.js';

const defaultBaseUrl = process.env.FHIR_BASE_URL ?? 'http://localhost:9090/fhir';

const fhirInstance = createFhirInstance(defaultBaseUrl);

function extractEntries(data: unknown): Array<Record<string, unknown>> {
  const bundle = data as { entry?: Array<{ resource?: Record<string, unknown> }> } | undefined;
  const entry = Array.isArray(bundle?.entry) ? bundle!.entry! : [];
  return entry.map((e) => e.resource).filter(Boolean) as Array<Record<string, unknown>>;
}

/**
 * 以 canonical URL 取得 ValueSet（必要時再加 version 過濾，預設回傳 Bundle 的第一筆）。
 * 回傳 null 代表找不到。
 */
export async function getValueSetByUrl(
  canonicalUrl: string,
  version?: string,
): Promise<Record<string, unknown> | null> {
  const params: Record<string, string | number> = {
    url: canonicalUrl,
    _count: 1,
  };
  if (version) params.version = version;
  const res = await fhirInstance.get('/ValueSet', { params });
  const resources = extractEntries(res.data);
  return resources[0] ?? null;
}

/**
 * 查詢病患 MedicationRequest（用藥醫令；搭配一線／二線藥物 ValueSet 使用）
 */
export async function searchMedicationRequestsForPatient(
  patientId: string,
  options?: { count?: number },
): Promise<Array<Record<string, unknown>>> {
  const count = options?.count ?? 200;
  const res = await fhirInstance.get('/MedicationRequest', {
    params: {
      patient: patientId,
      _count: count,
    },
  });
  return extractEntries(res.data);
}

/**
 * 查詢病患所有 Condition（不加 clinical-status 過濾），供 ELM 路徑使用。
 * ELM 自行依 2yr resolved window 判斷，TS_FALLBACK 仍以 clinicalStatusActive() 過濾。
 */
export async function searchAllConditionsForPatient(
  patientId: string,
  options?: { count?: number },
): Promise<Array<Record<string, unknown>>> {
  const count = options?.count ?? 200;
  const res = await fhirInstance.get('/Condition', {
    params: {
      patient: patientId,
      _count: count,
    },
  });
  return extractEntries(res.data);
}

/**
 * 查詢病患 Observation（若無法以 code 直接過濾時，呼叫端後續再以 TB-Lab-Monitoring 值集比對）
 */
export async function searchObservationsForPatient(
  patientId: string,
  options?: { count?: number },
): Promise<Array<Record<string, unknown>>> {
  const count = options?.count ?? 100;
  const res = await fhirInstance.get('/Observation', {
    params: {
      patient: patientId,
      _sort: '-date',
      _count: count,
    },
  });
  return extractEntries(res.data);
}
