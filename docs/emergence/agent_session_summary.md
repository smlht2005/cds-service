<!--
更新時間：2026-04-21 08:55
作者：CDS Service
摘要：對齊實作事實：`docs/frontend/cds-service_ui.md` 之 `fe-extract-hook-builders` 改為 completed（hookBuilders 已落地）；本摘要同步更新

更新時間：2026-04-20 17:34
作者：CDS Service
摘要：前端 CDS Hook UI 重構：支援急診 target、Discovery 動態服務、急診 prefetch；修正 case-08 Encounter.class；急診卡片移除 source 顯示；補 UI 待辦狀態

更新時間：2026-04-20 15:00
作者：CDS Service
摘要：收斂本次 session；保存 Phase B 計畫檔至 docs/emergence 並更新 todo 狀態；補 .env.example 參數註解與急診計畫檔 todo 狀態

更新時間：2026-04-20 13:58
作者：CDS Service
摘要：Phase B：急診 CQL／ELM、executor、handler 共用 USE_ELM；hi_level_design／dev_readme／cql_elm 更新

更新時間：2026-04-20 11:38
作者：CDS Service
摘要：規則文件／ecr-template 覆核後微修（72hr Encounter.id 去重語意、TS_FALLBACK 錨點、詳設註記）

更新時間：2026-04-20 11:26
作者：CDS Service
摘要：infection_control_warning_rules 擴充急診雙服務與 72hr CQL 草稿；新增 docs/emergence/ecr-template.md

更新時間：2026-04-20 10:37
作者：CDS Service
摘要：補 FHIR case-08～09-1、感控 HIR／B20–B24／J05*、HAPI Flag 502 修正；Postman patientId 須與匯入 bundle 一致之 QA 紀實
-->

# Agent 工作摘要

本輪於既有 CDS Service 專案內新增**第二支 Fastify 程序（急診獨立 CDS）**，實作兩個 `patient-view` 服務（72 小時返診、感控預警），並擴充 FHIR Client、npm 腳本、環境範例、文件與 Postman。後續已補 FHIR 測資、感控規則對齊 HIR／PDF 摘要，以及 **HAPI `Flag?status=`** 之相容修正。

## 已完成

- 急診專用入口與路由：`src/emergency/server.ts`（`npm run start:emergency`／`npm run dev:emergency`）、`src/emergency/routes.ts`（註冊 Discovery 與兩支 POST）。
- 服務定義（Discovery `href`、prefetch）：`src/emergency/emergencyServiceDefinitions.ts`（服務 id：`72hr-revisit`、`infection-control-warning`；感控描述含 Flag／J04*／J05*／ICD B20–B24）。
- Hook 實作：`src/emergency/handlers/revisit72hHookHandler.ts`、`src/emergency/handlers/infectionControlHookHandler.ts`（hybrid：prefetch 優先，不足則呼叫 FHIR；感控含 **ICD-10 B20–B24**、**ATC J05\*** ARV、**J04\*** 結核、作用中 **Flag** 之 client 端過濾）。**`USE_ELM=true`** 時以 ELM（`Infection_Control_Warning`／`Emergency_72h_Revisit`）評估，失敗 **TS_FALLBACK**；cards 含 **`urn:cds-service:rule-engine`**。
- FHIR 查詢擴充：`src/fhir/fhirClient.ts`（`searchEncountersForPatient`、`searchFlagsForPatient` **不帶** `status` query—避免 HAPI-0524、`searchMedicationStatementsForPatient`）。
- 啟動腳本：`package.json`（`dev:emergency`、`start:emergency`）。
- 環境變數範例：`.env.example`（`EMERGENCY_CDS_*`、`EMERGENCY_REVISIT_*`、`EMERGENCY_INFECT_CTRL_SKIP_FLAGS` 等）。
- 開發說明更新：`dev_readme.md`（急診專節、Postman、FHIR case-08／09／09-1 連結、`infection_control_warning_rules.md`、記錄時間）。
- Postman：**專用** collection `postman/CDS-Service-Emergency.postman_collection.json`（Discovery、兩 hook、前綴與缺少 patientId 範例）。
- Postman：E2E collection `postman/CDS-Service-E2E.postman_collection.json` 內新增 **TC-EMERGENCY** 資料夾與變數 `emergencyBaseUrl`（與專用 collection 並存，可擇一使用）。
- FHIR 測資 bundle：`input/tests/fhir/case-08-emergency-72h-revisit-patient-ckd-001.bundle.json`（72hr-revisit）、`case-09-emergency-infection-control-patient-ckd-001.bundle.json`、`case-09-1-emergency-infection-control-patient-ckd-002.bundle.json`（**HIR／感控**，內含 **`Patient/patient-ckd-002`**）；各附同目錄 **README.md**。
- 規則文件：`docs/emergence/infection_control_warning_rules.md`（**兩服務**行為表、HAPI 限制、**CQL 現況與對齊草稿**、`USE_ELM` 差異說明）。
- ECR 範本：`docs/emergence/ecr-template.md`（急診 TS→CQL／ELM 變更請求複製用）。

## 待辦／建議後續

**技術債／可選**

