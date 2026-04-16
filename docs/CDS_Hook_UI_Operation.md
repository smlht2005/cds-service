<!--
更新時間：2026-04-16 13:16
作者：CDS Service
摘要：第 7 節流程範例補充「ckd-risk 切換 Prefetch 驗證 hybrid」；修正 4.4 誤植之換行字元

更新時間：2026-04-16 11:19
作者：CDS Service
摘要：同步最新 UI：Prefetch 開關整併為單一控制（依服務切換）；標題列縮短高度（長描述改 tooltip/info）；ckd-risk hybrid 操作補充

更新時間：2026-04-16 10:28
作者：CDS Service
摘要：ckd-risk v1 改為預設 hybrid（prefetch 可省略，伺服端向 FHIR 取資料）；同步更新 UI 操作說明

更新時間：2026-04-16 10:08
作者：CDS Service
摘要：標題列應用說明與主要欄位 Tooltip（繁中）；見 frontend/src/copy/zhTwUi.ts

更新時間：2026-04-16 09:48
作者：CDS Service
摘要：配合 UI 重構更新區塊說明（標題列／請求設定卡片、按鈕中文標籤）

更新時間：2026-04-16 09:43
作者：CDS Service
摘要：相關文件加入 docs/qa/ui_operation_qa.md（UI 操作詳細 QA）

更新時間：2026-04-16 09:27
作者：CDS Service
摘要：4.4 改為「Prefetch from FHIR (egfr-check)」— 與 Discovery／egfrCheckHookHandler 鍵一致；移除舊 stub 說明（後續於 2026-04-16 11:19 更新為「依服務切換」）

更新時間：2026-04-16 09:16
作者：CDS Service
摘要：4.4 Prefetch (stub) 補充「前端實際送出內容／後端辨識欄位／目前與關閉開關行為相同」之說明

更新時間：2026-04-16 09:02
作者：CDS Service
摘要：新增 CDS Hook 前端 UI（Vite + React + MUI）操作說明：控制列、Request／Scenario output、服務差異與常見問題

-->

# CDS Hook UI — 操作說明

本文件說明 `frontend/` 內 **CDS Hook 測試台**（原標題含 eGFR 情境）的畫面區塊與操作步驟，協助在本機模擬 EHR **patient-view** 觸發 CDS Hooks，並檢視回傳之 **Cards** 與 **RuleEngine** 標記。

## 1. 目的與適用情境

| 項目 | 說明 |
|------|------|
| **用途** | 選擇 CDS 服務與病患 ID，送出 `hook: patient-view` 請求，檢視 `cards`（info／warning）、`extension` 中的規則引擎（`ELM`／`TS`／`TS_FALLBACK`）。 |
| **預設行為** | 模擬醫師開啟病患畫面後自動呼叫一次 Hook（可關閉）。 |
| **網路** | 開發時透過 **Vite proxy** 將 `/cds-services/*` 轉到 CDS Service、`/fhir/*` 轉到 FHIR，避免瀏覽器 CORS 問題。 |

## 2. 啟動前置條件

1. **CDS Service** 已啟動（預設 `http://127.0.0.1:3000`，見專案根目錄 `npm start`）。
2. **HAPI FHIR** 可連線（預設 `http://localhost:9090/fhir`），且已匯入測試病患／檢驗資料（見 `postman/CDS-Service-FHIR-TestData.postman_collection.json`）。
3. **前端**：於 `frontend/` 執行 `npm install`、`npm run dev`；依 `frontend/.env` 設定 `VITE_CDS_PROXY_TARGET`、`VITE_FHIR_BASE_URL`（或 `.env.example` 範本）。

若需畫面上顯示 **RuleEngine: ELM**，請於 CDS Service 的 `.env` 設定 **`USE_ELM=true`** 後重啟後端。

## 3. 主畫面區塊概覽

| 區域 | 位置 | 內容 |
|------|------|------|
| **頂部標題列** | 最上方 | **應用標題**、**副標**（patient-view · HL7 CDS Hooks）；長說明改為 **ⓘ Tooltip**；右側顯示 **RuleEngine**；請求進行中時可見載入圖示 |
| **請求設定** | 標題列下方（卡片） | **CDS 服務**、**Patient ID**、**自動呼叫（patient-view）**、**Prefetch from FHIR（依服務切換）**、**重新載入 Discovery**、**立即呼叫 Hook**；並顯示服務說明文字 |
| **請求本文（patient-view）** | 左欄 | 最近一次送出的 Hook **JSON**（含 `context.patientId`、選用服務時的 `prefetch`） |
| **Discovery JSON** | 左欄下方（可摺疊） | `GET /cds-services` 回傳之 Discovery 內容 |
| **情境輸出** | 右欄 | **A · 檢驗摘要（info）**、**B · 建議與警示（warning/critical）**、**原始回應 JSON** |

