import type { CdsHookRequest, CdsHookResponse, OperationOutcome } from '../types/cdsHooks';

export type CdsClientError =
  | { kind: 'network'; message: string }
  | { kind: 'http'; status: number; statusText: string; bodyText?: string }
  | { kind: 'operation-outcome'; status: number; outcome: OperationOutcome }
  | { kind: 'invalid-json'; status: number; bodyText: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isOperationOutcome(v: unknown): v is OperationOutcome {
  return isRecord(v) && v.resourceType === 'OperationOutcome';
}

async function fetchJsonWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ status: number; statusText: string; json: unknown; rawText: string }> {
  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 10_000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
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
  } finally {
    clearTimeout(t);
  }
}

export async function fetchDiscovery(options?: {
  basePath?: string;
  timeoutMs?: number;
}): Promise<unknown> {
  const basePath = options?.basePath ?? '';
  const { status, statusText, json, rawText } = await fetchJsonWithTimeout(
    `${basePath}/cds-services`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeoutMs: options?.timeoutMs,
    },
  );

  if (status >= 200 && status < 300) return json;
  const err: CdsClientError = {
    kind: 'http',
    status,
    statusText,
    bodyText: rawText,
  };
  throw err;
}

export async function callHook(
  serviceId: 'egfr-check' | 'ckd-risk' | string,
  req: CdsHookRequest,
  options?: { basePath?: string; timeoutMs?: number },
): Promise<{ response: CdsHookResponse; rawJson: unknown }> {
  const basePath = options?.basePath ?? '';
  const { status, statusText, json, rawText } = await fetchJsonWithTimeout(
    `${basePath}/cds-services/${serviceId}`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(req),
      timeoutMs: options?.timeoutMs,
    },
  );

  if (status >= 200 && status < 300) {
    if (!json || !isRecord(json) || !Array.isArray((json as any).cards)) {
      const err: CdsClientError = { kind: 'invalid-json', status, bodyText: rawText };
      throw err;
    }
    return { response: json as unknown as CdsHookResponse, rawJson: json };
  }

  if (json && isOperationOutcome(json)) {
    const err: CdsClientError = { kind: 'operation-outcome', status, outcome: json };
    throw err;
  }

  if (json) {
    const err: CdsClientError = {
      kind: 'http',
      status,
      statusText,
      bodyText: rawText,
    };
    throw err;
  }

  const err: CdsClientError = {
    kind: 'http',
    status,
    statusText,
    bodyText: rawText,
  };
  throw err;
}

