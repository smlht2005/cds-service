<!--
更新時間：2026-04-20 16:48
作者：CDS Service
摘要：修正 Encounter.class 為 FHIR R4 正確結構（Coding：system/code/display），避免匯入後 class 遺失導致 EMER filter 計數為 0

更新時間：2026-04-20 09:52
作者：CDS Service
摘要：case-08 Encounter 測資之匯入說明與 period.start 維護提醒
-->

# case-08：急診 72hr-revisit（`patient-ckd-001`）

- 同目錄 [`case-08-emergency-72h-revisit-patient-ckd-001.bundle.json`](case-08-emergency-72h-revisit-patient-ckd-001.bundle.json) 為 **transaction**：兩筆 `Encounter`（`class.code` = `EMER`；FHIR R4 `Encounter.class` 為 **Coding**），`subject` 為 `Patient/patient-ckd-001`。
- **前提**：FHIR 上已存在 `Patient/patient-ckd-001`（未含於本 bundle，避免覆寫既有病患）。
- **匯入**：以 HAPI 接受之方式 POST 整包至 `$FHIR_BASE_URL`（例如 Postman `CDS-Service-FHIR-TestData` 之 transaction 匯入，或 `POST /` with `Content-Type: application/fhir+json`）。
- **若超過 72 小時**：`revisit72hHookHandler` 只計 `period.start` 落在 \[now−72h, now\] 內之 Encounter；若匯入後多日才測，請編輯 bundle 內兩筆 `period.start`／`period.end` 為「測試當下」之近 48 小時內再匯入。
- **環境變數**：若設定 `EMERGENCY_ENCOUNTER_CLASS_CODES`，須包含 `EMER` 才會計入（本測資已用 `EMER`）。
