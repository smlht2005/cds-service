/*
 * 更新時間：2026-04-22 10:52
 * 作者：CDS Service
 * 摘要：Phase 3.3 — 新增 define "TbLabObservationCount"（Count([Observation: "TB-Lab-Monitoring"])）；
 *       讓 ELM 成為「Observation 是否落入 TB-Lab-Monitoring ValueSet」的真相來源。
 *       per-code 最新值（ALT/AST/Cr/CBC/T-Bil）屬於展示層，交由 handler 以同一 ValueSet 快取組裝 detail，
 *       以避免在 CQL 內 hardcode 五組 NHI/LOINC 碼的維運負擔。
 *
 * 更新時間：2026-04-22 10:02
 * 作者：CDS Service
 * 摘要：修正 cql-to-elm 編譯錯誤：
 *       1. Condition.clinicalStatus 為 FHIR.CodeableConcept，不能與 System.String 直接 Equivalent；
 *          改以 codesystem "ConditionClinical" + code "Active"/"Resolved" 宣告後使用 ~。
 *       2. 診斷 ICD 代碼比對原使用 coding.code.value + ReplaceMatches，在 ELM 中 coding 為 list，
 *          demotion 警告將影響比對語義；改以 exists + coding 展開避免型別降階。
 *
 * 更新時間：2026-04-22 09:42
 * 作者：CDS Service
 * 摘要：FHIRHelpers include 版本由 4.0.1 對齊為 4.1.0（配合 elm/FHIRHelpers.json 實際產物版本），以利 Maven cql-to-elm 成功編譯
 *
 * 更新時間：2026-04-22 09:22
 * 作者：CDS Service
 * 摘要：新增 Emergency_TB_Detection（library version 1.0.0）；ValueSet 改以 canonical URL 宣告，對齊本次匯入之 FHIR ValueSet：
 *       - https://fhir.your-hosp.org.tw/ValueSet/tb-diagnoses
 *       - https://fhir.your-hosp.org.tw/ValueSet/tb-meds-firstline
 *       - https://fhir.your-hosp.org.tw/ValueSet/tb-meds-secondline
 *       - https://fhir.your-hosp.org.tw/ValueSet/tb-lab-monitoring
 *
 * 規範依據: 台灣疾管署《結核及愛滋用藥資料自動介接工作說明書 V2.1》
 * CDS Hooks 觸發點: patient-view
 *
 * 備註：本版為「規格／規則單一真相來源」，同時編譯為 elm/Emergency_TB_Detection.json 供 cql-execution 使用；
 *       runtime 另有 TypeScript 對齊層（tbValueSetLoader + tbDetectionHookHandler）作為 TS_FALLBACK。
 */

library Emergency_TB_Detection version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.1.0' called FHIRHelpers

// ── ValueSet 宣告（canonical URL；對齊 FHIR ValueSet.url） ──────────
// 結核相關診斷（A15–A19、Z16.34、R76.1、Z20.1 皆含於同一 ValueSet）
valueset "TB-Diagnoses":
  'https://fhir.your-hosp.org.tw/ValueSet/tb-diagnoses'

// 一線抗結核藥物
valueset "TB-Meds-FirstLine":
  'https://fhir.your-hosp.org.tw/ValueSet/tb-meds-firstline'

// 二線抗結核藥物（觸發需同時存在 TB 診斷）
valueset "TB-Meds-SecondLine":
  'https://fhir.your-hosp.org.tw/ValueSet/tb-meds-secondline'

// 結核安全性監測檢驗（ALT / AST / Creatinine / CBC / T-Bil）
valueset "TB-Lab-Monitoring":
  'https://fhir.your-hosp.org.tw/ValueSet/tb-lab-monitoring'

// ── CodeSystem / Code（FHIR Condition.clinicalStatus） ────────
codesystem "ConditionClinical": 'http://terminology.hl7.org/CodeSystem/condition-clinical'

code "Clinical-Active": 'active' from "ConditionClinical" display 'Active'
code "Clinical-Resolved": 'resolved' from "ConditionClinical" display 'Resolved'

// ── 情境宣告 ──────────────────────────────────────────────────
context Patient

// ══════════════════════════════════════════════════════════════
// 條件一：ICD-10 診斷（以 code 分類切出 Active / LTBI / Contact）
// ══════════════════════════════════════════════════════════════

/*
 * Active TB: A15–A19 或 Z16.34（抗藥性）
 * - active 個案直接列管
 * - resolved 個案近兩年內仍視為須列管
 */
define "HasActiveTbDiagnosis":
  exists (
    [Condition: "TB-Diagnoses"] C
      where (
        exists (
          C.code.coding CC
            where Matches(Upper(ReplaceMatches(CC.code.value, '\\.', '')), '^A1[5-9].*')
              or Upper(ReplaceMatches(CC.code.value, '\\.', '')) = 'Z1634'
        )
      )
        and (
          C.clinicalStatus ~ "Clinical-Active"
            or (
              C.clinicalStatus ~ "Clinical-Resolved"
                and (C.abatement as FHIR.dateTime) >= Today() - 2 years
            )
        )
  )

