# CDS Service 工作交接文件

> 交接日期：2026-06-16
> 交接人：—
> 接手人：—
> 交接範圍：全系統

---

## 1. 系統概述

本系統是以 **Node.js + Fastify 5 + TypeScript（ESM，透過 `tsx` 執行）** 實作的 **HL7 CDS Hooks** 服務，對接 **FHIR R4**。對外提供 Discovery 端點與 `patient-view` Hook，回傳臨床決策支援 **Cards**（含 RuleEngine 延伸資訊）。使用對象為院內 HIS／EMR 系統，於醫師開立病人檢視（patient-view）時，即時推送 eGFR／CKD 與急診（72 小時返診、感控、TB）相關提醒。

規則執行支援兩種引擎：純 TypeScript，或編譯後的 **CQL／ELM**（`USE_ELM=true`）；ELM 執行失敗時自動降級為 TS（`TS_FALLBACK`），並將實際引擎標記寫入每張卡片的 `urn:cds-service:rule-engine` extension。

## 2. 鳥瞰架構

```
   HIS / EMR (CDS Hooks Client)        前端測試台 (Vite :5173)
            │  GET /cds-services (Discovery)      │ 經 dev proxy 呼叫
            │  POST /cds-services/<hook-id>        │ /cds-services、
            ▼                                      ▼ /emergency-cds-services、/fhir
 ┌─────────────────────────┬──────────────────────────────┐
 │  主 CDS (port 3000)      │  急診 CDS (port 3001)          │
 │  src/server.ts           │  src/emergency/server.ts       │
 │  - egfr-check            │  - 72hr-revisit                │
 │  - ckd-risk              │  - infection-control-warning   │
 │  - ckd-comprehensive     │  - tb-detection                │
 └─────────────────────────┴──────────────────────────────┘
            │  共用模組
            ▼
   ┌───────────────┬───────────────┬─────────────────────┐
   │ src/cds       │ src/cql       │ src/fhir            │
   │ Handler/Card  │ ELM Executor  │ FHIR Client (axios) │
   │ 服務定義/路由 │ ValueSet 載入 │ tbFhirClient        │
   └───────────────┴───────┬───────┴──────────┬──────────┘
                           │ 載入              │ REST 查詢
                           ▼                   ▼
                   elm/*.json (ELM)     FHIR R4 Server
                   ↑ Maven 編譯          (預設 HAPI :9090)
                   cql/*.cql

技術選型：Node.js 18+ / Fastify 5 / TypeScript（strict、NodeNext ESM）/
          axios / cql-execution + cql-exec-fhir / Vite 8 + React 19 + MUI 9 前端測試台
```

**每個 Hook 的共通流程**：路由以 `postCdsHook` / `postEmergencyCdsHook` 包裝（攔截錯誤回傳 502 OperationOutcome）→ 取 `context.patientId`（`stripPatientPrefix` 去除 `Patient/` 前綴）→ **hybrid prefetch**（prefetch 有就用，缺漏才向 FHIR 查）→ `getUseElm()` 決定引擎 → 回傳 `{ cards }`。

## 3. 原始碼導覽

### src/（後端原始碼，rootDir）
- `server.ts` — 主 CDS 入口；載入 `.env`、啟動 Fastify、註冊主路由（port 3000）
- `scripts/test-fhir-client.ts` — FHIR 連線驗證腳本（`npm run test:fhir`）

### src/cds/（主 CDS）
- `routes.ts` — 註冊 `GET /cds-services` 與三支 POST Hook；`postCdsHook` 統一錯誤處理
- `cdsServices.ts` — Discovery 回應、`egfrCheckService` 定義、`extractEGFRValue`（prefetch 安全取值）
- `ckdServiceDefinition.ts` — `ckdRiskService`、`ckdComprehensiveService` 服務定義與型別
- `egfrCheckHookHandler.ts` — `egfr-check` handler（共通流程的標竿實作；定義 `CdsHooksRequest`/`CdsCard`/`CdsHooksResponse`）
- `ckdHookHandler.ts` — `ckd-risk` handler
- `ckdRiskCardBuilder.ts` — ckd-risk 卡片組裝
- `ckdComprehensiveHookHandler.ts` — `ckd-comprehensive` handler
- `ckdComprehensiveCardBuilder.ts` — ckd-comprehensive 卡片組裝
- `utils.ts` — `stripPatientPrefix`、`getUseElm`、`formatError` 等共用工具

