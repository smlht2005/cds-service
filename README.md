<!--
更新時間：2026-04-23 11:23
作者：CDS Service
摘要：README 全面更新：主 CDS（egfr-check / ckd-risk / ckd-comprehensive）、急診 CDS（72hr-revisit /
      infection-control-warning / tb-detection）、CQL/ELM 流程、TB 測試矩陣、環境變數索引、目錄結構；
      與 master（PR #2、PR #3 已合併）對齊。

更新時間：2026-04-16 16:46
作者：CDS Service
摘要：README 補上 CQL→ELM 編譯指令（Maven + cql-to-elm-cli）與產物路徑，便於快速上手
-->

# CDS Service

以 **Node.js + Fastify + TypeScript** 實作的 **HL7 CDS Hooks** 服務：對接 **FHIR R4**，提供 **Discovery** 與 **`patient-view` Hook**，回傳臨床決策支援 **Cards**（含 **RuleEngine** 延伸資訊）。支援 **CQL／ELM**（`USE_ELM=true`）與 TypeScript 對齊層；ELM 失敗時自動 **TS_FALLBACK**。

**更完整的安裝、Postman、環境變數與原始碼索引**請見 [`dev_readme.md`](dev_readme.md)。

---

## 服務一覽

### 主 CDS（port 3000，`npm start` / `npm run dev`）

| Hook ID | 端點 | 說明 |
|---------|------|------|
| `egfr-check` | `POST /cds-services/egfr-check` | eGFR 摘要與低 eGFR 複查建議；Prefetch 或後端查 FHIR |
| `ckd-risk` | `POST /cds-services/ckd-risk` | CKD 風險與 eGFR／uACR 缺漏提醒；hybrid prefetch |
| `ckd-comprehensive` | `POST /cds-services/ckd-comprehensive` | CKD 綜合規則（hybrid；可選 ELM `CKD_Comprehensive.cql`） |

### 急診獨立 CDS（port 3001，`npm run start:emergency` / `npm run dev:emergency`）

| Hook ID | 端點 | 說明 |
|---------|------|------|
| `72hr-revisit` | `POST /cds-services/72hr-revisit` | 72 小時內返診偵測；ELM `Emergency_72h_Revisit.cql` |
| `infection-control-warning` | `POST /cds-services/infection-control-warning` | 感控預警；ELM `Infection_Control_Warning.cql` |
| `tb-detection` | `POST /cds-services/tb-detection` | TB／LTBI／接觸者偵測；ELM `Emergency_TB_Detection.cql` |

---

## 技術棧

| 層級 | 技術 |
|------|------|
| 執行時 | Node.js 18+、TypeScript、`tsx` |
| HTTP | Fastify 5 |
| FHIR | `axios` 呼叫 R4 REST；`npm run test:fhir` |
| 規則 | `cql-execution`、`cql-exec-fhir`；產物 `elm/*.json` |
| 前端 | Vite + React + MUI（`frontend/`） |

---

## 快速開始

### 後端

```powershell
git clone <your-repo-url>
cd "CDS Service"
Copy-Item .env.example .env
npm install
npm start
```

預設主 CDS：`http://127.0.0.1:3000`（`.env` 可調 `PORT`／`HOST`）。  
急診 CDS（另開終端）：

```powershell
npm run dev:emergency
```

預設急診：`http://127.0.0.1:3001`（`EMERGENCY_CDS_PORT`）。  
請先啟動可連線的 **FHIR**（預設 `FHIR_BASE_URL=http://localhost:9090/fhir`），並依 Postman 測資匯入資料。

### 前端（可選）

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

代理與 FHIR 基底見 `frontend/.env.example`。

---

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 主 CDS 開發（watch） |
| `npm run dev:emergency` | 急診 CDS 開發（watch，port 3001） |
| `npm start` | 啟動主 CDS |
| `npm run start:emergency` | 啟動急診 CDS |
| `npm run build` | 編譯至 `dist/` |
| `npm run test:fhir` | 驗證 FHIR 連線 |

---

## CQL → ELM

本專案以 **`cql-execution`** 執行 **ELM JSON**；`.cql` 需先編譯為 `elm/*.json`（詳見 [`docs/cql_elm.md`](docs/cql_elm.md)）。

### 流程概念

```
cql/*.cql  ──(Maven cql-to-elm-cli)──►  elm/*.json
                                              │
                                    cql-execution + cql-exec-fhir
                                              │
                              USE_ELM=true 優先；失敗則 TS_FALLBACK
```

### Maven 編譯範例

