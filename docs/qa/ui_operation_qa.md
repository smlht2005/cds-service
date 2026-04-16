<!--
更新時間：2026-04-16 13:16
作者：CDS Service
摘要：第 6 節新增手動驗證案例 UI-CKD-02（ckd-risk Prefetch OFF／ON 對照 hybrid）

更新時間：2026-04-16 11:19
作者：CDS Service
摘要：同步最新 UI：Prefetch 開關整併為單一控制（依服務切換）；補上 ckd-risk hybrid（不帶 prefetch）驗證重點

更新時間：2026-04-16 10:28
作者：CDS Service
摘要：ckd-risk v1 改為預設 hybrid（prefetch 可省略，伺服端向 FHIR 取資料）；更新對照表與錯誤情境

更新時間：2026-04-16 10:08
作者：CDS Service
摘要：標題列說明與欄位 Tooltip（zh-TW）— 見 frontend/src/copy/zhTwUi.ts

更新時間：2026-04-16 09:48
作者：CDS Service
摘要：對照 UI 重構後控制項名稱（自動呼叫、立即呼叫 Hook、請求設定卡片、RuleEngine：）

更新時間：2026-04-16 09:43
作者：CDS Service
摘要：新增 CDS Hook UI 操作與 Prefetch 開關對照之詳細 QA（獨立於 CQL/ELM 主 QA）

-->

# CDS Hook UI — 操作與整合 QA（詳細）

本文件為 **[`docs/CDS_Hook_UI_Operation.md`](../CDS_Hook_UI_Operation.md)** 的 **QA 補充**：以問答與對照表形式記錄 **前端 UI**（`frontend/`）與 **CDS Service／FHIR** 的預期行為、驗證步驟與常見誤判，供測試與教學重現。

**範圍**：`egfr-check`／`ckd-risk`、`Prefetch from FHIR (egfr-check)` 開關、Request／Response、RuleEngine、錯誤訊息。  
**Tooltip**：主要控制項與區塊標題旁 **ⓘ** 或將游標移至 **RuleEngine**／**Discovery 鍵** 上，可讀取繁中說明（文案集中於 [`frontend/src/copy/zhTwUi.ts`](../../frontend/src/copy/zhTwUi.ts)）。  
**不包含**：CQL／ELM／UCUM 編譯問題（見 [`README.md`](README.md) 主文件）。

---

## 1. 前置條件檢查清單

| 序 | 檢查項 | 預期／說明 |
|----|--------|------------|
| 1 | CDS Service 已啟動 | 預設 `http://127.0.0.1:3000`（或 `dev_readme` 之 `PORT`/`HOST`） |
| 2 | HAPI FHIR 可連線 | 預設 `http://localhost:9090/fhir`；測資已匯入（見 Postman FHIR TestData） |
| 3 | 前端 dev server | `frontend/` 執行 `npm run dev`；`VITE_CDS_PROXY_TARGET` 指向 CDS、`VITE_FHIR_BASE_URL` 等設定正確 |
| 4 | （可選）RuleEngine 顯示 ELM | 專案根目錄 `.env` 設 `USE_ELM=true` 並重啟 CDS Service |

---

## 2. 控制項 — 功能與 QA 對照