/*
 * LTBI: R76.1（需要 INH 或 3HP 追蹤）
 */
define "HasLatentTbDiagnosis":
  exists (
    [Condition: "TB-Diagnoses"] C
      where exists (
        C.code.coding CC
          where Upper(ReplaceMatches(CC.code.value, '\\.', '')) = 'R761'
      )
        and C.clinicalStatus ~ "Clinical-Active"
  )

/*
 * TB Contact: Z20.1 / Z201
 */
define "IsTbContact":
  exists (
    [Condition: "TB-Diagnoses"] C
      where exists (
        C.code.coding CC
          where Upper(ReplaceMatches(CC.code.value, '\\.', '')) = 'Z201'
      )
        and C.clinicalStatus ~ "Clinical-Active"
  )

// ══════════════════════════════════════════════════════════════
// 條件二：用藥紀錄（一線 / 二線）
// ══════════════════════════════════════════════════════════════

/*
 * 一線：Isoniazid / Rifampin / Pyrazinamide / Ethambutol / Streptomycin / Rifapentine
 * active 或近 180 天內 completed 皆視為 TB 個案。
 */
define "HasFirstLineTbMed":
  exists (
    [MedicationRequest: medication in "TB-Meds-FirstLine"] MR
      where MR.status = 'active'
        or (
          MR.status = 'completed'
            and MR.authoredOn >= Today() - 180 days
        )
  )
    or
  exists (
    [MedicationStatement: medication in "TB-Meds-FirstLine"] MS
      where MS.status = 'active'
        or (
          MS.status = 'completed'
            and (MS.effective as Period).end >= Today() - 180 days
        )
  )

/*
 * 二線（Bedaquiline/Delamanid/Levofloxacin 等）：非 TB 專用，
 * 必須同時具備 TB 診斷才視為 TB 個案。
 */
define "HasSecondLineTbMedWithTbDx":
  (HasActiveTbDiagnosis)
    and (
      exists (
        [MedicationRequest: medication in "TB-Meds-SecondLine"] MR
          where MR.status = 'active'
      )
        or exists (
          [MedicationStatement: medication in "TB-Meds-SecondLine"] MS
            where MS.status = 'active'
        )
    )

// ══════════════════════════════════════════════════════════════
// 條件三：感控旗標（Flag.status='active' + meaningful code）
// ══════════════════════════════════════════════════════════════

define "HasInfectionControlFlag":
  exists (
    [Flag] F
      where F.status is not null
        and FHIRHelpers.ToString(F.status) = 'active'
        and F.code is not null
        and (
          (F.code.text is not null and Length(F.code.text.value) > 0)
            or exists(F.code.coding)
        )
  )

// ══════════════════════════════════════════════════════════════
// 最終判斷：是否為 TB / LTBI / Contact 個案
// ══════════════════════════════════════════════════════════════

define "PatientHasTBOrLTBI":
  HasActiveTbDiagnosis
    or HasLatentTbDiagnosis
    or IsTbContact
    or HasFirstLineTbMed
    or HasSecondLineTbMedWithTbDx
    or HasInfectionControlFlag

// ══════════════════════════════════════════════════════════════
// 資源擷取：輸出結構化摘要供 CDS Cards detail 使用
// ══════════════════════════════════════════════════════════════

define "TbDiagnosisCount":
  Count([Condition: "TB-Diagnoses"])

define "TbFirstLineMedCount":
  Count([MedicationRequest: medication in "TB-Meds-FirstLine"])
    + Count([MedicationStatement: medication in "TB-Meds-FirstLine"])

define "TbSecondLineMedCount":
  Count([MedicationRequest: medication in "TB-Meds-SecondLine"])
    + Count([MedicationStatement: medication in "TB-Meds-SecondLine"])

/*
 * 安全性監測：取 TB-Lab-Monitoring 值集中各指標最後一筆。
 * 備註：tb-lab-monitoring 使用 NHI 醫令代碼（09026C/09025C/09015C/08011C/09029C），
 *       現場 Observation 也可能為 LOINC；TS 對齊層比對 coding 所有 system。
 */
define "LatestSafetyLabs":
  Last(
    [Observation: "TB-Lab-Monitoring"] O
      sort by effective
  )

/*
 * 安全性監測：落入 TB-Lab-Monitoring ValueSet 的 Observation 筆數（供 ELM 校驗用）。
 * per-code 最新值（ALT/Cr/CBC/AST/T-Bil）的分組與顯示由 handler 於 TS 側組裝。
 */
define "TbLabObservationCount":
  Count([Observation: "TB-Lab-Monitoring"])
