/*
 * 更新時間：2026-04-20 12:15
 * 作者：CDS Service
 * 摘要：急診 infection-control-warning — ELM 與 TS 對齊；parameter SkipFlags 置於 context 前
 */

library Infection_Control_Warning version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.1.0'

parameter "SkipFlags" System.Boolean default false

context Patient

define "MeaningfulActiveFlags":
  [Flag] F
    where F.status is not null
      and FHIRHelpers.ToString(F.status) = 'active'
      and F.code is not null
      and (
        (F.code.text is not null and Length(F.code.text.value) > 0)
          or exists(F.code.coding)
      )

define "FlagCount":
  if SkipFlags then 0
  else Count("MeaningfulActiveFlags")

define "TbMedCount":
  Count(
    [MedicationStatement] MS
      where MS.medication is FHIR.CodeableConcept
        and exists(
          ((MS.medication as FHIR.CodeableConcept).coding) C
            where C.code is not null
              and (
                Lower(Coalesce(C.system.value, '')) contains 'atc'
                  or Lower(Coalesce(C.system.value, '')) contains 'whocc'
              )
              and StartsWith(Upper(C.code.value), 'J04')
        )
  )

define "ArvMedCount":
  Count(
    [MedicationStatement] MS
      where MS.medication is FHIR.CodeableConcept
        and exists(
          ((MS.medication as FHIR.CodeableConcept).coding) C
            where C.code is not null
              and (
                Lower(Coalesce(C.system.value, '')) contains 'atc'
                  or Lower(Coalesce(C.system.value, '')) contains 'whocc'
              )
              and StartsWith(Upper(C.code.value), 'J05')
        )
  )

define "TbHivConditionCount":
  Count(
    [Condition] C
      where C.clinicalStatus is not null
        and exists(C.clinicalStatus.coding CC where CC.code.value = 'active')
        and C.code is not null
        and exists(
          C.code.coding CD
            where CD.code is not null
              and (
                Lower(Coalesce(CD.system.value, '')) contains 'icd-10'
                  or Lower(Coalesce(CD.system.value, '')) contains 'icd10'
                  or CD.system.value = 'http://hl7.org/fhir/sid/icd-10'
              )
              and (
                Matches(Upper(ReplaceMatches(CD.code.value, '\\.', '')), '^B2[0-4].*')
                  or Matches(Upper(ReplaceMatches(CD.code.value, '\\.', '')), '^A1[5-9].*')
              )
        )
  )

define "HasAlert":
  ("FlagCount" > 0)
    or ("TbMedCount" > 0)
    or ("ArvMedCount" > 0)
    or ("TbHivConditionCount" > 0)
