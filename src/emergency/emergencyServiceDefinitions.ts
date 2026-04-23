/*
 * 更新時間：2026-04-22 10:35
 * 作者：CDS Service
 * 摘要：Phase 3.1 — emergencyTbDetectionService.prefetch 增補 observations（供 LatestSafetyLabs 卡片）；不改其他服務
 *
 * 更新時間：2026-04-22 09:22
 * 作者：CDS Service
 * 摘要：新增 emergencyTbDetectionService（tb-detection）並 append 至 emergencyDiscoveryServices；不變更既有兩個服務定義
 *
 * 更新時間：2026-04-20 10:25
 * 作者：CDS Service
 * 摘要：Discovery 描述補 HIR：ARV（J05*）、ICD B20–B24
 *
 * 更新時間：2026-04-20 10:05
 * 作者：CDS Service
 * 摘要：infection-control Flag prefetch 移除 status=（與 HAPI Flag 搜尋參數一致）；active 由 CDS 端過濾
 *
 * 更新時間：2026-04-17 11:55
 * 作者：CDS Service
 * 摘要：急診獨立 CDS — patient-view 兩服務 discovery 定義（72hr-revisit、infection-control-warning）
 */

import type { CdsServiceDefinition } from '../cds/ckdServiceDefinition.js';

const patientPlaceholder = '{{context.patientId}}';

const publicBase =
  process.env.EMERGENCY_CDS_PUBLIC_BASE_URL ??
  `http://localhost:${Number(process.env.EMERGENCY_CDS_PORT) || 3001}`;

function baseUrl(): string {
  return publicBase.replace(/\/$/, '');
}

/** 72 小時內高風險重複返診（Encounter 時間窗） */
export const emergencyRevisit72hService: CdsServiceDefinition = {
  id: '72hr-revisit',
  title: '急診：72 小時內高風險重複返診提示',
  description:
    '依最近 Encounter 時間窗偵測短時間內多次就醫（門檻與窗長可經環境變數調整；請對齊院內 PDF 規格）。',
  hook: 'patient-view',
  href: `${baseUrl()}/cds-services/72hr-revisit`,
  prefetch: {
    patient: `Patient/${patientPlaceholder}`,
    recentEncounters: `Encounter?patient=${patientPlaceholder}&_sort=-date&_count=30`,
  },
};

/** 特殊列管／感控相關線索（Flag、用藥、診斷） */
export const emergencyInfectionControlService: CdsServiceDefinition = {
  id: 'infection-control-warning',
  title: '急診：列管／感控預警',
  description:
    '偵測作用中 Flag（歷史註記）、結核用藥（ATC J04*）、ARV／抗病毒（ATC J05*）、HIV／結核 ICD-10（B20–B24、A15–A19）等線索（請對齊院內 PDF／HIR）。',
  hook: 'patient-view',
  href: `${baseUrl()}/cds-services/infection-control-warning`,
  prefetch: {
    patient: `Patient/${patientPlaceholder}`,
    flags: `Flag?patient=${patientPlaceholder}&_count=50`,
    medicationStatements: `MedicationStatement?patient=${patientPlaceholder}&_count=50`,
    conditions: `Condition?patient=${patientPlaceholder}&clinical-status=active`,
  },
};

/** 急診 TB Detection（結核／LTBI／接觸者）— 以 canonical URL ValueSet 驅動 */
export const emergencyTbDetectionService: CdsServiceDefinition = {
  id: 'tb-detection',
  title: '急診：結核／LTBI／接觸者偵測',
  description:
    '依 FHIR ValueSet（tb-diagnoses / tb-meds-firstline / tb-meds-secondline / tb-lab-monitoring）比對診斷與用藥，觸發結核／LTBI／接觸者預警（請對齊院內 PDF／HIR）。',
  hook: 'patient-view',
  href: `${baseUrl()}/cds-services/tb-detection`,
  prefetch: {
    patient: `Patient/${patientPlaceholder}`,
    conditions: `Condition?patient=${patientPlaceholder}&_count=200`,
    medicationRequests: `MedicationRequest?patient=${patientPlaceholder}&_count=200`,
    medicationStatements: `MedicationStatement?patient=${patientPlaceholder}&_count=200`,
    flags: `Flag?patient=${patientPlaceholder}&_count=50`,
    observations: `Observation?patient=${patientPlaceholder}&_sort=-date&_count=200`,
  },
};

export const emergencyDiscoveryServices: CdsServiceDefinition[] = [
  emergencyRevisit72hService,
  emergencyInfectionControlService,
  emergencyTbDetectionService,
];
