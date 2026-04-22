/*
 * 更新時間：2026-04-20 12:15
 * 作者：CDS Service
 * 摘要：急診 72hr-revisit — class 以 CodeableConcept 轉型對齊測資 JSON；period.start 經 FHIRHelpers.ToDateTime
 */

library Emergency_72h_Revisit version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.1.0'

parameter "WindowHours" Integer
parameter "MinEncounters" Integer
parameter "Now" System.DateTime
parameter "ClassCodes" List<System.String>

context Patient

define "WindowStart":
  "Now" - ("WindowHours" * 1 hour)

define function ClassAllowed(encounter Encounter):
  if ClassCodes is null or Count(ClassCodes) = 0 then true
  else encounter.class is not null
    and encounter.class.code is not null
    and exists(ClassCodes CC where CC = encounter.class.code.value)

define function EncounterStart(encounter Encounter):
  if encounter.period is null or encounter.period.start is null then null
  else FHIRHelpers.ToDateTime(encounter.period.start)

define "EncountersInWindow":
  [Encounter] E
    where ClassAllowed(E)
      and EncounterStart(E) is not null
      and EncounterStart(E) >= "WindowStart"
      and EncounterStart(E) <= "Now"

define "EncountersInWindowWithId":
  "EncountersInWindow" E
    where E.id is not null and E.id.value is not null

define "EncountersInWindowNoId":
  "EncountersInWindow" E
    where E.id is null or E.id.value is null

define "DistinctIdCount":
  Count(distinct ("EncountersInWindowWithId" E return E.id.value))

define "NoIdCount":
  Count("EncountersInWindowNoId")

define "CountInWindow":
  Coalesce("DistinctIdCount", 0) + Coalesce("NoIdCount", 0)

define "MeetsThreshold":
  "CountInWindow" >= MinEncounters
