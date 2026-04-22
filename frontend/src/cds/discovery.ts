/*
 * 更新時間：2026-04-20 15:41
 * 作者：CDS Service
 * 摘要：前端 CDS UI 重構：Discovery 解析（服務清單動態載入）
 */

import type { DiscoveryResponse, DiscoveryService } from './types';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function parseDiscovery(json: unknown): DiscoveryResponse | null {
  if (!isRecord(json)) return null;
  return json as DiscoveryResponse;
}

export function getDiscoveryServices(json: unknown): DiscoveryService[] {
  const d = parseDiscovery(json);
  const services = Array.isArray(d?.services) ? d!.services : [];
  return services.filter((s) => isRecord(s)) as DiscoveryService[];
}

export function getServiceLabel(svc: DiscoveryService): string {
  const id = typeof svc.id === 'string' ? svc.id : '(no-id)';
  const hook = typeof svc.hook === 'string' ? svc.hook : '(no-hook)';
  const title = typeof svc.title === 'string' ? svc.title : '';
  return title ? `${id} — ${title} (${hook})` : `${id} (${hook})`;
}

