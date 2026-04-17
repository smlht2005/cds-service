<!--
更新時間：2026-04-16 16:46
作者：CDS Service
摘要：README.md 補上 CQL→ELM 編譯方式（快速指令），同步更新本檔系統時間戳

更新時間：2026-04-16 16:44
作者：CDS Service
摘要：egfr-check / ckd-risk 兩支 hook handler 補強流程註解（可讀性提升；不影響行為），同步更新本檔系統時間戳

更新時間：2026-04-16 16:41
作者：CDS Service
摘要：補強 ckdComprehensiveHookHandler 的邏輯註解（可讀性提升；不影響行為），同步更新本檔系統時間戳

更新時間：2026-04-16 15:21
作者：CDS Service
摘要：frontend Patient 下拉清單加入 patient-ckd-107（方便驗證 ckd-risk 新增的家族史/AKI warning）

更新時間：2026-04-16 15:07
作者：CDS Service
摘要：ckd-risk 就地升級：新增 AKI（N17*）與家族史 CKD（FamilyMemberHistory + SNOMED 709044004）風險因子與 warning；Discovery/prefetch 同步擴充

更新時間：2026-04-16 14:15
作者：CDS Service
摘要：新增 ckd-comprehensive（第三服務）：CQL/ELM（CKD_Comprehensive）、後端端點與前端 UI；補上 CPG 文件連結

更新時間：2026-04-16 13:27
作者：CDS Service
摘要：新增專案根目錄 README.md（快速導覽）；本檔標題下加入 README 連結；詳盡操作仍以本檔為主

更新時間：2026-04-16 13:16
作者：CDS Service
摘要：QA 補 UI-CKD-02；操作說明第 7 節補 hybrid 驗證步驟；修正 CDS_Hook_UI_Operation 4.4 換行誤植

更新時間：2026-04-16 11:19
作者：CDS Service
摘要：文件同步：CDS_Hook_UI_Operation.md 與 qa/ui_operation_qa.md 更新為「單一 Prefetch（依服務切換）」與 ckd-risk hybrid；修正常見狀況說明

更新時間：2026-04-16 10:57
作者：CDS Service
摘要：frontend Prefetch 開關整併為單一控制（依服務切換）；標題列縮短高度（長描述改為 tooltip）；服務說明文案補強

更新時間：2026-04-16 10:29
作者：CDS Service
摘要：ckd-risk v1 改為 hybrid（prefetch 可省略，伺服端向 FHIR 取 Patient/Condition/Observation）；更新 Postman TC-HOOK-02 與文件敘述

更新時間：2026-04-16 10:08
作者：CDS Service
摘要：frontend 標題列應用說明（zh-TW）＋主要欄位 Tooltip；copy/zhTwUi.ts 集中文案

更新時間：2026-04-16 09:48
作者：CDS Service
摘要：frontend UI/UX Pro Max 重構 — theme.ts、JsonBlock／CdsCardView、請求設定卡片、載入列、跳過連結、a11y（MUI v9）

更新時間：2026-04-16 09:43
作者：CDS Service
摘要：新增 docs/qa/ui_operation_qa.md（CDS Hook UI 操作／Prefetch 開關詳細 QA）；docs/qa/README 加入連結

更新時間：2026-04-16 09:27
作者：CDS Service
摘要：frontend egfr-check 依 Discovery 自 FHIR 組 prefetch（patient/latestEgfr/latestCreatinine）；Postman E2E 新增 TC-PF-03；更新 CDS_Hook_UI_Operation.md

更新時間：2026-04-16 09:16
作者：CDS Service
摘要：docs/CDS_Hook_UI_Operation.md 補充 Prefetch (stub) 與 egfr-check 後端辨識欄位之對照說明

更新時間：2026-04-16 09:02
作者：CDS Service
摘要：新增 docs/CDS_Hook_UI_Operation.md（前端 CDS Hook UI 操作說明）；架構文件與 Frontend 章節加入連結

更新時間：2026-04-15 18:35
作者：CDS Service
摘要：docs/qa/README.md 補充 ckd-risk v1 前端驗證紀錄（uACR/eGFR warning）與 FHIR 測資更新方式

更新時間：2026-04-15 18:13
作者：CDS Service
摘要：frontend ckd-risk 改為自動從 FHIR 取 Patient/Condition/Observation 組 prefetch（避免 Prefetch required）

更新時間：2026-04-15 18:00
作者：CDS Service
摘要：Postman E2E 補上 ckd-risk v1 完整 prefetch 測試請求（conditions/observations），用於直接驗證 cards 輸出

更新時間：2026-04-15 17:53
作者：CDS Service
摘要：ckd-risk v1 擴充為 CKD 規則集合（flags + eGFR/uACR reminders，prefetch-only）；新增 CKD_Risk.cql/ELM 與路由分離保護 egfr-check