### src/emergency/（急診獨立 CDS）
- `server.ts` — 急診 CDS 入口（port 3001，與主 CDS 並存的第二程序）
- `routes.ts` — 註冊 `GET /cds-services` 與三支急診 Hook
- `emergencyServiceDefinitions.ts` — 三支急診服務的 Discovery 定義
- `handlers/revisit72hHookHandler.ts` — `72hr-revisit`（72 小時返診偵測）
- `handlers/infectionControlHookHandler.ts` — `infection-control-warning`（感控預警）
- `handlers/tbDetectionHookHandler.ts` — `tb-detection`（TB／LTBI／接觸者偵測）

### src/cql/（ELM 規則執行）
- `egfrElmExecutor.ts` — 執行 `elm/EGFR_Check.json`（含 eGFR UCUM 單位正規化）
- `egfrRecheckEvaluation.ts` — eGFR 複查的純 TS 規則（ELM fallback 路徑）
- `ckdRiskElmExecutor.ts`、`ckdComprehensiveElmExecutor.ts` — CKD 對應 ELM 執行
- `emergency72hRevisitElmExecutor.ts`、`emergencyInfectionControlElmExecutor.ts`、`emergencyTbDetectionElmExecutor.ts` — 急診三支 ELM 執行
- `tbValueSetLoader.ts` — TB ValueSet 載入（canonical URL 前綴 `TB_VALUESET_BASE_URL`）

### src/fhir/（FHIR Client）
- `fhirClient.ts` — axios FHIR R4 Client；`createFhirInstance` 工廠、`getPatient`、`getLatestEGFR`、`getLatestCreatinine`、`getObservationsByCode`、`searchActiveConditions`、`searchAllConditions`、`searchFamilyMemberHistory`、`searchObservationsForCkdRisk`、`searchEncountersForPatient`、`searchFlagsForPatient`、`searchMedicationStatementsForPatient`
- `tbFhirClient.ts` — TB 專屬 FHIR Client（沿用 `createFhirInstance` 工廠）

### frontend/（前端測試台，獨立 package.json）
- `vite.config.ts` — Vite dev server 與三組 proxy（`/cds-services`、`/emergency-cds-services`、`/fhir`）
- `src/api/cdsClient.ts` — 呼叫 Discovery／Hook 的 fetch client（含 timeout 與 OperationOutcome 解析）
- `src/types/cdsHooks.ts` — CDS Hooks 請求／回應型別
- `src/main.tsx`、`src/theme.ts`、`src/components/JsonBlock.tsx` — React 介面與 JSON 顯示元件

### 規則資產與其他
- `cql/*.cql` — CQL 規則原始碼（7 支：EGFR_Check、CKD_Risk、CKD_Comprehensive、Emergency_72h_Revisit、Infection_Control_Warning、Emergency_TB_Detection、FHIRHelpers）
- `elm/*.json` — 由 CQL 編譯之 ELM 產物（執行時實際載入者）
- `scripts/cql-compile-pom.xml` — Maven `cql-to-elm-cli` 編譯設定
- `input/tests/{fhir,cds,results}/` — FHIR 測資、CDS payload 與結果
- `postman/` — Postman Collections；`docs/` — 設計與測試文件

## 4. Build 與部署

```powershell
# 安裝與初始化（後端）
npm install
Copy-Item .env.example .env

# 開發（watch 模式，需各開一個終端）
npm run dev              # 主 CDS（port 3000）
npm run dev:emergency    # 急診 CDS（port 3001）

# 啟動
npm start                # 主 CDS
npm run start:emergency  # 急診 CDS

# 編譯與驗證
npm run build            # tsc → dist/
npm run test:fhir        # 驗證 FHIR 連線
```

前端測試台為獨立子專案，安裝與啟動見「6.1 前端測試台（frontend/）執行與使用」。

**環境差異與注意事項：**
- ELM 從 `process.cwd()` 下的 `elm/` 載入並於程序內快取，**必須在 repo 根目錄啟動**。
- 需先啟動可連線的 **FHIR R4 Server**（預設 `http://localhost:9090/fhir`，如本機 HAPI），並依 Postman 測資匯入資料。
- ESM NodeNext：本地 import 須帶 `.js` 副檔名（即使原始碼為 `.ts`）。
- 本專案**無單元測試框架**；驗證依賴 `npm run test:fhir`、Postman、`input/tests/` 測資與前端測試台。

## 5. 設定與環境

設定來源為專案根目錄 `.env`（由 `.env.example` 複製），啟動時以 `dotenv/config` 載入。

