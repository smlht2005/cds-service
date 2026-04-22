<!--
更新時間：2026-04-20 10:25
作者：CDS Service
摘要：case-9.1 HIR／急診 PDF 對齊測資（patient-ckd-002：Flag、ARV J05*、ICD B20–B24）
-->

# case-9.1：HIR `infection-control-warning`（`patient-ckd-002`）

對齊院內 **HIR** 與 [`docs/急診檢傷+臨床決策系統.pdf`](../../docs/急診檢傷+臨床決策系統.pdf) 所述資料類型（測試用簡化實體）：

| 資源 | HIR 意涵 |
|------|-----------|
| `Patient/patient-ckd-002` | 測試病患（本 bundle 內含 **PUT**，可獨立匯入） |
| `Flag/flag-ckd002-hir-note` | 病患歷史紀錄中的**特殊註記**（`code.text`） |
| `MedicationStatement/ms-ckd002-arv` | **抗病毒／ARV** 領藥：WHO ATC **`J05*`** |
| `Condition/cond-ckd002-hiv-b22` | 過往／活動診斷：**ICD-10 `B22.7`**（屬 **B20–B24** 愛滋病相關區段） |

**匯入**：`POST` 整包至 `FHIR_BASE_URL`（`Content-Type: application/fhir+json`），與 case-08、case-09 相同。

**驗證 CDS**：`POST …/cds-services/infection-control-warning`，`context.patientId` = `patient-ckd-002`（或 `Patient/patient-ckd-002`），預期 **warning**（可能同時列出 Flag、ARV、診斷多條理由）。

**CQL**：目前 CDS 仍以 **TypeScript** 實作；若 PDF 要求改為 **CQL 單一真理**，請見 [`docs/emergence/infection_control_warning_rules.md`](../../docs/emergence/infection_control_warning_rules.md) 內「CQL 對齊（待實作）」小節。