| 控制項 | 行為摘要 | QA 注意 |
|--------|----------|---------|
| **CDS 服務** | `egfr-check`：eGFR 複查規則（與 `ckd-risk` 分離）。`ckd-risk`：CKD risk v1（**預設 hybrid**：可不帶 prefetch）。 | 切換服務若 **自動呼叫（patient-view）** 為開，會自動重送 Hook。 |
| **Patient ID** | 建議清單或手動輸入（freeSolo）。 | ID 須與 FHIR 內存在之 `Patient.id` 一致，否則 FHIR 404 → Prefetch 階段或後端錯誤。 |
| **自動呼叫（patient-view）** | 開：依賴變更時自動 `runHook`。關：僅 **立即呼叫 Hook** 觸發。 | 關閉可避免每次改參數就重送，方便比對 Request。 |
| **Prefetch from FHIR（依服務切換）** | 單一開關：依目前 service 決定組哪些 prefetch。 | `egfr-check`：patient/latestEgfr/latestCreatinine；`ckd-risk`：patient/conditions/observations。 |
| **重新載入 Discovery** | `GET /cds-services`，更新左下 Discovery JSON。 | 驗證 `href`、`prefetch` 範本是否與後端一致。 |
| **立即呼叫 Hook** | 手動送 Hook。 | FHIR 資料更新後建議按一次，避免只看舊 Response。 |
| **Discovery 鍵 Chip** | 僅在 `egfr-check` 且 Prefetch 開啟時顯示（長文案）。 | 表示本次請求將帶 `patient`／`latestEgfr`／`latestCreatinine`。 |
| **RuleEngine**（標題列） | 讀 `cards[0].extension` `urn:cds-service:rule-engine`。 | 顯示為 **RuleEngine：**…；`ELM`／`TS`／`TS_FALLBACK`；無卡時 `N/A`。 |

---

## 3. 「Prefetch from FHIR」— 關閉 vs 開啟（詳細 QA）

### 3.1 核心差異

| 維度 | **關閉（OFF）** | **開啟（ON）** |
|------|-----------------|----------------|
| **Request JSON** | 通常僅 `hook` + `context.patientId`，**無** `prefetch` | 含 **`prefetch`**（依 service 不同鍵不同；見下方 3.1.1） |
| **誰向 FHIR 取資料** | **CDS Service（後端）** 依 service 自行向 FHIR 查詢補齊（`ckd-risk` 為 hybrid） | **瀏覽器（前端）** 經 Vite proxy 先取資料組 prefetch，再 POST 給 CDS |
| **後端優先序** | 無 prefetch → 後端必須自行查 FHIR | 有合法 prefetch → **優先**用請求內資源；不足再補 FHIR |
| **臨床結論（cards）** | 在 **FHIR 資料相同** 前提下，應與開啟時 **一致** | 同上 |
| **整合意義** | 模擬「EHR 只傳 context，CDS 自查 FHIR」 | 模擬「EHR 依 Discovery 範本先取好資料，與 Hook 一併送出（CDS Hooks prefetch 模式）」 |

#### 3.1.1 Prefetch 內容（依 service）

- **egfr-check（ON）**：`patient`、`latestEgfr`、`latestCreatinine`
- **ckd-risk（ON）**：`patient`、`conditions`、`observations`

### 3.2 視覺／除錯對照（與截圖驗證一致）

- **關閉**：左欄 Request 為 **精簡 JSON**（僅 `patientId`），不會出現 **Discovery prefetch keys** Chip。
- **開啟**：左欄 Request 出現 **大型 `prefetch` 區塊**（含 Patient 與 Observation Bundles）；工具列出現 **Discovery prefetch keys**；**RuleEngine** 仍可能為 **ELM**（與後端設定有關，與本開關無直接衝突）。

### 3.3 網路呼叫差異（QA 除錯）

- **關閉**：瀏覽器主要為 **→ CDS**；FHIR 流量發生在 **CDS 伺服器 → FHIR**。
- **開啟**：瀏覽器 **→ FHIR**（組 prefetch）再 **→ CDS**；可於 DevTools Network 看到多段 `/fhir` 與 `/cds-services/egfr-check`。

### 3.4 Prefetch 階段失敗

若 FHIR **GET Patient** 或 **Search Observation** 失敗，UI 顯示 **`Prefetch / FHIR failed:`**（含 HTTP 狀態或診斷），**不會**呼叫 Hook。  
此與 **Hook 階段**錯誤（`Hook failed:`、`OperationOutcome`）需區分。

---

## 4. `egfr-check` 與 `ckd-risk` — 行為差異 QA

