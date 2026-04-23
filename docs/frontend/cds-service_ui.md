<!--
更新時間：2026-04-21 08:55
作者：CDS Service
摘要：對齊實作事實：fe-extract-hook-builders 已完成（hookBuilders 已落地）；YAML todo status 同步更新
-->
---
name: frontend_add_cds_service_refactor
overview: 將前端從「硬編碼 3 個 patient-view 服務」重構為「可從 Discovery 動態載入服務 + 可切換急診 CDS server + 支援多種 hook 類型（patient-view/observation-create/order-select）」的擴充架構，並把此重構/新增步驟寫回急診規劃文件的新增章節。
todos:
  - id: fe-scan-discovery-shape
    content: 確認後端 Discovery 回應 shape（至少 services[].id/hook/prefetch），以便前端 parser/builder 對齊
    status: completed
  - id: fe-add-emergency-proxy
    content: 在 `frontend/vite.config.ts` 增加急診 CDS proxy path（例如 `/emergency-cds-services`）與對應 env key（例如 `VITE_EMERGENCY_CDS_PROXY_TARGET`）
    status: completed
  - id: fe-refactor-app-to-discovery-driven
    content: 重構 `frontend/src/App.tsx`：服務清單改由 Discovery 動態產生、hook 不再固定 patient-view、移除硬編碼 ServiceId union/MenuItem
    status: completed
  - id: fe-extract-hook-builders
    content: 新增 `frontend/src/cds/hookBuilders/`：依 hook type 封裝 UI 欄位與 request/context/prefetch 組裝（patient-view/observation-create/order-select）
    status: completed
  - id: fe-target-selector-ui
    content: 在 UI 增加目標 server（main/emergency）切換，並把 basePath/proxy 套用到 Discovery 與 Hook 呼叫
    status: completed
  - id: doc-update-emergence-plan
    content: 把上述『前端重構＋新增 service』章節寫回 `docs/emergence/新cds_server研究規劃.md`，作為後續實作依據
    status: cancelled
isProject: false
---

## 背景與現況（從程式碼盤點）

- 前端目前在 `frontend/src/App.tsx` 以 union type 硬編碼服務：`type ServiceId = 'egfr-check' | 'ckd-risk' | 'ckd-comprehensive'`，並在 Select 內硬寫 MenuItem。
- 前端的 Hook request 目前固定送 `hook: 'patient-view'`、`context: { patientId }`（同檔 `runHook()`）。Prefetch 組裝也以 `serviceId` 分支硬寫在 `App.tsx`。
- CDS 呼叫集中在 `frontend/src/api/cdsClient.ts`：`fetchDiscovery()` 打 `GET /cds-services`，`callHook()` 打 `POST /cds-services/{serviceId}`，並支援 `basePath` 參數。
- Vite proxy 目前只轉發一個 CDS 目標：`frontend/vite.config.ts` 的 `'/cds-services': proxyTarget`，以及 `'/fhir'`。

## 你這次需求的關鍵決策（已確認）

- 目標後端：**急診獨立 CDS server**（需要前端能切到另一個 CDS base URL/proxy）。
- Hook 類型：**mixed**（至少要能因不同 service 的 `hook` 不同而切換 UI 表單與 request/context/prefetch 組裝）。

## 建議重構方向（KISS + 可擴充）

### 1) 拆出「目標 CDS server」抽象，讓 `cdsClient` 可選 basePath

- 新增一個前端概念：`CdsTarget`（例如 `main` / `emergency`），各自對應 `basePath`。
- `cdsClient.fetchDiscovery({ basePath })` 與 `callHook(serviceId, req, { basePath })` 既有介面可直接沿用，不必改函式簽章。

### 2) 用 Discovery 動態產生 service 清單，移除 `ServiceId` 硬編碼

- `loadDiscovery()` 取得 JSON 後，解析出 services 陣列（預期形狀：`{ services: Array<{ id, hook, prefetch?, ... }> }`）。
- 服務下拉改為由 Discovery 生成選項，預設選第一個 service（或保留你要的固定預設 id）。
- `hook` 不再固定 `'patient-view'`，而是跟著選到的 service 的 `hook`。

### 3) 將 request 組裝改成「依 hook type 的 builder」

- 建立 `frontend/src/cds/hookBuilders/`（或類似資料夾）：
  - `patientViewBuilder.ts`
  - `observationCreateBuilder.ts`
  - `orderSelectBuilder.ts`
- 每個 builder 負責：
  - UI 表單需要的欄位定義（最小欄位 + 可選 advanced）
  - 產生 `CdsHookRequest`（hook/context/prefetch）
- `App.tsx` 只負責：
  - 讀 Discovery
  - 選 service / 選 target
  - 根據 service.hook 取對應 builder，render 對應表單，按「呼叫 Hook」時拿 builder 產生 request

### 4) Prefetch 策略：改為「跟著 Discovery 的 prefetch keys」

- 目前 `App.tsx` 的 prefetch 是用 serviceId 分支硬寫（例如 `conditionsAll`、`latestEgfr`）。
- 建議改為：
  - UI 仍保留「Prefetch from FHIR」開關
  - 但實際要 prefetch 哪些 key/資源，改由 Discovery 的 `prefetch` 樣板（或 key 集合）驅動
  - 避免每加一個 service 就要在 `App.tsx` 增加一段大分支

### 5) Vite proxy：新增急診 CDS 轉發路徑

- 在 `frontend/vite.config.ts` 加一個新的 proxy path（例）：
  - `'/emergency-cds-services' -> VITE_EMERGENCY_CDS_PROXY_TARGET`
- 讓前端對急診呼叫走 `basePath='/emergency'`（或直接 `basePath=''` 但 path 改成 `/emergency-cds-services`），兩種做法擇一：
  - **做法 A（推薦）**：保留後端路徑為 `/cds-services`，前端用不同 proxy prefix 區分目標（最不動後端）
  - 做法 B：若急診 server 本身不是 `/cds-services` 根路徑，才需要 basePath 前綴

## 需要更新/新增的檔案（前端）

- 主要修改：
  - `frontend/src/App.tsx`：移除硬編碼 serviceId union 與 prefetch 大分支，改成 target/service/builder 架構
  - `frontend/vite.config.ts`：新增急診 CDS proxy path + 新 env key
  - `frontend/src/copy/zhTwUi.ts`：補上「目標 server 切換」與新 hook 類型說明文案/tooltip
- 新增（建議）：
  - `frontend/src/cds/types.ts`：定義 `DiscoveryResponse`、`CdsServiceInfo`、`CdsTarget`
  - `frontend/src/cds/discovery.ts`：解析 Discovery JSON（含容錯：未知欄位、缺 hook/prefetch）
  - `frontend/src/cds/hookBuilders/`*：各 hook 的 request/context/prefetch builder
  - `frontend/src/cds/targets.ts`：`main`/`emergency` 的 basePath 與顯示名稱

## 同步更新規劃文件（你指定的位置）

- 在 `docs/emergence/新cds_server研究規劃.md` 新增一節（例如 `## 前端（frontend）如何新增/擴充 CDS service`），包含：
  - 現況限制：App.tsx 硬編碼服務與 patient-view
  - 目標：支援急診 server + mixed hooks + discovery-driven
  - 檔案清單與改動點（如上）
  - 驗證清單：
    - Discovery 讀到急診服務清單
    - 選 service 後 hook request 的 `hook` 字串正確
    - basePath/proxy 能打到急診 server
    - Prefetch on/off 行為符合設計（prefetch 缺資料時後端 fallback 仍可運作）

