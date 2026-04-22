<!--
更新時間：2026-04-21 09:12
作者：CDS Service
摘要：新增 QA：`fe-extract-hook-builders`（hookBuilders：observation-create／order-select）模組說明、App 整合點、Discovery 限制與驗證方式
-->

# `fe-extract-hook-builders` — mixed hooks Context Builder QA

本文件將 **`fe-extract-hook-builders`（completed）** 的實作範圍與驗收方式寫成可重現的 QA 紀錄，補足 [`ui_operation_qa.md`](ui_operation_qa.md) 以 **patient-view** 為主的敘述。

**對應設計／待辦索引**：[`docs/frontend/cds-service_ui.md`](../frontend/cds-service_ui.md)（YAML todo：`fe-extract-hook-builders` → `completed`）。

---

## 1. 目的與完成定義

| 項目 | 說明 |
|------|------|
| **要做什麼** | 將 **非 `patient-view`** 的 CDS Hooks（至少 **`observation-create`**、**`order-select`**）之 **context 組裝**，從 `App.tsx` 內嵌邏輯抽離到獨立模組，提供 **範本預填、JSON 編輯、送出前驗證**。 |
| **完成判準** | `frontend/src/cds/hookBuilders/` 可 import；`App.tsx` 依 Discovery 的 `hook` 選擇對應 builder 或退回通用 Context JSON；`runHook()` 能將解析結果 merge 進 `CdsHookRequest.context`。 |

---

## 2. 程式位置與匯出入口

| 路徑 | 角色 |
|------|------|
| [`frontend/src/cds/hookBuilders/index.ts`](../../frontend/src/cds/hookBuilders/index.ts) | Barrel：匯出兩個 hook 的常數、state factory、`parse*`、`render*`、型別。 |
| [`frontend/src/cds/hookBuilders/observationCreateBuilder.tsx`](../../frontend/src/cds/hookBuilders/observationCreateBuilder.tsx) | `observation-create`：範本 Observation、shape 驗證、UI。 |
| [`frontend/src/cds/hookBuilders/orderSelectBuilder.tsx`](../../frontend/src/cds/hookBuilders/orderSelectBuilder.tsx) | `order-select`：範本 `draftOrders` Bundle + `selections`、驗證、UI。 |
| [`frontend/src/App.tsx`](../../frontend/src/App.tsx) | 匯入 hookBuilders、保存 state、條件渲染、`runHook()` 分支整合。 |

---

## 3. `observation-create` builder 行為（QA 重點）

| 項目 | 說明 |
|------|------|
| **常數** | `OBSERVATION_CREATE_HOOK === 'observation-create'`（與 CDS Hooks 名稱一致）。 |
| **初始／範本** | `createObservationCreateBuilderState(patientId?)` 以 JSON 字串預填；UI 提供 **「套用 Observation 範本」** 可重載範本（含 LOINC `2160-0`、時間、`valueQuantity`、可選 `subject`）。 |
| **驗證** | `parseObservationCreateContext`：`JSON.parse` 後與 UI 選的 `patientId` **merge**（`{ ...(patientId ? { patientId } : {}), ...parsed }`），再檢查 `observation` 為 FHIR Observation 物件、必要欄位與值型別。 |
| **錯誤呈現** | 驗證失敗時回傳 `error` 字串；`App.tsx` 將其寫入 builder state 的 `contextJsonError` 並 **中止送 Hook**。 |

---

## 4. `order-select` builder 行為（QA 重點）

| 項目 | 說明 |
|------|------|
| **常數** | `ORDER_SELECT_HOOK === 'order-select'`。 |
| **初始／範本** | `draftOrders` 為 `Bundle`（內含 draft `ServiceRequest`）、`selections` 為字串陣列（例如 `ServiceRequest/sr-001`）。 |
| **驗證** | `draftOrders.resourceType === 'Bundle'`；`selections` 必須為陣列且至少一筆非空字串。 |
| **merge 規則** | 與 observation-create 相同：parse 後 merge `patientId` 再驗證。 |

