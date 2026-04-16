<!--
更新時間：2026-04-16 16:46
作者：CDS Service
摘要：README 補上 CQL→ELM 編譯指令（Maven + cql-to-elm-cli）與產物路徑，便於快速上手
-->

# CDS Service

以 **Node.js + Fastify + TypeScript** 實作的 **HL7 CDS Hooks** 服務：對接 **FHIR R4**，提供 **Discovery** 與 **`patient-view` Hook**，回傳臨床決策支援 **Cards**（含 **RuleEngine** 延伸資訊）。適合與 HAPI FHIR 或院內 FHIR 整合測試。

**更完整的安裝、Postman、環境變數與階段說明**請見 [`dev_readme.md`](dev_readme.md)。

---

## 專案簡介

| 項目 | 說明 |
|------|------|
| **CDS Hooks** | `GET /cds-services` Discovery；`POST /cds-services/egfr-check`、`POST /cds-services/ckd-risk` |
| **egfr-check** | eGFR 摘要與低 eGFR 複查建議；可選 **Prefetch** 或後端自行查 FHIR |
| **ckd-risk（v1）** | CKD 風險與 eGFR／uACR 缺漏提醒；**hybrid**：請求可帶或不帶 prefetch，缺漏時由伺服端向 FHIR 補齊 |
| **規則引擎** | 預設 TypeScript 對齊層；設 `USE_ELM=true` 可改以 **CQL／ELM** 執行（見 `docs/cql_elm.md`） |
| **前端測試台** | `frontend/`：Vite + React + MUI，模擬 EHR **patient-view** 與 Prefetch 開關（見 `docs/CDS_Hook_UI_Operation.md`） |

---

## 技術棧

- **執行**：Node.js 18+、TypeScript、`tsx`
- **HTTP**：Fastify 5
- **FHIR**：`axios` 呼叫 R4 REST；測試腳本 `npm run test:fhir`
- **CQL／ELM（可選）**：`cql-execution`、`cql-exec-fhir`；產物於 `elm/`

---

## 快速開始

```powershell
git clone <your-repo-url>
cd "CDS Service"
Copy-Item .env.example .env
npm install
npm start
```

預設服務位址：`http://127.0.0.1:3000`（可於 `.env` 調整 `PORT`／`HOST`）。  
請先啟動可連線的 **FHIR**（預設 `FHIR_BASE_URL=http://localhost:9090/fhir`），並依 Postman 測資匯入病患／檢驗資料。

### 前端（可選）

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

代理與 FHIR 基底網址見 `frontend/.env.example`。

---

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 開發模式（watch） |
| `npm start` | 啟動 CDS Service |
| `npm run build` | 編譯至 `dist/` |
| `npm run test:fhir` | 驗證 FHIR 連線與關鍵資源讀取 |

---

## CQL → ELM（如何編譯）

本專案以 **`cql-execution`** 執行 **ELM JSON**，因此 `.cql` 需先編譯為 `elm/*.json`（詳細說明見 [`docs/cql_elm.md`](docs/cql_elm.md)）。

### 方式：Maven＋`cql-to-elm-cli`（本專案已附 helper POM）

先安裝 **Java** 與 **Maven**，再於專案根目錄執行：

```powershell
cd "c:\Development\HISCore\CDS Service"
mvn -f scripts/cql-compile-pom.xml exec:java "-Dexec.args=--input cql/EGFR_Check.cql --output elm/EGFR_Check.json --format JSON"
```

- **輸入**：`cql/EGFR_Check.cql`
- **輸出**：`elm/EGFR_Check.json`（ELM JSON）
- 其他規則（如 `CKD_Risk.cql`、`CKD_Comprehensive.cql`）同理：修改 `--input` / `--output` 即可

---

## 文件導覽

| 文件 | 用途 |
|------|------|
| [`dev_readme.md`](dev_readme.md) | **主操作手冊**：Postman、環境變數、架構與原始碼索引 |
| [`hi_level_design.md`](hi_level_design.md) | 高階設計與資料流 |
| [`docs/E2E_Test_Plan.md`](docs/E2E_Test_Plan.md) | E2E 測試計畫 |
| [`docs/cql_elm.md`](docs/cql_elm.md) | CQL→ELM 編譯與執行期 |
| [`docs/CDS_Hook_UI_Operation.md`](docs/CDS_Hook_UI_Operation.md) | Hook 測試台 UI 操作 |
| [`docs/qa/README.md`](docs/qa/README.md) | CQL／ELM／UCUM QA |
| [`docs/qa/ui_operation_qa.md`](docs/qa/ui_operation_qa.md) | UI 與 Prefetch 詳細 QA |

---

## Postman

| Collection | 說明 |
|------------|------|
| [`postman/CDS-Service.postman_collection.json`](postman/CDS-Service.postman_collection.json) | Discovery 與基本 Hook |
| [`postman/CDS-Service-E2E.postman_collection.json`](postman/CDS-Service-E2E.postman_collection.json) | TC-HOOK／TC-PF／TC-ERR |
| [`postman/CDS-Service-FHIR-TestData.postman_collection.json`](postman/CDS-Service-FHIR-TestData.postman_collection.json) | FHIR 測資匯入與查詢 |

---

## 目錄結構（精簡）

```
src/server.ts          # 應用程式入口
src/cds/               # Discovery、egfr-check / ckd-risk Hook
src/fhir/              # FHIR Client
cql/、elm/             # 規則與 ELM 產物
frontend/              # Vite + React 測試台
postman/               # Postman Collections
docs/                  # 設計、E2E、QA、UI 說明
```

---

## 授權與貢獻

本儲存庫為 **private** 專案設定；授權與貢獻流程請依貴單位內部規範辦理。
