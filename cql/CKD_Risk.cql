/*
 * 更新時間：2026-04-16 14:59
 * 作者：CDS Service
 * 摘要：擴充風險因子：新增 AKI 病史（ICD-10 N17*）與家族史 CKD（FamilyMemberHistory + SNOMED 709044004）；提供對應旗標供 cards 顯示與測試
 *
 * 更新時間：2026-04-15 17:46
 * 作者：CDS Service
 * 摘要：ckd-risk v1 — CKD 風險因子旗標（Age/DM/HTN/Heart/Obesity）與檢測提醒（eGFR/uACR 缺漏），供 ELM 執行
 */
library CKD_Risk version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.1.0'

context Patient

// -----------------------------
// Helper: active Condition / relevant Observation
// -----------------------------

define "ActiveConditions":
  [Condition] C
    where C.clinicalStatus is not null
      and exists (C.clinicalStatus.coding cc where cc.code.value = 'active')

define "AllConditions":
  [Condition] C

define "AllObservations":
  [Observation] O
    where O.status.value in { 'final', 'amended', 'corrected' }

// -----------------------------
// A. Risk Factor Flags (v1)
// -----------------------------

define "AgeOver60":
  if Patient.birthDate is null then null
  else difference in years between Patient.birthDate.value and Today() > 60

define "HasDiabetes":
  if not exists ("ActiveConditions" C
      where C.code is not null
        and exists (C.code.coding cd
          where cd.system is not null
            and (cd.system.value = 'http://hl7.org/fhir/sid/icd-10-cm' or cd.system.value = 'http://snomed.info/sct')
        )
    ) then null
  else exists ("ActiveConditions" C
      where C.code is not null
        and exists (C.code.coding cd
          where (cd.system.value = 'http://hl7.org/fhir/sid/icd-10-cm' and cd.code is not null and (StartsWith(cd.code.value, 'E10') or StartsWith(cd.code.value, 'E11')))
            or (cd.system.value = 'http://snomed.info/sct' and cd.code is not null and (cd.code.value = '44054006' or cd.code.value = '73211009'))
        )
    )

define "HasHypertension":
  if not exists ("ActiveConditions" C
      where C.code is not null
        and exists (C.code.coding cd
          where cd.system is not null
            and (cd.system.value = 'http://hl7.org/fhir/sid/icd-10-cm' or cd.system.value = 'http://snomed.info/sct')
        )
    ) then null
  else exists ("ActiveConditions" C
      where C.code is not null
        and exists (C.code.coding cd
          where (cd.system.value = 'http://hl7.org/fhir/sid/icd-10-cm' and cd.code is not null and StartsWith(cd.code.value, 'I10'))
            or (cd.system.value = 'http://snomed.info/sct' and cd.code is not null and cd.code.value = '38341003')
        )
    )

define "HasHeartDisease":
  if not exists ("ActiveConditions" C
      where C.code is not null
        and exists (C.code.coding cd
          where cd.system is not null
            and (cd.system.value = 'http://hl7.org/fhir/sid/icd-10-cm' or cd.system.value = 'http://snomed.info/sct')
        )
    ) then null
  else exists ("ActiveConditions" C
      where C.code is not null
        and exists (C.code.coding cd
          where (cd.system.value = 'http://hl7.org/fhir/sid/icd-10-cm' and cd.code is not null and (StartsWith(cd.code.value, 'I25') or StartsWith(cd.code.value, 'I50')))
            or (cd.system.value = 'http://snomed.info/sct' and cd.code is not null and (cd.code.value = '53741008' or cd.code.value = '84114007'))
        )
    )

define "MostRecentBmiObservation":
  Last("AllObservations" O
    where exists (O.code.coding c where c.system.value = 'http://loinc.org' and c.code.value = '39156-5')
    sort by issued
  )

define "MostRecentBmiValue":
  if "MostRecentBmiObservation" is null then null
  else ("MostRecentBmiObservation".value as FHIR.Quantity).value.value