更新時間：2026-04-15 16:50
作者：CDS Service
摘要：新增 frontend（Vite + React + MUI）模擬 patient-view eGFR CDS Hook，自動呼叫 /cds-services/egfr-check 並顯示 cards/RuleEngine

更新時間：2026-04-15 16:19
作者：CDS Service
摘要：docs/qa/README.md 補充 FHIRHelpers（cql/ 與 elm/）在 ELM 執行期的角色與常見錯誤

更新時間：2026-04-15 16:00
作者：CDS Service
摘要：新增 FHIR 測試資料匯入/查詢用 Postman collection（postman/CDS-Service-FHIR-TestData.postman_collection.json）

更新時間：2026-04-15 15:20
作者：CDS Service
摘要：cards.extension 回傳規則引擎標記（ELM/TS）；USE_ELM 真跑 ELM 需搭配 elm/FHIRHelpers.json 與 cql/FHIRHelpers.cql

更新時間：2026-04-15 14:52
作者：CDS Service
摘要：新增 USE_ELM 切換真跑 ELM（cql-execution + cql-exec-fhir）；Postman 呼叫時可切換 TS/ELM

更新時間：2026-04-15 13:09
作者：CDS Service
摘要：新增 postman/CDS-Service-E2E.postman_collection.json（TC-HOOK／TC-PF／TC-ERR）；dev_readme Postman 章節補充

更新時間：2026-04-15 12:11
作者：CDS Service
摘要：新增 docs/qa/README.md（CQL／ELM／UCUM QA 紀錄）；架構文件區加入連結

更新時間：2026-04-15 12:07
作者：CDS Service
摘要：cql/EGFR_Check.cql UCUM 門檻改為 mL/min/1.73/m2；以 Maven（scripts/cql-compile-pom.xml）重產 elm/EGFR_Check.json

更新時間：2026-04-15 11:35
作者：CDS Service
摘要：elm/EGFR_Check.json 以兩空格縮排格式化（JSON.parse／JSON.stringify，語意不變）

更新時間：2026-04-15 11:11
作者：CDS Service
摘要：新增 docs/cql_elm.md（CQL→ELM 編譯與執行期說明）；架構文件區加入連結

更新時間：2026-04-15 09:48
作者：CDS Service
摘要：新增 docs/E2E_Test_Plan.md（E2E 測試計畫）；架構文件區加入連結

更新時間：2026-04-15 09:43
作者：CDS Service
摘要：階段四 — 說明 Fastify 等同教學 Express、複查卡含 links/source.url；環境變數 CDS_GUIDELINE_URL

更新時間：2026-04-15 09:32
作者：CDS Service
摘要：階段三 — CQL 腳本 cql/EGFR_Check.cql 與 TS 對齊評估；Hook 可回傳 eGFR 複查 warning 卡片

更新時間：2026-04-15 09:16
作者：CDS Service
摘要：新增 Postman Collection（postman/CDS-Service.postman_collection.json）與匯入說明

更新時間：2026-04-15 09:09
作者：CDS Service
摘要：步驟二 — Discovery 合併 egfr-check + ckd-risk、POST /cds-services/egfr-check；修正 .env 章節格式

更新時間：2026-04-14 16:56
作者：CDS Service
摘要：新增 dotenv/.env 支援（.env.example、server 入口載入 dotenv/config），以 .env 設定 FHIR_BASE_URL

更新時間：2026-04-14 16:30
作者：CDS Service
摘要：discovery 服務 href 與環境變數 CDS_PUBLIC_BASE_URL 說明

更新時間：2026-04-14 16:29
作者：CDS Service
摘要：補充 cmd `echo %date% %time%` 時間戳與端點驗證說明

更新時間：2026-04-14 16:27
作者：CDS Service
摘要：初版專案說明、FHIR 測試與 CDS discovery/hook 端點；系統時間取自本機 PowerShell Get-Date（台灣本機時區 UTC+8）
-->

# CDS Service（Node.js + Fastify + TypeScript）

**專案快速導覽（README）**：[`README.md`](README.md)

## 系統日期時間（建置／文件更新時請一併更新本段與檔案頂部歷史）

- **記錄時間**：2026-04-16 16:46（台灣本機時區 UTC+8；cmd `echo %date% %time%`：2026/04/16 16:46）

## 需求

- Node.js 18+
- 本機 HAPI FHIR（預設 `http://localhost:9090/fhir`，可設 `FHIR_BASE_URL`）

## 安裝

```powershell
cd "c:\Development\HISCore\CDS Service"
npm install
```

