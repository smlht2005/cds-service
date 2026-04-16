/*
 * 更新時間：2026-04-15 09:08
 * 作者：CDS Service
 * 摘要：步驟二 — Discovery 與 Prefetch 輔助（extractEGFRValue）；egfr-check 服務定義
 */

import type { CdsServiceDefinition } from './ckdServiceDefinition.js';

const patientPlaceholder = '{{context.patientId}}';

const publicBase = process.env.CDS_PUBLIC_BASE_URL ?? 'http://localhost:3000';

/**
 * CDS Hooks Discovery：eGFR 檢查服務（步驟二規格 id = egfr-check）
 * HL7 CDS Hooks 2.x 使用 title；教學文件中的 name 對應為 title。
 */
export const egfrCheckService: CdsServiceDefinition = {
  id: 'egfr-check',
  title: 'eGFR 腎功能檢查服務',
  description: '偵測病患最新 eGFR，若低於 60 則提供複查建議',
  hook: 'patient-view',
  href: `${publicBase.replace(/\/$/, '')}/cds-services/egfr-check`,
  prefetch: {
    patient: `Patient/${patientPlaceholder}`,
    latestEgfr: `Observation?patient=${patientPlaceholder}&code=62238-1&_sort=-date&_count=1`,
    latestCreatinine: `Observation?patient=${patientPlaceholder}&code=2160-0&_sort=-date&_count=1`,
  },
};

/**
 * Discovery Endpoint 完整回應
 */
export function getDiscoveryResponse(
  services: CdsServiceDefinition[],
): { services: CdsServiceDefinition[] } {
  return { services };
}

function readObservationValueQuantity(obs: Record<string, unknown>): number | null {
  const vq = obs.valueQuantity as { value?: unknown } | undefined;
  if (!vq || typeof vq.value !== 'number' || Number.isNaN(vq.value)) {
    return null;
  }
  return vq.value;
}

/**
 * 從 Prefetch 安全取出 eGFR 數值（LOINC 62238-1 之 Observation）。
 * 支援 search-set Bundle（entry[0].resource）或直接 Observation。
 */
export function extractEGFRValue(prefetchData: unknown): number | null {
  if (!prefetchData || typeof prefetchData !== 'object') {
    return null;
  }
  const pd = prefetchData as Record<string, unknown>;
  if (!pd.latestEgfr || typeof pd.latestEgfr !== 'object') {
    return null;
  }
  const latest = pd.latestEgfr as Record<string, unknown>;

  if (latest.resourceType === 'Bundle') {
    const entry = (latest.entry as Array<{ resource?: Record<string, unknown> }> | undefined)?.[0];
    const observation = entry?.resource;
    if (!observation || observation.resourceType !== 'Observation') {
      return null;
    }
    return readObservationValueQuantity(observation);
  }

  if (latest.resourceType === 'Observation') {
    return readObservationValueQuantity(latest);
  }

  return null;
}
