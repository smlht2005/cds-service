/*
 * 更新時間：2026-04-14 16:30
 * 作者：CDS Service
 * 摘要：discovery 服務新增 href（CDS Hooks 2.x 呼叫端點），可透過 CDS_PUBLIC_BASE_URL 覆寫
 *
 * 更新時間：2026-04-14 12:00
 * 作者：CDS Service
 * 摘要：CKD CDS Service 定義（hook、prefetch 範本）
 */

/** CDS Hooks discovery 單一 service 描述（精簡欄位） */
export interface CdsServiceDefinition {
  id: string;
  title: string;
  description: string;
  hook: string;
  /** EHR 應 POST CDS 請求至此絕對 URL（HL7 CDS Hooks 2.x） */
  href: string;
  prefetch?: Record<string, string>;
}

const patientPlaceholder = '{{context.patientId}}';

const publicBase = process.env.CDS_PUBLIC_BASE_URL ?? 'http://localhost:3000';

export const ckdRiskService: CdsServiceDefinition = {
  id: 'ckd-risk',
  title: 'CKD 風險提示（Risk factors / Testing）',
  description: 'CKD 風險因子旗標（Age/DM/HTN/Heart/Obesity）與檢測提醒（eGFR/uACR 缺漏）。',
  hook: 'patient-view',
  href: `${publicBase.replace(/\/$/, '')}/cds-services/ckd-risk`,
  prefetch: {
    patient: `Patient/${patientPlaceholder}`,
    conditions: `Condition?patient=${patientPlaceholder}&clinical-status=active`,
    observations: `Observation?patient=${patientPlaceholder}&code=62238-1,33914-3,9318-7,32294-1,39156-5&date=ge{{today-365}}`,
  },
};