## 4. 控制項說明（請求設定卡片內）

### 4.1 CDS 服務（下拉選單）

- **`egfr-check`**：後端依 **病患 ID** 向 FHIR 查詢 eGFR／Creatinine 等，產生摘要與複查建議（邏輯與 `ckd-risk` 分離）。
- **`ckd-risk`**：**v1 預設 hybrid**（prefetch 建議但可省略）；此 UI 目前仍會**自動**向 FHIR 取得 `Patient`、active `Condition`、`Observation`（指定期間與 LOINC codes），組成 **`prefetch.patient` / `prefetch.conditions` / `prefetch.observations`** 再呼叫 `POST /cds-services/ckd-risk`；若你改為不帶 prefetch，伺服端會自行向 FHIR 取資料補齊。

### 4.2 Patient ID（輸入／下拉）

- 可從建議清單選取（如 `patient-ckd-101`～`105`），亦可 **freeSolo** 手動輸入其他 ID。
- 變更病患或服務後，若 **自動呼叫（patient-view）** 為開啟，會自動再呼叫一次 Hook。

### 4.3 自動呼叫（patient-view）（開關）

- **開啟**：`patientId`、`serviceId`、**Prefetch from FHIR（依服務切換）** 等相關依賴變更時，自動執行一次 Hook（模擬開啟病患畫面即觸發）。
- **關閉**：僅在按下 **立即呼叫 Hook** 時才送出請求。

### 4.4 Prefetch from FHIR（依服務切換）（開關）

- 此開關會依目前選擇的 **CDS 服務** 決定行為：
  - `egfr-check`：組 `prefetch.patient` + `prefetch.latestEgfr` + `prefetch.latestCreatinine`
  - `ckd-risk`：組 `prefetch.patient` + `prefetch.conditions` + `prefetch.observations`
- **關閉（egfr-check）**：請求不帶 `prefetch`，後端自行向 FHIR 查 Patient／eGFR／Creatinine。
- **關閉（ckd-risk）**：請求不帶 `prefetch`，後端以 **hybrid** 模式向 FHIR 取 Patient／Condition／Observation 補齊後再執行規則。
- **開啟**：前端在呼叫 CDS 前，先經 Vite proxy 向 FHIR 取資料並組出與 Discovery 鍵一致的 `prefetch`（較貼近 EHR 實作）。

若 FHIR 請求失敗（例如病患不存在、無法連線），頂部會顯示 **`Prefetch / FHIR failed:`** 並**不會**呼叫 Hook；請檢查病患 ID 與 FHIR 是否可用。

開啟時會顯示 Chip（依服務切換）：

- `egfr-check`：**patient · latestEgfr · latestCreatinine**
- `ckd-risk`：**patient · conditions · observations**

#### 4.4.1 後端 `egfr-check` 如何使用 prefetch

`handleEgfrCheckHook`（[`src/cds/egfrCheckHookHandler.ts`](../src/cds/egfrCheckHookHandler.ts)）在 `prefetch` 內有可用資料時**優先**使用；不足時再呼叫 FHIR。鍵與用途如下：

| prefetch 鍵 | 用途 |
|-------------|------|
| `patient` | 病患 `Patient`（單筆或 Bundle 第一筆） |
| `latestEgfr` | 最新 eGFR `Observation` 或 searchset `Bundle` |
| `latestCreatinine` | 最新 Creatinine `Observation` 或 Bundle |
| （輔助） | `extractEGFRValue` 由 `latestEgfr` 解析數值 |

在 FHIR 測資一致的前提下，**開／關本開關**得到的 **cards 臨床結論應相同**；差異在於後端是否**仍需**對 FHIR 發出額外查詢（除錯／整合驗證時可對照 Network 或伺服器 log）。

#### 4.4.2 Postman 對照

- **TC-PF-01／TC-PF-02**（[`postman/CDS-Service-E2E.postman_collection.json`](../postman/CDS-Service-E2E.postman_collection.json)）：手動帶入 `latestEgfr` 等，驗證後端解析。
- **TC-PF-03**：Discovery 對齊之 **patient + latestEgfr + latestCreatinine** 同請求（見該 collection 說明）。

### 4.5 重新載入 Discovery

- 重新呼叫 **`GET /cds-services`**，更新左側 **Discovery JSON**（例如確認 `href`、`prefetch` 範本是否更新）。

### 4.6 立即呼叫 Hook

- 手動觸發一次 Hook；與 **自動呼叫** 並存時，仍可用於**強制重送**（例如 FHIR 資料剛更新時建議按一次）。