```powershell
cd "c:\Development\HISCore\CDS Service"

mvn -f scripts/cql-compile-pom.xml exec:java `
  "-Dexec.args=--input cql/Emergency_TB_Detection.cql --output elm/Emergency_TB_Detection.json --format JSON"

mvn -f scripts/cql-compile-pom.xml exec:java `
  "-Dexec.args=--input cql/EGFR_Check.cql --output elm/EGFR_Check.json --format JSON"
```

---

## TB Detection（`tb-detection`）

### 觸發條件（任一符合 → `warning`）

| 條件 | 資源 | 說明 |
|------|------|------|
| Active TB | Condition | A15–A19／Z16.34；active 或 resolved 近 2 年 |
| LTBI | Condition | R76.1；active |
| 接觸者 | Condition | Z20.1；active |
| 一線用藥 | MedicationRequest / Statement | ValueSet `tb-meds-firstline`；active 或 completed 近 180 天 |
| 二線＋TB 診斷 | MedicationRequest / Statement | `tb-meds-secondline` 且須具 Active TB |
| 感控 Flag | Flag | active 且具意義 code／text |

### Safety Labs

**TB-Lab-Monitoring**（NHI：09026C ALT、09025C AST、09015C Cr、08011C CBC、09029C T-Bil）最新值摘要由 handler 組裝於 detail。

### Prefetch

Patient、Condition、MedicationRequest、MedicationStatement、Flag、Observation（缺漏時後端向 FHIR 補齊）。

### 測試案例（case-14～28，USE_ELM=true）

| Case | 預期 indicator |
|------|----------------|
| case-14, 16–18, 20, 22–26, 28 | warning |
| case-15, 19, 21, 27 | info |

詳見 [`docs/tb-detection/test-plan.md`](docs/tb-detection/test-plan.md)。

---

## 環境變數索引

| 變數 | 說明 |
|------|------|
| `FHIR_BASE_URL` | FHIR Server（預設 `http://localhost:9090/fhir`） |
| `USE_ELM` | `true` 啟用 ELM |
| `PORT` / `HOST` | 主 CDS |
| `EMERGENCY_CDS_PORT` / `EMERGENCY_CDS_HOST` | 急診 CDS |
| `EMERGENCY_REVISIT_*` | 72hr-revisit 時間窗與次數 |
| `EMERGENCY_INFECT_CTRL_SKIP_FLAGS` | 感控服務是否略過 Flag |
| `TB_VALUESET_BASE_URL` | TB ValueSet canonical 前綴 |

完整列表見 [`.env.example`](.env.example)。

---

## 文件導覽

| 文件 | 用途 |
|------|------|
| [`dev_readme.md`](dev_readme.md) | 主操作手冊 |
| [`hi_level_design.md`](hi_level_design.md) | 高階設計 |
| [`docs/cql_elm.md`](docs/cql_elm.md) | CQL→ELM |
| [`docs/tb-detection/plan.md`](docs/tb-detection/plan.md) | TB Detection 計畫 |
| [`docs/tb-detection/test-plan.md`](docs/tb-detection/test-plan.md) | TB 測試計畫 |
| [`docs/E2E_Test_Plan.md`](docs/E2E_Test_Plan.md) | E2E |
| [`docs/CDS_Hook_UI_Operation.md`](docs/CDS_Hook_UI_Operation.md) | 前端測試台 |
| [`docs/qa/README.md`](docs/qa/README.md) | QA |

---

## Postman

| Collection | 說明 |
|------------|------|
| [`postman/CDS-Service.postman_collection.json`](postman/CDS-Service.postman_collection.json) | Discovery 與基本 Hook |
| [`postman/CDS-Service-E2E.postman_collection.json`](postman/CDS-Service-E2E.postman_collection.json) | E2E |
| [`postman/CDS-Service-FHIR-TestData.postman_collection.json`](postman/CDS-Service-FHIR-TestData.postman_collection.json) | FHIR 測資 |

---

## 目錄結構（精簡）

```
src/server.ts                 # 主 CDS 入口
src/cds/                      # Discovery、egfr / ckd-risk / ckd-comprehensive
src/emergency/                # 急診 CDS 入口與 handlers
src/fhir/                     # FHIR Client（含 tbFhirClient）
src/cql/                      # ELM executors
cql/、elm/                    # CQL 與 ELM 產物
frontend/                     # 測試台
input/tests/fhir|cds/         # 測資與 CDS payload
postman/、docs/、scripts/
```

---

## 授權與貢獻

本儲存庫為 **private** 專案設定；授權與貢獻流程請依貴單位內部規範辦理。
