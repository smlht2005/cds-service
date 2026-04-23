/*
 * 更新時間：2026-04-20 15:41
 * 作者：CDS Service
 * 摘要：前端 CDS UI 重構：新增 discovery/targets 型別（支援主/急診 server 與 mixed hooks）
 */

export type CdsTargetId = 'main' | 'emergency';

export interface CdsTarget {
  id: CdsTargetId;
  label: string;
  /** 用於 `cdsClient` 的 basePath（前端 proxy prefix） */
  basePath: string;
}

export interface DiscoveryService {
  id?: string;
  hook?: string;
  title?: string;
  description?: string;
  prefetch?: Record<string, string>;
  [k: string]: unknown;
}

export interface DiscoveryResponse {
  services?: DiscoveryService[];
  [k: string]: unknown;
}