### 4.7 RuleEngine 徽章（頂部標題列）

- 讀取 **`cards[0].extension`** 中 `url: urn:cds-service:rule-engine` 的 **`valueString`**（畫面顯示為 **RuleEngine：…**）。
- 常見值：**`ELM`**（CQL/ELM 引擎）、**`TS`**（TypeScript 對齊層）、**`TS_FALLBACK`**（ELM 失敗時降級）。若尚無卡片則顯示 **N/A**。

## 5. 左欄：請求本文（patient-view）

- 顯示實際送出的 JSON：`hook`、`context.patientId`，以及 **`ckd-risk` 時由 FHIR 組出的 `prefetch`**（conditions／observations Bundles）；**`egfr-check` 且開啟 Prefetch from FHIR** 時則含 `patient`、`latestEgfr`、`latestCreatinine`。
- 若呼叫失敗，頂部會出現 **紅色 Alert**（FHIR prefetch 失敗、Hook HTTP 錯誤、OperationOutcome 等）。

## 6. 右欄：情境輸出

### 6.1 A · 檢驗摘要（info）

- 顯示 `indicator === info` 的卡片（例如 CKD 風險摘要、eGFR 檢驗摘要）。
- 無資料時顯示空狀態說明（虛線框提示）。

### 6.2 B · 建議與警示（warning / critical）

- 顯示 `warning` 或 `critical` 卡片（例如 uACR／eGFR 缺漏提醒、eGFR 複查建議）。
- 無警示時顯示空狀態說明。

### 6.3 原始回應 JSON

- 摺疊區塊：完整後端回應 JSON，供與 Postman／自動化測試比對。

## 7. 建議操作流程（範例）

1. 啟動 CDS Service、FHIR、前端 dev server。
2. 瀏覽器開啟前端頁面，確認頂部已載入 **Discovery**（或按 **Reload discovery**）。
3. **Service** 選 `ckd-risk`，**Patient ID** 選 `patient-ckd-102`（測資設計為缺 uACR）。
4. 確認 **自動呼叫** 為開，或按 **立即呼叫 Hook**。
5. 於右欄確認 **info** 摘要與 **uACR** 相關 **warning**；頂部 **RuleEngine** 是否為預期（如已設 `USE_ELM=true` 則為 **ELM**）。
6. 若剛在 FHIR 新增／修改 Observation，建議再按 **立即呼叫 Hook** 或重新選取病患，以確保 Request 內 prefetch 為最新。
7. （可選、驗證 **ckd-risk hybrid**）同一病患下，將 **Prefetch from FHIR** 先 **關** 再 **開**，各按 **立即呼叫 Hook** 一次：關閉時左欄應無 `prefetch`（後端自行向 FHIR 補齊）；開啟時應含 `patient`／`conditions`／`observations`；在 FHIR 資料未變時，兩次 **cards 臨床結論應一致**。詳細步驟與預期見 [`docs/qa/ui_operation_qa.md`](qa/ui_operation_qa.md) 案例 **UI-CKD-02**。

## 8. 常見狀況

| 現象 | 可能原因 | 建議 |
|------|----------|------|
| `Prefetch required: patient` | **舊行為**（目前 `ckd-risk` v1 為 hybrid，理論上不應再出現）；多半是後端未更新/未重啟或 proxy 指到舊 host | 重啟 CDS Service；確認 `VITE_CDS_PROXY_TARGET` 指向正確後端；並用 Postman 的 `TC-HOOK-02` 驗證（ckd-risk 無 prefetch 仍應 200 + cards）。 |
| 一直顯示 uACR warning | FHIR 上無對應 LOINC 之 uACR Observation | 以 PUT/POST 補齊測資後再 **Call now**（見 [`docs/qa/README.md`](qa/README.md) 第 8 節）。 |
| RuleEngine 為 TS | 後端未開 ELM | 設定 `USE_ELM=true` 並重啟 CDS Service。 |
| 連線錯誤 | proxy 或後端未啟動 | 確認 `VITE_CDS_PROXY_TARGET`、CDS 與 FHIR 埠號；見頁尾關於 CORS 之提示。 |

## 9. 相關文件

- [`dev_readme.md`](../dev_readme.md) — 專案指令、環境變數、Frontend 啟動方式
- [`docs/qa/ui_operation_qa.md`](qa/ui_operation_qa.md) — **CDS Hook UI 操作與 Prefetch 開關對照（詳細 QA）**
- [`docs/qa/README.md`](qa/README.md) — ckd-risk v1 驗證紀錄、FHIR 測資更新；CQL／ELM／UCUM
- [`docs/E2E_Test_Plan.md`](E2E_Test_Plan.md) — E2E 測試計畫