## 指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 開發模式（watch）啟動 CDS Service |
| `npm start` | 啟動 CDS Service（預設 `PORT=3000`、`HOST=0.0.0.0`） |
| `npm run build` | TypeScript 編譯至 `dist/` |
| `npm run test:fhir` | 連線 FHIR 驗證 Patient / eGFR / Creatinine |

## FHIR Client 驗證

需先啟動 HAPI FHIR 並載入測試資料（例如 `patient-ckd-001`）。

```powershell
npm run test:fhir
```

## Postman

1. 啟動 CDS Service：`npm start`；HAPI FHIR 可連（`FHIR_BASE_URL`）。
2. **一般呼叫**：**Import** → [`postman/CDS-Service.postman_collection.json`](postman/CDS-Service.postman_collection.json)  
   - 變數：`baseUrl`、`patientId`
3. **E2E（對應 docs/E2E_Test_Plan.md）**：**Import** → [`postman/CDS-Service-E2E.postman_collection.json`](postman/CDS-Service-E2E.postman_collection.json)  
   - 資料夾：TC-HOOK（主路徑）、TC-PF（Prefetch）、TC-ERR（錯誤路徑；部分需手動停 FHIR 或改 `.env`）  
   - 變數：`baseUrl`、`patientIdCaseA`、`patientIdCaseB`、`patientIdNonExistent`
4. **FHIR 測資（匯入/查詢）**：**Import** → [`postman/CDS-Service-FHIR-TestData.postman_collection.json`](postman/CDS-Service-FHIR-TestData.postman_collection.json)  
   - 資料夾：01 Import（transaction Bundles）、02 Query（GET/SEARCH）  
   - 變數：`fhirBaseUrl`（預設 `http://localhost:9090/fhir`）

## Frontend（patient-view CDS Hooks UI）

獨立前端 UI（Vite + React + MUI），用來模擬 EHR 的 **patient-view** 情境：選取病患後呼叫 CDS Service（`egfr-check`／`ckd-risk`／`ckd-comprehensive`），並以 UI 顯示 cards 與 `RuleEngine` extension。

- **操作說明（控制列、Request／輸出區、ckd-risk 與 egfr-check、`Prefetch from FHIR`）**：[`docs/CDS_Hook_UI_Operation.md`](docs/CDS_Hook_UI_Operation.md)

```powershell
cd "c:\Development\HISCore\CDS Service\frontend"
npm install
npm run dev
```

- 代理設定：`frontend/.env.example` 內 `VITE_CDS_PROXY_TARGET`（預設 `http://127.0.0.1:3000`）

## CDS Hooks

- **Discovery**：`GET http://localhost:3000/cds-services`（回傳 `egfr-check`、`ckd-risk`、`ckd-comprehensive` 三項服務，`prefetch` 使用 `{{context.patientId}}` 範本）
- **eGFR Hook（步驟二）**：`POST http://localhost:3000/cds-services/egfr-check`
- **CKD Hook**：`POST http://localhost:3000/cds-services/ckd-risk`（**CKD 規則集合 v1**：Risk flags + eGFR/uACR missing reminders；**hybrid**：prefetch 可省略，伺服端向 FHIR 補齊）  
- **CKD Comprehensive Hook**：`POST http://localhost:3000/cds-services/ckd-comprehensive`（**CPG + Risk + Testing**；**hybrid**：prefetch 可省略，伺服端向 FHIR 補齊）
  Body 範例（JSON）：

```json
{
  "hook": "patient-view",
  "context": { "patientId": "patient-ckd-001" }
}
```

## 環境變數

| 變數 | 預設 | 說明 |
|------|------|------|
| `FHIR_BASE_URL` | `http://localhost:9090/fhir` | HAPI FHIR base URL |
| `CDS_PUBLIC_BASE_URL` | `http://localhost:3000` | Discovery 中 `href` 的公開基底（勿尾隨 `/`） |
| `CDS_GUIDELINE_URL` | `https://example.org/guidelines` | 複查 warning 卡 `source.url`（可改為院內指引） |
| `USE_ELM` | `false` | 是否改用 **ELM 引擎**（`cql-execution` + `cql-exec-fhir`）執行 `elm/EGFR_Check.json`（egfr-check）、`elm/CKD_Risk.json`（ckd-risk）與 `elm/CKD_Comprehensive.json`（ckd-comprehensive）；失敗會標記 `TS_FALLBACK` |
| `PORT` | `3000` | HTTP 埠 |
| `HOST` | `0.0.0.0` | 綁定位址 |

## 使用 .env（dotenv）

本專案會在啟動時自動載入專案根目錄的 `.env`（透過 `dotenv/config`）。

1. 複製範本：

```powershell
Copy-Item .env.example .env
```

2. 修改 `.env` 中的 `FHIR_BASE_URL` 等設定後再啟動：

