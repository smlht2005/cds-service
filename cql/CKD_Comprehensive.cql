/*
 * 更新時間：2026-04-16 14:12
 * 作者：CDS Service
 * 摘要：修正 tri-state：HighRiskProfile/ComprehensiveRiskScore 遇到 null 不當成 false；AnnualUACROverdue 在 HighRiskProfile=null 時回傳 null
 *
 * 更新時間：2026-04-16 14:09
 * 作者：CDS Service
 * 摘要：新增 CKD_Comprehensive v1（include CKD_Risk），落地 NKF CPG 規則：HighRiskProfile、AnnualUACROverdue、ImmediateReferralNeeded、CriticalTestingGap、ComprehensiveRiskScore
 */
library CKD_Comprehensive version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.1.0'
include CKD_Risk version '1.0.0' called Risk

context Patient

// CPG Source: NKF CKD Guidelines 2023 | Evidence Grade: B
define "HighRiskProfile":
  if (Risk."HasDiabetes" is true)
      or (Risk."HasHypertension" is true)
      or (Risk."AgeOver60" is true)
  then true
  else if (Risk."HasDiabetes" is null)
      or (Risk."HasHypertension" is null)
      or (Risk."AgeOver60" is null)
  then null
  else false

// CPG Source: NKF CKD Guidelines 2023 | Evidence Grade: A
define "AnnualUACROverdue":
  if ("HighRiskProfile" is null) then null
  else ("HighRiskProfile" is true)
    and (Risk."MissinguACR" is true)

// CPG Source: NKF CKD Guidelines 2023 | Evidence Grade: A
define "ImmediateReferralNeeded":
  (Risk."MostRecentEgfrValue" is not null)
    and (Risk."MostRecentEgfrValue" < 30)

// CPG Source: NKF CKD Guidelines 2023 | Evidence Grade: A
define "CriticalTestingGap":
  (Risk."MissingeGFR" is true)
    and (Risk."MissinguACR" is true)

// CPG Source: 综合（風險因子命中數） | Evidence Grade: N/A
define "ComprehensiveRiskScore":
  if (Risk."HasDiabetes" is null)
      or (Risk."HasHypertension" is null)
      or (Risk."HasHeartDisease" is null)
      or (Risk."HasObesity" is null)
      or (Risk."AgeOver60" is null)
  then null
  else (if (Risk."HasDiabetes" is true) then 1 else 0)
    + (if (Risk."HasHypertension" is true) then 1 else 0)
    + (if (Risk."HasHeartDisease" is true) then 1 else 0)
    + (if (Risk."HasObesity" is true) then 1 else 0)
    + (if (Risk."AgeOver60" is true) then 1 else 0)

// TODO v2：納入 egfr-check 趨勢規則（連續兩次 eGFR < 60）
// TODO v2：3 個月持續性判斷（eGFR < 60 AND uACR > 30 持續 ≥ 3 個月 → 確診 CKD 提示）

