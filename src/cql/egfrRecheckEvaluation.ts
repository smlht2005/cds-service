/*
 * 更新時間：2026-04-15 12:05
 * 作者：CDS Service
 * 摘要：註解與 CQL 門檻 UCUM 對齊（'mL/min/1.73/m2'）
 * 更新時間：2026-04-15 09:32
 * 作者：CDS Service
 * 摘要：階段三 — 與 cql/EGFR_Check.cql 對齊的 eGFR 複查評估（最新 eGFR < 60）；待接上 CQL/ELM 引擎時可替換此模組
 */

/** 與 CQL define "Recommendation Summary" / "Recommendation Detail" 對齊 */
export const EGFR_RECOMMENDATION_SUMMARY = '偵測到患者最近一次 eGFR 數值偏低';

export interface EgfrQuantity {
  value: number;
  unit: string;
}

export interface EgfrRecheckResult {
  needsRecheck: boolean;
  /** 用於卡片：有觸發時為 CQL 定義之摘要 */
  recommendationSummary?: string;
  /** 用於卡片：有觸發時為建議內文 */
  recommendationDetail?: string;
}

function observationAllowedStatus(obs: Record<string, unknown>): boolean {
  const s = obs.status;
  if (s === undefined || s === null) return true;
  return s === 'final' || s === 'amended';
}

function readValueQuantity(obs: Record<string, unknown>): EgfrQuantity | null {
  const vq = obs.valueQuantity as { value?: unknown; unit?: string } | undefined;
  if (!vq || typeof vq.value !== 'number' || Number.isNaN(vq.value)) {
    return null;
  }
  return { value: vq.value, unit: (vq.unit ?? '').trim() };
}

/**
 * CQL：Latest eGFR Value < 60 'mL/min/1.73/m2'
 * 實務上 eGFR 單位常為 mL/min/1.73m2；若缺單位仍允許數值與門檻比較（開發資料相容）。
 */
function isBelowThreshold60(q: EgfrQuantity): boolean {
  const u = q.unit.toLowerCase();
  if (!u) {
    return q.value < 60;
  }
  if (u.includes('ml/min')) {
    return q.value < 60;
  }
  return false;
}

/**
 * 依 FHIR Observation（62238-1 之最新一筆）與可選 prefetch 數值，評估是否需要複查建議。
 */
export function evaluateEgfrRecheck(params: {
  egfrObservation: Record<string, unknown> | null;
  prefetchEgfrNumber: number | null;
}): EgfrRecheckResult {
  let q: EgfrQuantity | null = null;

  if (params.egfrObservation && observationAllowedStatus(params.egfrObservation)) {
    q = readValueQuantity(params.egfrObservation);
  }

  if (!q && params.prefetchEgfrNumber !== null) {
    q = { value: params.prefetchEgfrNumber, unit: '' };
  }

  if (!q) {
    return { needsRecheck: false };
  }

  if (!isBelowThreshold60(q)) {
    return { needsRecheck: false };
  }

  const detail = `患者最新 eGFR 為 ${q.value} ${q.unit}，低於正常門檻值 60，建議安排腎功能複查以確認病況發展。`.replace(
    /\s+/g,
    ' ',
  ).trim();

  return {
    needsRecheck: true,
    recommendationSummary: EGFR_RECOMMENDATION_SUMMARY,
    recommendationDetail: detail,
  };
}
