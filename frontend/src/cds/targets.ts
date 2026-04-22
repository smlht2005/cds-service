/*
 * 更新時間：2026-04-20 15:41
 * 作者：CDS Service
 * 摘要：前端 CDS UI 重構：主/急診 CDS 目標切換（以 Vite proxy prefix 區分）
 */

import type { CdsTarget } from './types';

export const CDS_TARGETS: readonly CdsTarget[] = [
  { id: 'main', label: '主 CDS（port 3000）', basePath: '' },
  { id: 'emergency', label: '急診 CDS（port 3001）', basePath: '/emergency-cds-services' },
] as const;