define "HasObesity":
  // prefer BMI >= 30; fallback to ICD-10 E66 (if BMI not available)
  if "MostRecentBmiValue" is not null then ("MostRecentBmiValue" >= 30)
  else
    if not exists ("ActiveConditions" C
        where C.code is not null
          and exists (C.code.coding cd where cd.system.value = 'http://hl7.org/fhir/sid/icd-10-cm')
      ) then null
    else exists ("ActiveConditions" C
        where C.code is not null
          and exists (C.code.coding cd
            where cd.system.value = 'http://hl7.org/fhir/sid/icd-10-cm'
              and cd.code is not null
              and StartsWith(cd.code.value, 'E66')
          )
      )

define "FamilyHistoryOrAKI":
  // v1: deprecated placeholder; v1.1 uses HasAkiHistory + HasFamilyHistoryOfCKD (tri-state)
  if ("HasAkiHistory" is true) or ("HasFamilyHistoryOfCKD" is true) then true
  else if ("HasAkiHistory" is false) and ("HasFamilyHistoryOfCKD" is false) then false
  else null

define "HasAkiHistory":
  // Personal history of acute kidney injury (AKI) — ICD-10 N17*
  // tri-state: if no ICD-10-coded Conditions available -> null (insufficient data)
  if not exists ("AllConditions" C
      where C.code is not null
        and exists (C.code.coding cd
          where cd.system is not null
            and cd.system.value = 'http://hl7.org/fhir/sid/icd-10-cm'
        )
    ) then null
  else exists ("AllConditions" C
      where C.code is not null
        and exists (C.code.coding cd
          where cd.system.value = 'http://hl7.org/fhir/sid/icd-10-cm'
            and cd.code is not null
            and StartsWith(cd.code.value, 'N17')
        )
    )

define "HasFamilyHistoryOfCKD":
  // Family history of CKD — FamilyMemberHistory.condition SNOMED CT 709044004 (Chronic kidney disease)
  // tri-state: if no FamilyMemberHistory provided -> null (insufficient data)
  if not exists ([FamilyMemberHistory] F) then null
  else exists ([FamilyMemberHistory] F
      where exists (F.condition fc
        where fc.code is not null
          and exists (fc.code.coding cd
            where cd.system is not null
              and cd.system.value = 'http://snomed.info/sct'
              and cd.code is not null
              and cd.code.value = '709044004'
          )
      )
    )

// -----------------------------
// B. Testing Reminders (v1)
// Note: Confirmed CKD trend rule (>=3 months) is v2 — DO NOT implement now.
// TODO(v2): ConfirmedCKD = eGFR < 60 AND uACR > 30 sustained >= 3 months
// -----------------------------

define "MostRecentEgfrObservation":
  Last("AllObservations" O
    where exists (O.code.coding c where c.system.value = 'http://loinc.org' and (c.code.value = '62238-1' or c.code.value = '33914-3'))
    sort by issued
  )

define "MostRecentEgfrValue":
  if "MostRecentEgfrObservation" is null then null
  else ("MostRecentEgfrObservation".value as FHIR.Quantity).value.value

define "MostRecentEgfrUnit":
  if "MostRecentEgfrObservation" is null then null
  else ("MostRecentEgfrObservation".value as FHIR.Quantity).unit.value

define "MostRecentUacrObservation":
  Last("AllObservations" O
    where exists (O.code.coding c where c.system.value = 'http://loinc.org' and (c.code.value = '9318-7' or c.code.value = '32294-1'))
    sort by issued
  )

define "MostRecentUacrValue":
  if "MostRecentUacrObservation" is null then null
  else ("MostRecentUacrObservation".value as FHIR.Quantity).value.value

define "MostRecentUacrUnit":
  if "MostRecentUacrObservation" is null then null
  else ("MostRecentUacrObservation".value as FHIR.Quantity).unit.value

define "MissingeGFR":
  "MostRecentEgfrObservation" is null

define "MissinguACR":
  "MostRecentUacrObservation" is null

define "MissingeGFRRecommendation":
  if "MissingeGFR" then 'eGFR not recorded in past 12 months — order eGFR (blood test)' else null

define "MissinguACRRecommendation":
  if "MissinguACR" then 'uACR not recorded in past 12 months — order uACR (urine test)' else null