---

## 5. `App.tsx` 整合點（測試時對照程式）

### 5.1 `hookType` 來源

- `hookType` 取自 **Discovery 選中服務** `selectedService.hook`（字串）；缺省為 **`patient-view`**。
- 因此 **UI 是否出現** observation／order builder，完全依 **後端 Discovery 是否宣告該 `hook`**。

### 5.2 畫面：何時顯示哪個區塊

- 當 `(selectedService?.hook ?? 'patient-view') !== 'patient-view'`：
  - `hookType === 'observation-create'` → `renderObservationCreateBuilder(...)`
  - `hookType === 'order-select'` → `renderOrderSelectBuilder(...)`
  - 其他 hook → **通用** `Context JSON` 文字框（仍支援未專門建模的 hook）

### 5.3 送出：`runHook()` 的 `context` 組裝

- **`patient-view`**：`extraContext` 不走上述兩個 parser（維持既有 patientId／prefetch 行為）。
- **非 `patient-view`**：
  - `observation-create` → `parseObservationCreateContext(state, patientId)`
  - `order-select` → `parseOrderSelectContext(state, patientId)`
  - 其他 → 解析 `hookContextJsonText`
- 最終請求：`context: { ...(patientId ? { patientId } : {}), ...extraContext }`  
  → builder 產生的欄位會進入 **同一層** `context`（與 `patientId` 合併）。

---

## 6. Discovery 限制與目前可做的煙霧驗證

| 現象 | 說明 |
|------|------|
| **主 CDS（port 3000）** | Discovery 服務之 `hook` 目前皆為 **`patient-view`**（`egfr-check`／`ckd-risk`／`ckd-comprehensive`）。 |
| **急診 CDS（port 3001）** | `72hr-revisit`、`infection-control-warning` 亦為 **`patient-view`**。 |
| **對 UI 的影響** | 在上述環境下，**不會**進入 observation-create／order-select 的專屬 builder 區塊；屬 **資料面** 尚未提供對應 hook 服務，**不代表** builder 程式未實作。 |

**已留存之 Chrome 煙霧截圖**（Discovery + `patient-view` + 卡片渲染）：[`cds-hook-ui-chrome.png`](cds-hook-ui-chrome.png)  
（取得方式：`frontend` 執行 `npm run build` 後 `vite preview`，再以 Chrome headless `--screenshot` 擷取。）

---

## 7. 建議驗收步驟（若要「畫面上」看到兩個 builder）

擇一即可（需與產品／後端策略一致）：

1. **後端 Discovery 擴充**：在測試或正式 Discovery 中新增服務項目，`hook` 分別為 `observation-create`、`order-select`，並提供可用之 `POST /cds-services/{id}`（或至少允許前端組 context 打 endpoint 做整合測試）。
2. **獨立 mock 伺服**：本機另起一個只回 Discovery JSON 的 stub（不改正式規則檔），前端 Vite proxy 指到該 stub，專供 QA 重現 mixed hooks UI。

驗收時應確認：

- 選到該服務後，畫面出現對應 **Context Builder**（非通用 JSON 框）。
- 故意輸入不合法 JSON 或缺欄位 → **不出 Hook** 且 helper 顯示錯誤。
- 按 **套用範本** 後可一鍵恢復可送狀態（再依後端需求微調）。

---

## 8. 相關文件

- [`docs/frontend/cds-service_ui.md`](../frontend/cds-service_ui.md) — 前端重構與 todo 狀態（含 `fe-extract-hook-builders`）。
- [`docs/qa/ui_operation_qa.md`](ui_operation_qa.md) — patient-view 為主之 UI／Prefetch QA。
- [`docs/emergence/agent_session_summary.md`](../emergence/agent_session_summary.md) — session 摘要與驗收 bullet（含截圖路徑）。