```powershell
npm start
```

## 架構文件

- [`hi_level_design.md`](hi_level_design.md) — CDS Hooks / FHIR / CQL 邊界與資料流（階段一）
- [`docs/E2E_Test_Plan.md`](docs/E2E_Test_Plan.md) — **E2E 完整測試計畫**（案例編號、前置條件、錯誤路徑）
- [`docs/cql_elm.md`](docs/cql_elm.md) — **CQL→ELM 編譯指令**（VS Code / Java CLI）、產物路徑與執行期依賴說明
- [`docs/qa/README.md`](docs/qa/README.md) — **CQL／ELM／UCUM QA 紀錄**（問題排查、驗證清單、Maven 重編譯）
- [`docs/qa/ui_operation_qa.md`](docs/qa/ui_operation_qa.md) — **CDS Hook UI 操作／Prefetch 開關詳細 QA**
- [`docs/CDS_Hook_UI_Operation.md`](docs/CDS_Hook_UI_Operation.md) — **CDS Hook 前端 UI 操作說明**（patient-view、prefetch、RuleEngine）
- [`docs/CPG/README-ckd-comprehensive.md`](docs/CPG/README-ckd-comprehensive.md) — **ckd-comprehensive 服務說明**（規則表、ELM 載入、null 原則）
- [`docs/CPG/CKD_Comprehensive_Implementation_Plan.md`](docs/CPG/CKD_Comprehensive_Implementation_Plan.md) — **ckd-comprehensive 實作計畫**（含 critical thinking checklist）

## 階段三：CQL（eGFR 複查）

- **規則腳本**：[`cql/EGFR_Check.cql`](cql/EGFR_Check.cql)（`Needs Recheck`：最新 eGFR 低於 60）
- **執行（目前）**：[`src/cql/egfrRecheckEvaluation.ts`](src/cql/egfrRecheckEvaluation.ts) 為與 CQL 等價之 TypeScript 評估層；後續可改接 CQL/ELM 引擎。
- **行為**：`POST` hook 成功時，除檢驗摘要卡外，若觸發規則會多一張 **warning** 建議卡。

## 階段四：CDS Service 實作（與教學 Express 對照）

- **HTTP 框架**：本專案使用 **Fastify**（[`src/server.ts`](src/server.ts)），職責與教學中的 **Express** 相同：提供 `GET /cds-services`、`POST /cds-services/egfr-check` 等，並解析 JSON body。
- **已整合**：[`src/fhir/fhirClient.ts`](src/fhir/fhirClient.ts)（FHIR）、[`src/cds/cdsServices.ts`](src/cds/cdsServices.ts)（Discovery / `extractEGFRValue`）、[`src/cds/ckdHookHandler.ts`](src/cds/ckdHookHandler.ts)（Prefetch 優先 + FHIR fallback、產生 **Cards**）。
- **Cards**：觸發 eGFR 複查時，warning 卡含 **`source.url`**（指引連結，見 `CDS_GUIDELINE_URL`）與 **`links`**（指向 FHIR 上 eGFR 檢驗查詢 URL）。
- **cql-execution / cql-exec-fhir**：教學中需先將 `.cql` **編譯為 ELM JSON** 再交給 `cql-execution` 執行。目前仍以 **TS 對齊層** 執行與 [`cql/EGFR_Check.cql`](cql/EGFR_Check.cql) 相同決策；若要改為執行 ELM，需另建 CQL→ELM 流程（常見為 Java `cql-to-elm`）並於程式載入 `EGFR_Check.elm.json`。

## 原始碼結構

- `src/server.ts` — 應用程式入口
- `src/fhir/fhirClient.ts` — FHIR HTTP Client
- `src/cds/` — Discovery、`cdsServices.ts`（Prefetch 輔助）、CKD / eGFR hook
- `cql/` — CQL 規則檔（如 `EGFR_Check.cql`）
- `src/cql/` — 與 CQL 對齊之評估模組（過渡至引擎前）
- `src/scripts/test-fhir-client.ts` — FHIR 連線測試腳本
- `postman/CDS-Service.postman_collection.json` — Postman 匯入用 Collection（Discovery + 基本 Hook）
- `postman/CDS-Service-E2E.postman_collection.json` — E2E 測試（TC-HOOK／TC-PF／TC-ERR）
- `docs/E2E_Test_Plan.md` — E2E 測試計畫
- `docs/cql_elm.md` — CQL→ELM 流程與編譯說明
- `docs/qa/README.md` — CQL／ELM／UCUM QA 紀錄
- `docs/qa/ui_operation_qa.md` — CDS Hook UI 操作／Prefetch 詳細 QA
- `docs/CDS_Hook_UI_Operation.md` — CDS Hook 前端 UI 操作說明
