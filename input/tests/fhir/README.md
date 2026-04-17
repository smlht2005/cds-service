<!--
更新時間：2026-04-16 14:15
作者：CDS Service
摘要：新增 case-06（ckd-comprehensive）：補齊 patient-ckd-101 的 DM/HTN + uACR + BMI + eGFR<30 測資

更新時間：2026-04-16 14:59
作者：CDS Service
摘要：新增 case-07（ckd-risk 擴充因子）：AKI（N17*）+ FamilyMemberHistory CKD（SNOMED 709044004），用於驗證新增 warning

更新時間：2026-04-16 15:29
作者：CDS Service
摘要：更新 case-01~05（patient-ckd-101~105）補齊 FamilyMemberHistory 與 ICD-10 既往史條件，避免 ckd-risk 新增因子顯示「資料不足」

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
Invoke-RestMethod -Method Post -Uri "$FHIR" -ContentType "application/fhir+json" -InFile ".\input\tests\fhir\case-06-ckd-comprehensive.bundle.json"
Invoke-RestMethod -Method Post -Uri "$FHIR" -ContentType "application/fhir+json" -InFile ".\input\tests\fhir\case-07-ckd-risk-family-aki.bundle.json"
```

## 案例一覽

- **case-01**：eGFR 45，單位故意使用 `mL/min/1.73m2`（常見但 UCUM 可能不接受），用來驗證 ELM 路徑的單位正規化與/或 TS 路徑容錯。
- **case-02**：eGFR 65（不觸發複查）。
- **case-03**：eGFR 59.9（邊界值，應觸發複查）。
- **case-04**：eGFR 45，但 valueQuantity **不含 unit/code**（測試缺漏資料）。
- **case-05**：僅 Patient + Creatinine，**沒有 eGFR Observation**（測試「尚無 eGFR」分支）。
- （2026-04-16 更新）**case-01~05** 皆補上：
  - `FamilyMemberHistory`（讓家族史 CKD 可為 true/false，不再為 insufficient）
  - `Condition`（ICD-10 既往史；用於 AKI tri-state，case-01 為 N17.9 其餘為非 N17）
- **case-06**：`ckd-comprehensive` 用：補齊 `patient-ckd-101` 的 **糖尿病(E11)**／**高血壓(I10)**（active Conditions）+ **uACR(9318-7)** + **BMI(39156-5)**，並覆蓋 eGFR 為 **25**（觸發 eGFR < 30 轉介規則）。
- **case-07**：`ckd-risk` 用：`patient-ckd-107` 具 **AKI 病史（ICD-10 N17.9；inactive Condition）** + **家族史 CKD（FamilyMemberHistory.condition：SNOMED 709044004）**，且具 eGFR/uACR/BMI（避免缺檢）用於驗證新增 warning。

> 每個 Bundle 皆用 **PUT** 固定 id（可重複匯入覆蓋），不依賴伺服器自動產生 id，方便在 Postman 直接使用固定 `patientId` 測試。