| Key | 預設值 | 說明 |
|-----|--------|------|
| `FHIR_BASE_URL` | `http://localhost:9090/fhir` | FHIR R4 Server 位址 |
| `CDS_PUBLIC_BASE_URL` | `http://localhost:3000` | 主 CDS Discovery `href` 公開基底（勿尾隨 `/`） |
| `CDS_GUIDELINE_URL` | `https://example.org/guidelines` | 卡片 `source.url` 指引連結 |
| `USE_ELM` | `false` | `true` 啟用 ELM 引擎；失敗自動降級 `TS_FALLBACK`（主／急診共用） |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | 主 CDS 監聽 |
| `EMERGENCY_CDS_PORT` / `EMERGENCY_CDS_HOST` | `3001` / `0.0.0.0` | 急診 CDS 監聽 |
| `EMERGENCY_CDS_PUBLIC_BASE_URL` | `http://localhost:3001` | 急診 Discovery `href` 公開基底 |
| `EMERGENCY_REVISIT_WINDOW_HOURS` | `72` | 72hr-revisit 時間窗（小時） |
| `EMERGENCY_REVISIT_MIN_ENCOUNTERS` | `2` | 時間窗內 ≥ 此次數才出警示卡 |
| `EMERGENCY_ENCOUNTER_CLASS_CODES` | `EMER` | 可選 Encounter.class 過濾（逗號分隔；空值不過濾） |
| `EMERGENCY_INFECT_CTRL_SKIP_FLAGS` | `false` | `true` 則感控判斷忽略 Flag，只用「用藥＋診斷」 |
| `TB_VALUESET_BASE_URL` | `https://fhir.your-hosp.org.tw` | TB ValueSet canonical URL 前綴（勿尾隨 `/`） |

完整說明見 `.env.example`。

## 6. API 端點

### 主 CDS（port 3000）

| Method | Path | 說明 |
|--------|------|------|
| GET | `/cds-services` | Discovery（egfr-check、ckd-risk、ckd-comprehensive） |
| POST | `/cds-services/egfr-check` | eGFR 摘要與低 eGFR 複查建議 |
| POST | `/cds-services/ckd-risk` | CKD 風險與 eGFR／uACR 缺漏提醒 |
| POST | `/cds-services/ckd-comprehensive` | CKD 綜合規則（可選 ELM） |

### 急診 CDS（port 3001）

| Method | Path | 說明 |
|--------|------|------|
| GET | `/cds-services` | Discovery（72hr-revisit、infection-control-warning、tb-detection） |
| POST | `/cds-services/72hr-revisit` | 72 小時內返診偵測 |
| POST | `/cds-services/infection-control-warning` | 感控預警 |
| POST | `/cds-services/tb-detection` | TB／LTBI／接觸者偵測 |

### 6.1 前端測試台（frontend/）執行與使用

`frontend/` 是 **Vite 8 + React 19 + MUI 9** 的獨立子專案（自帶 `package.json`），用來載入 Discovery、組 `patient-view` payload、呼叫各 Hook，並檢視回傳的 Cards 與 `urn:cds-service:rule-engine` 引擎標記（`ELM` / `TS` / `TS_FALLBACK`）。

**安裝與啟動**（獨立於後端，需另開終端）：

```powershell
cd frontend
npm install
Copy-Item .env.example .env

npm run dev        # vite --host 0.0.0.0；dev server 預設 http://localhost:5173
npm run build      # tsc && vite build → frontend/dist/
npm run preview    # 預覽 build 產物
```

**環境設定（`frontend/.env`）**：

| Key | 預設值 | 說明 |
|-----|--------|------|
| `VITE_CDS_PROXY_TARGET` | `http://127.0.0.1:3000` | 主 CDS proxy 目標 |
| `VITE_EMERGENCY_CDS_PROXY_TARGET` | `http://127.0.0.1:3001` | 急診 CDS proxy 目標 |
| `VITE_FHIR_BASE_URL` | `http://localhost:9090/fhir` | FHIR R4 proxy 目標 |

**Vite dev proxy（`vite.config.ts`，避開瀏覽器 CORS）**：

| 前端路徑 | 轉送目標 | 備註 |
|----------|----------|------|
| `/cds-services` | 主 CDS（3000） | — |
| `/emergency-cds-services` | 急診 CDS（3001） | 去除 `/emergency-cds-services` 前綴 |
| `/fhir` | FHIR（9090） | 去除 `/fhir` 前綴 |