- 尚未於本 repo 建立針對急診 handler 的**單元測試**（專案目前無 vitest／jest；若以 mock FHIR 補測，宜獨立測試目錄，勿將測試邏輯混入正式程式）。
- 若目標 FHIR Server 對 `Encounter?_sort=-date` 等參數支援度不同，可能需依實際伺服器調整查詢（需以連線驗證為準）。**HAPI Flag**：已不使用 `Flag?status=`（多數版本未註冊該 search param），改於 CDS 端依 `resource.status === 'active'` 過濾。

**需院內規格**

- 急診 PDF（[`docs/急診檢傷+臨床決策系統.pdf`](../急診檢傷+臨床決策系統.pdf)）之**臨床門檻與術語對照**應以院內文件為準；CQL 若為 SSOT 須另開實作與 ELM 流程。
- 研究規劃中提及之 **`observation-create`**、**`order-select`** 類 hook **尚未實作**；對接前需 EHR 端 request 格式與院內同意之觸發條件。

## 本次 Session 結論（Done）

- 已完成 Phase B 急診雙服務之 **CQL／ELM／executor／handler** 與文件收尾，並確認建置可通過（`npm run build`）。
- 已將 Cursor 計畫檔保存至 repo：`docs/emergence/phase_b_急診_elm_4a358509.plan.md`，並依實作事實更新 todo 狀態（`b0`～`b7` completed；`b8-verify-cases` pending）。
- 已更新 `docs/emergence/新cds_server研究規劃.md` 的 `todos.status`（pending → completed）以反映本專案已落地「急診獨立 CDS」與兩支服務之結論。
- 已補齊 `.env.example` 註解，明確說明 `USE_ELM`（含 `TS_FALLBACK`／`urn:cds-service:rule-engine`）與急診參數對服務行為的影響。
- 已完成前端 CDS Hook UI 重構：支援主/急診 target、Discovery 動態服務清單、急診 prefetch（`72hr-revisit`/`infection-control-warning`），並移除急診卡片 `source` 顯示（不顯示 `Emergency CDS`）。
- 已修正 `case-08` 測資 `Encounter.class` 為 FHIR R4 正確結構（Coding），避免 `EMERGENCY_ENCOUNTER_CLASS_CODES=EMER` 時因 class 遺失導致計數為 0。

## TODO 狀態更新（本次變更）

- `docs/emergence/phase_b_急診_elm_4a358509.plan.md`
  - `b0-ecr-design`：completed
  - `b1-cql-infection`：completed
  - `b2-cql-72hr`：completed
  - `b3-compile-elm`：completed
  - `b4-executor-infection`：completed
  - `b5-executor-72hr`：completed
  - `b6-handlers`：completed
  - `b7-env-docs`：completed
  - `b8-verify-cases`：pending（尚未留下實際驗證紀錄）
- `docs/emergence/新cds_server研究規劃.md`
  - `analyze-pdf-hooks`：completed
  - `map-current-architecture`：completed
  - `compare-implementation-options`：completed
  - `draft-execution-plan`：completed

- `docs/frontend/cds-service_ui.md`
  - `fe-scan-discovery-shape`：completed
  - `fe-add-emergency-proxy`：completed
  - `fe-refactor-app-to-discovery-driven`：completed
  - `fe-target-selector-ui`：completed
  - `fe-extract-hook-builders`：completed（`frontend/src/cds/hookBuilders/` 已落地 observation-create / order-select 等 builder，並由 `App.tsx` 整合）
  - `doc-update-emergence-plan`：cancelled（本次改以 `docs/frontend/cds-service_ui.md` 作為前端實作依據，不再回寫 emergence 規劃檔）

## 驗收方式

- 啟動急診程序：`npm run start:emergency`（預設埠見 `.env.example` 之 `EMERGENCY_CDS_PORT`，常為 `3001`）；確認日誌出現 `Emergency CDS Service listening`。
- Discovery：`GET http://127.0.0.1:3001/cds-services`（埠依環境），回應 `services` 應含 `id` 為 `72hr-revisit` 與 `infection-control-warning`。
- Postman：匯入 `postman/CDS-Service-Emergency.postman_collection.json`，設定變數 `emergencyBaseUrl`、`patientId`，依序送 **GET /cds-services**、**POST …/72hr-revisit**、**POST …/infection-control-warning**；預期 HTTP 200 且 body 為 CDS Hooks 形狀之 `cards` 陣列；端點路徑須為 **`/cds-services/infection-control-warning`**（完整拼字）。
- **FHIR 測資與 Postman `patientId` 必須一致**（已驗證）：例如匯入 **case-9.1** 後，hook 請求之 `context.patientId` 須為 **`patient-ckd-002`**（該 bundle 內之 `subject` 皆為此 id）；若變數誤設為 `patient-ckd-102` 等，FHIR 上無對應 Flag／用藥／診斷，回應為 **info** 屬預期行為，非 CDS 錯誤。
- 主程式 CDS（埠 3000）與急診 CDS（埠 3001）可**分開**啟動；驗收急診時**不需**停主程式，但兩者皆需能連線同一 `FHIR_BASE_URL`（與 `.env` 一致）。
- 前端（Chrome）煙霧截圖（本機）：`docs/qa/cds-hook-ui-chrome.png`（`vite preview` + Chrome headless；可確認 Discovery 載入、`patient-view` 請求本文與卡片渲染）