| 項目 | **egfr-check** | **ckd-risk** |
|------|------------------|--------------|
| Prefetch 是否必須 | 否；可僅 `patientId` | 否；**v1 預設 hybrid**：不帶 prefetch 時伺服端會向 FHIR 取 Patient/Condition/Observation 補齊（prefetch 仍建議） |
| 本 UI 行為 | 可選「Prefetch from FHIR」開關 | 目前提供「Prefetch from FHIR（ckd-risk）」開關，可對照「帶 prefetch」vs「伺服端取資料」兩種模式 |
| 主要卡片內容 | eGFR 摘要 + 低 eGFR 複查 warning（規則） | CKD risk 摘要 + uACR／eGFR 缺漏等 warning（v1） |

---

## 5. 預期錯誤訊息與處置

| 訊息前綴／現象 | 可能原因 | 建議處置 |
|----------------|----------|----------|
| `Prefetch / FHIR failed` | 病患不存在、FHIR 未啟動、proxy 錯誤 | 查 `Patient/{id}`、FHIR 埠、`.env`／`VITE_*` |
| `Hook failed` + HTTP | CDS 回 4xx/5xx | 查 CDS log、請求 body 是否過大 |
| `Hook failed` + OperationOutcome | 後端規範錯誤 | 讀 `issue` 內 diagnostics |
| `Discovery failed` | Discovery 無法連線 | 確認 CDS 與 `Reload discovery` |
| RuleEngine 為 **TS** | 未開 ELM 或僅 TS 路徑 | 設 `USE_ELM=true` 並重啟 CDS |
| `ckd-risk`：`Prefetch required: patient` | **舊行為**（已改為 hybrid），若仍看到通常代表後端未更新/未重啟 | 重新啟動 CDS Service；並以 Postman 新增的「ckd-risk 無 prefetch」案例驗證 |

---

## 6. 建議驗證案例（手動）

| 案例 ID | 步驟摘要 | 預期 |
|---------|----------|------|
| UI-PF-01 | Service=`egfr-check`，同一 `patientId`，**Prefetch 關** → 記錄 cards；再 **Prefetch 開** → 比對 | 兩次 **info／warning 結論一致**（資料未變時） |
| UI-PF-02 | Request 左欄：關閉時無 `prefetch`；開啟時有三鍵 | 與第 3 節表一致 |
| UI-CKD-01 | Service=`ckd-risk`，`patient-ckd-102` | 有 uACR missing warning（若測資未補 uACR）；RuleEngine 依 `USE_ELM` |
| UI-CKD-02 | Service=`ckd-risk`，固定同一 `patientId`（建議 `patient-ckd-102`）。**Prefetch 關** → **立即呼叫 Hook**，記錄左欄 Request（應無 `prefetch`）與右欄 cards；再 **Prefetch 開** → 再按 **立即呼叫 Hook** | 兩次 **info／warning 臨床結論一致**（FHIR 資料未變時）。左欄：關閉時精簡 JSON；開啟時含 `prefetch.patient`／`conditions`／`observations`（與 Discovery 鍵一致）；Network 可見關閉時瀏覽器主要只打 CDS、開啟時先打 FHIR 再打 CDS |

---

## 7. 相關文件與 Postman

| 資源 | 用途 |
|------|------|
| [`docs/CDS_Hook_UI_Operation.md`](../CDS_Hook_UI_Operation.md) | 操作說明主文件 |
| [`docs/qa/README.md`](README.md) | CQL／ELM／UCUM 與 ckd-risk v1 UI 驗證 |
| [`postman/CDS-Service-E2E.postman_collection.json`](../../postman/CDS-Service-E2E.postman_collection.json) | TC-PF-01～03、TC-PF-CKD-* |
| [`dev_readme.md`](../../dev_readme.md) | 啟動指令與環境變數 |

---

## 8. 變更紀錄（本檔）

| 日期 | 摘要 |
|------|------|
| 2026-04-16 | 新增 UI-CKD-02：ckd-risk Prefetch OFF／ON 對照 hybrid 與 Request／Network 預期 |
| 2026-04-16 | 初版：控制列 QA、Prefetch 開關關閉／開啟對照、錯誤訊息、手動驗證案例 |