**前置依賴（使用前必須先就緒）**：主 CDS（3000）與／或急診 CDS（3001）；TB 等需回查後端的 Hook 另需 FHIR R4（9090）。後端未啟動時測試台呼叫會出現 network／502 錯誤。

## 7. 外部系統整合

| 服務 | 用途 | 設定鍵值 | 連線方式 |
|------|------|----------|----------|
| FHIR R4 Server（HAPI） | 病人／檢驗／診斷／用藥／Encounter／Flag 等資源查詢（hybrid prefetch 缺漏補齊） | `FHIR_BASE_URL` | axios（`createFhirInstance`，timeout 10s，`application/fhir+json`） |
| FHIR ValueSet（TB） | TB 一線／二線用藥等 ValueSet canonical 解析 | `TB_VALUESET_BASE_URL` | `tbValueSetLoader.ts` + `tbFhirClient.ts` |
| Maven `cql-to-elm-cli` | 將 `cql/*.cql` 編譯為 `elm/*.json`（建置期，非執行期） | `scripts/cql-compile-pom.xml` | 命令列 `mvn exec:java` |

## 8. 特別注意事項 ⚠️

- **無安全認證層**：目前路由未見任何驗證／授權機制（無 API Key／Token／mTLS）；對外部署前須由前置 Gateway 或反向代理補強，避免 FHIR PHI 經未授權端點外洩。
- **`HOST` 預設 `0.0.0.0`**：服務（含前端 `vite --host 0.0.0.0`）預設綁定所有網卡，部署於可信網段外時應收斂為內網位址。
- **ELM 載入路徑相依工作目錄**：`elm/*.json` 以 `process.cwd()` 解析，非根目錄啟動會載入失敗 → 靜默走 `TS_FALLBACK`。
- **CQL/ELM 版本對齊**：ELM executor 使用 `PatientSource.FHIRv401()`，須與 CQL `using FHIR 4.0.1` / `FHIRHelpers` 對齊，否則 `USE_ELM` 會誤判失敗而 fallback。
- **UCUM 單位陷阱**：eGFR 單位 `mL/min/1.73m2` 須正規化為 `mL/min/1.73/m2`（見 `egfrElmExecutor.ts`），否則 ELM 驗證失敗。
- **HAPI 不支援 `Flag?status=`**：`searchFlagsForPatient` 已移除該查詢參數，改由呼叫端依 `resource.status` 過濾 active；接手沿用其他 FHIR 查詢時須留意伺服器支援度。
- **TODO/FIXME 掃描結果（原始碼層級）**：`src/` 內**無** TODO/FIXME/HACK/WORKAROUND。已知標記集中於 CQL 與文件：
  - `cql/CKD_Comprehensive.cql:61` — `TODO v2：納入 egfr-check 趨勢規則（連續兩次 eGFR < 60）`
  - `cql/CKD_Comprehensive.cql:62` — `TODO v2：3 個月持續性判斷（eGFR < 60 AND uACR > 30 持續 ≥ 3 個月 → 確診 CKD 提示）`
  - `cql/CKD_Risk.cql:161` — `TODO(v2): ConfirmedCKD = eGFR < 60 AND uACR > 30 sustained >= 3 months`
  - `cql/FHIRHelpers.cql:198` — `TODO: document conversion`（上游 FHIRHelpers 既有註解，非本專案待辦）

## 9. 未完成工作與待辦事項

來自原始碼 TODO 掃描（CQL 規則層）：

1. **CKD_Comprehensive v2 — egfr-check 趨勢規則**：納入「連續兩次 eGFR < 60」判斷（`cql/CKD_Comprehensive.cql:61`）。
2. **CKD_Comprehensive v2 — 3 個月持續性判斷**：eGFR < 60 AND uACR > 30 持續 ≥ 3 個月 → 確診 CKD 提示（`cql/CKD_Comprehensive.cql:62`）。
3. **CKD_Risk v2 — ConfirmedCKD 規則**：eGFR < 60 AND uACR > 30 持續 ≥ 3 個月（`cql/CKD_Risk.cql:161`）。

> 註：`docs/CPG/` 下另有「急診胸痛／ACS／MI」CDS 服務的設計文件與 CQL 引擎 stub 規劃，尚未在 `src/` 實作，屬後續規劃範圍。

## 10. 交接確認清單

- [ ] 原始碼已交接
- [ ] 設定檔與密鑰已交接
- [ ] 部署流程已說明
- [ ] 外部系統帳號已交接
- [ ] 已知問題已說明
- [ ] 待辦事項已確認
