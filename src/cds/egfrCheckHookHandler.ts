/*
 * 更新時間：2026-04-15 17:50
 * 作者：CDS Service
 * 摘要：保留 egfr-check 既有行為（原 handleCkdRiskHook 實作抽出），避免 ckd-risk 擴充影響 egfr-check
 */
import {
  getLatestCreatinine,
  getLatestEGFR,
  getPatient,
} from '../fhir/fhirClient.js';
import { extractEGFRValue } from './cdsServices.js';
import { evaluateEgfrRecheck } from '../cql/egfrRecheckEvaluation.js';
import { evaluateEgfrRecheckWithElm } from '../cql/egfrElmExecutor.js';

export interface CdsHooksRequest {
  hook?: string;
  context?: { patientId?: string };
  prefetch?: Record<string, unknown>;
}

export interface CdsCard {
  uuid?: string;
  summary: string;
  indicator: 'info' | 'warning' | 'critical';
  source?: { label: string; url?: string };
  detail?: string;
  links?: Array<{ label: string; type?: string; url: string }>;
  extension?: Array<{ url: string; valueString?: string }>;
}

export interface CdsHooksResponse {
  cards: CdsCard[];
}

function buildEgfrObservationHistoryUrl(patientLogicalId: string): string {
  const base = (process.env.FHIR_BASE_URL ?? 'http://localhost:9090/fhir').replace(/\/$/, '');
  const p = encodeURIComponent(patientLogicalId);
  return `${base}/Observation?patient=${p}&code=62238-1`;
}

function firstEntryResource(prefetchValue: unknown): Record<string, unknown> | null {
  if (!prefetchValue || typeof prefetchValue !== 'object') return null;
  const obj = prefetchValue as Record<string, unknown>;
  if (obj.resourceType === 'Bundle') {
    const entry = (obj.entry as Array<{ resource?: Record<string, unknown> }> | undefined)?.[0];
    return entry?.resource ?? null;
  }
  if (obj.resourceType) {
    return obj as Record<string, unknown>;
  }
  return null;
}

function stripPatientPrefix(id: string): string {
  if (id.startsWith('Patient/')) return id.slice('Patient/'.length);
  return id;
}

export async function handleEgfrCheckHook(body: CdsHooksRequest): Promise<CdsHooksResponse> {
  const rawId = body.context?.patientId;
  if (!rawId) {
    return {
      cards: [
        {
          summary: '缺少 patientId',
          indicator: 'warning',
          detail: '請在 context 中提供 patientId。',
        },
      ],
    };
  }

  const patientId = stripPatientPrefix(rawId);

  let patient: Record<string, unknown> | null = null;
  const pfPatient = body.prefetch?.patient;
  if (pfPatient) {
    patient = firstEntryResource(pfPatient);
  }
  if (!patient) {
    patient = await getPatient(patientId);
  }

  let egfr = body.prefetch?.latestEgfr ? firstEntryResource(body.prefetch.latestEgfr) : null;
  let crea = body.prefetch?.latestCreatinine ? firstEntryResource(body.prefetch.latestCreatinine) : null;

  const prefetchEgfrNumber = extractEGFRValue(body.prefetch ?? {});

  if (!egfr) {
    egfr = (await getLatestEGFR(patientId)) as Record<string, unknown> | null;
  }
  if (!crea) {
    crea = (await getLatestCreatinine(patientId)) as Record<string, unknown> | null;
  }

  const name = Array.isArray(patient.name) ? (patient.name[0] as { family?: string; given?: string[] }) : undefined;
  const label =
    name?.family || (name?.given && name.given[0])
      ? `${name?.family ?? ''} ${name?.given?.join(' ') ?? ''}`.trim()
      : patientId;

  const egfrQty = egfr?.valueQuantity as { value?: number; unit?: string } | undefined;
  const creaQty = crea?.valueQuantity as { value?: number; unit?: string } | undefined;
  const egfrLine =
    egfrQty != null
      ? `最新 eGFR：${egfrQty.value ?? '?'} ${egfrQty.unit ?? ''}`.trim()
      : prefetchEgfrNumber !== null
        ? `最新 eGFR：${prefetchEgfrNumber}（來自 prefetch 數值；Observation 未完整載入）`
        : '尚無 eGFR（62238-1）';
  const creaLine =
    creaQty != null ? `最新 Creatinine：${creaQty.value ?? '?'} ${creaQty.unit ?? ''}`.trim() : '尚無 Creatinine（2160-0）';

  const useElm = (process.env.USE_ELM ?? '').toLowerCase() === 'true';
  let engine: 'ELM' | 'TS' | 'TS_FALLBACK' = useElm ? 'ELM' : 'TS';

  const recheck = useElm
    ? await (async () => {
        try {
          return await evaluateEgfrRecheckWithElm({
            patient,
            latestEgfr: egfr,
            latestCreatinine: crea,
          });
        } catch {
          engine = 'TS_FALLBACK';
          return evaluateEgfrRecheck({
            egfrObservation: egfr,
            prefetchEgfrNumber: prefetchEgfrNumber,
          });
        }
      })()
    : evaluateEgfrRecheck({
        egfrObservation: egfr,
        prefetchEgfrNumber: prefetchEgfrNumber,
      });

  const engineExtension = [{ url: 'urn:cds-service:rule-engine', valueString: engine }];

  const cards: CdsCard[] = [
    {
      uuid: 'ckd-risk-summary',
      summary: `CKD 相關檢驗 — ${label}`,
      indicator: 'info',
      source: { label: 'CDS Service / FHIR' },
      detail: [egfrLine, creaLine].join('\n'),
      extension: engineExtension,
    },
  ];

  if (recheck.needsRecheck && recheck.recommendationSummary && recheck.recommendationDetail) {
    const guidelineUrl = process.env.CDS_GUIDELINE_URL ?? 'https://example.org/guidelines';

    cards.push({
      uuid: 'egfr-recheck-egfr-check-cql',
      summary: recheck.recommendationSummary,
      indicator: 'warning',
      source: {
        label: '慢性腎臟病臨床決策支援',
        url: guidelineUrl,
      },
      detail: recheck.recommendationDetail,
      extension: engineExtension,
      links: [
        {
          label: '查看檢驗歷史紀錄',
          type: 'absolute',
          url: buildEgfrObservationHistoryUrl(patientId),
        },
      ],
    });
  }

  return { cards };
}

