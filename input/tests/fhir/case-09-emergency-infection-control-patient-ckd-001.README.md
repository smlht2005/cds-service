<!--
更新時間：2026-04-20 10:15
作者：CDS Service
摘要：case-09 急診 infection-control-warning 測資說明（Flag／ATC J04*／ICD-10 TB）
-->

# case-09：急診 `infection-control-warning`（`patient-ckd-001`）

同目錄 [`case-09-emergency-infection-control-patient-ckd-001.bundle.json`](case-09-emergency-infection-control-patient-ckd-001.bundle.json) 為 **transaction**，內含三類資源（**任一出現**且被 CDS 規則命中即可出 **warning**；本包三筆皆放，方便一次驗證）：

| 資源 | 用途 |
|------|------|
| `Flag/flag-ckd001-ic-test` | `status=active` 且 `code.text` 非空 → 觸發「作用中 Flag」 |
| `MedicationStatement/ms-ckd001-tb-atc` | `medicationCodeableConcept` 含 **WHO ATC**、`code` 以 **J04** 開頭 → 觸發結核用藥線索 |
| `Condition/cond-ckd001-tb-icd10` | **active** + `http://hl7.org/fhir/sid/icd-10` 且 **A15.\***（TB）→ 觸發診斷線索 |

**前提**：FHIR 上已存在 `Patient/patient-ckd-001`。

**匯入**：與 case-08 相同，`POST` 整包至 `FHIR_BASE_URL`（`Content-Type: application/fhir+json`）。

**環境**：若 `.env` 設 `EMERGENCY_INFECT_CTRL_SKIP_FLAGS=true`，則 **Flag 不計**，仍可用 **MedicationStatement** 或 **Condition** 測 warning。

**正式環境**：請以院內 PDF／感控術語替換 `Flag.code` 與診斷／用藥內容；本檔僅供端對端測試。
