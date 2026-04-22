/*
 * 更新時間：2026-04-20 17:18
 * 作者：CDS Service
 * 更新時間：2026-04-22 10:58
 * 作者：CDS Service
 * 摘要：Phase 4 — fhirSearch 擴充 MedicationRequest（tb-detection 前端 Prefetch 用）。
 *
 * 摘要：前端 emergency prefetch 支援：FHIR search 擴充 Encounter/Flag/MedicationStatement
 */

export type FhirClientError =
  | { kind: 'http'; status: number; statusText: string; bodyText?: string }
  | { kind: 'invalid-json'; status: number; bodyText: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

async function fetchJson(input: string, init: RequestInit = {}): Promise<{ status: number; statusText: string; json: unknown; rawText: string }> {
  const res = await fetch(input, init);
  const rawText = await res.text();
  let json: unknown = null;
  if (rawText) {
    try {
      json = JSON.parse(rawText) as unknown;
    } catch {
      json = null;
    }
  }
  return { status: res.status, statusText: res.statusText, json, rawText };
}

export async function fhirGet(resourcePath: string): Promise<Record<string, unknown>> {
  const { status, statusText, json, rawText } = await fetchJson(`/fhir/${resourcePath.replace(/^\//, '')}`, {
    method: 'GET',
    headers: { Accept: 'application/fhir+json' },
  });
  if (status >= 200 && status < 300) {
    if (!json || !isRecord(json)) {
      const err: FhirClientError = { kind: 'invalid-json', status, bodyText: rawText };
      throw err;
    }
    return json;
  }
  const err: FhirClientError = { kind: 'http', status, statusText, bodyText: rawText };
  throw err;
}

export async function fhirSearch(
  resourceType:
    | 'Condition'
    | 'Observation'
    | 'FamilyMemberHistory'
    | 'Encounter'
    | 'Flag'
    | 'MedicationStatement'
    | 'MedicationRequest',
  query: string,
): Promise<Array<Record<string, unknown>>> {
  const { status, statusText, json, rawText } = await fetchJson(`/fhir/${resourceType}?${query}`, {
    method: 'GET',
    headers: { Accept: 'application/fhir+json' },
  });
  if (status >= 200 && status < 300) {
    if (!json || !isRecord(json) || (json as any).resourceType !== 'Bundle') {
      const err: FhirClientError = { kind: 'invalid-json', status, bodyText: rawText };
      throw err;
    }
    const entry = Array.isArray((json as any).entry) ? (json as any).entry : [];
    return entry.map((e: any) => e?.resource).filter((r: any) => isRecord(r)) as Array<Record<string, unknown>>;
  }
  const err: FhirClientError = { kind: 'http', status, statusText, bodyText: rawText };
  throw err;
}

