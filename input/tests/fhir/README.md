<!--
更新時間：2026-04-15 15:39
作者：CDS Service
摘要：新增 5 組 FHIR R4 測試資料（transaction Bundle），供 HAPI 匯入與 egfr-check E2E 驗證
-->

# FHIR 測試資料（5 組）

本資料夾提供 5 組 **FHIR R4 transaction Bundle**，可直接匯入本機 HAPI FHIR，作為 `POST /cds-services/egfr-check` 與 `POST /cds-services/ckd-risk` 的 E2E 測試病患資料來源。

## 匯入方式（PowerShell）

請先確認 `.env` 的 `FHIR_BASE_URL` 指向你的 HAPI（例：`http://localhost:9090/fhir`）。

```powershell
$FHIR="http://localhost:9090/fhir"

Invoke-RestMethod -Method Post -Uri "$FHIR" -ContentType "application/fhir+json" -InFile ".\input\tests\fhir\case-01-egfr-low-bad-unit.bundle.json"
Invoke-RestMethod -Method Post -Uri "$FHIR" -ContentType "application/fhir+json" -InFile ".\input\tests\fhir\case-02-egfr-normal.bundle.json"
Invoke-RestMethod -Method Post -Uri "$FHIR" -ContentType "application/fhir+json" -InFile ".\input\tests\fhir\case-03-egfr-boundary-59_9.bundle.json"
Invoke-RestMethod -Method Post -Uri "$FHIR" -ContentType "application/fhir+json" -InFile ".\input\tests\fhir\case-04-egfr-missing-unit.bundle.json"
Invoke-RestMethod -Method Post -Uri "$FHIR" -ContentType "application/fhir+json" -InFile ".\input\tests\fhir\case-05-no-egfr.bundle.json"
```

## 案例一覽

- **case-01**：eGFR 45，單位故意使用 `mL/min/1.73m2`（常見但 UCUM 可能不接受），用來驗證 ELM 路徑的單位正規化與/或 TS 路徑容錯。
- **case-02**：eGFR 65（不觸發複查）。
- **case-03**：eGFR 59.9（邊界值，應觸發複查）。
- **case-04**：eGFR 45，但 valueQuantity **不含 unit/code**（測試缺漏資料）。
- **case-05**：僅 Patient + Creatinine，**沒有 eGFR Observation**（測試「尚無 eGFR」分支）。

> 每個 Bundle 皆用 **PUT** 固定 id（可重複匯入覆蓋），不依賴伺服器自動產生 id，方便在 Postman 直接使用固定 `patientId` 測試。

