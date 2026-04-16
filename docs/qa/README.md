<!--
更新時間：2026-04-16 10:28
作者：CDS Service
摘要：ckd-risk v1 改為預設 hybrid（prefetch 可省略，伺服端向 FHIR 取資料）；同步調整前端驗證敘述

更新時間：2026-04-16 09:43
作者：CDS Service
摘要：新增 docs/qa/ui_operation_qa.md（CDS Hook UI 操作／Prefetch 開關詳細 QA）

更新時間：2026-04-16 09:02
作者：CDS Service
摘要：相關文件加入 docs/CDS_Hook_UI_Operation.md（前端 UI 操作說明）

更新時間：2026-04-15 18:35
作者：CDS Service
摘要：補充 ckd-risk v1（prefetch-only）於前端 UI 的驗證結果：uACR/eGFR 缺漏 warning 觸發與 FHIR 測資更新方式

更新時間：2026-04-15 16:19
作者：CDS Service
摘要：補充 FHIRHelpers（cql/FHIRHelpers.cql 與 elm/FHIRHelpers.json）在 ELM 執行期的用途與常見錯誤型態

更新時間：2026-04-15 12:11
作者：CDS Service
摘要：初版 — CQL／ELM／UCUM 問題排查、驗證方式與 Maven 重編譯 QA 紀錄（對應前述實作與討論）
-->

# CQL／ELM 與 UCUM — QA 紀錄

本文件彙整 **CQL 來源**、**ELM 產物**、**UCUM 單位** 相關之問題現象、修正方式與驗證步驟，供版控與重現時查閱。

## 1. 問題背景（UCUM：`73m` 錯誤）

| 項目 | 說明 |
|------|------|
| **現象** | 編譯 `cql/EGFR_Check.cql` 時，ELM 註解出現 `CqlToElmError`，訊息含 `Error processing unit 'mL/min/1.73m2': The unit '73m' is unknown' at position 9`。 |
| **原因** | 字串 `'mL/min/1.73m2'` 被 UCUM 拆錯，將 **`73m`** 當成不存在的單位代碼。 |
| **影響** | `define "Needs Recheck"` 的 ELM **expression** 可能退化為 **`Null`**，語意不成立，不可當作可執行 ELM。 |

## 2. 修正方式（CQL 門檻單位）

將門檻比較之單位由 **`'mL/min/1.73m2'`** 改為 **`'mL/min/1.73/m2'`**（將 `1.73` 與 `m2` 分開寫，語意仍為每 1.73 m² 之 eGFR 尺度）。

- **來源檔**：[`cql/EGFR_Check.cql`](../../cql/EGFR_Check.cql)
- **TS 對齊層註解**（行為仍為 `ml/min` 寬鬆比對）：[`src/cql/egfrRecheckEvaluation.ts`](../../src/cql/egfrRecheckEvaluation.ts)

修正後需 **重新編譯** `elm/EGFR_Check.json`，不可只改 JSON 註解而不重編。

## 3. 重編譯 ELM（Maven，本專案已附 helper）

已安裝 **Java**、**Maven** 時，於專案根目錄：

```powershell
cd "c:\Development\HISCore\CDS Service"
mvn -f scripts/cql-compile-pom.xml exec:java "-Dexec.args=--input cql/EGFR_Check.cql --output elm/EGFR_Check.json --format JSON"
```

- Helper POM：[`scripts/cql-compile-pom.xml`](../../scripts/cql-compile-pom.xml)（`workingDirectory` 設為專案根目錄，以正確解析 `cql/`）。
- 詳細說明：[`docs/cql_elm.md`](../cql_elm.md)。

## 4. ELM 內 `CqlToElmError`：warning 與 error 之區別

| 類型 | 典型訊息 | 處理 |
|------|----------|------|
| **error（語意／單位）** | UCUM 無法解析單位（如 `73m`） | **必須**修正 CQL 並重編；檢查 `Needs Recheck` 是否為有效 `And`／`Less` 等，而非 `Null`。 |
| **warning（FHIRHelpers 多載）** | `FHIRHelpers.ToString` / `ToDateTime` 多載與 `SignatureLevel` | 編譯器仍可產出可執行 ELM；執行期若需可再調整編譯選項（見 `docs/cql_elm.md` 與 CQFramework 文件）。 |

## 5. 驗證 ELM 與 CQL 是否一致（建議檢查清單）

1. **可重現**：以固定 CQFramework 版本（本專案 helper 使用 **3.26.0**）從 `EGFR_Check.cql` 編譯，產物可重現（JSON 可再做 `JSON.stringify` 正規化後比對）。
2. **結構**：`library.identifier` 與 CQL `library`／`version` 一致；`statements.def` 含 `Needs Recheck`、`Recommendation Summary`、`Recommendation Detail` 等預期定義名稱。
3. **無 UCUM 致命錯誤**：ELM 中 **不應**再出現與 **`1.73m2`** 相關之 **error** 級訊息；`Needs Recheck` 應為 **非 `Null`** 之表達式（例如 `And`、`Less`、`Quantity`）。
4. **執行期金樣（建議）**：對固定測試病患資料，`Needs Recheck` 與 [`egfrRecheckEvaluation.ts`](../../src/cql/egfrRecheckEvaluation.ts) 或 E2E 預期一致（見 [`docs/E2E_Test_Plan.md`](../E2E_Test_Plan.md)）。

## 6. 其他：ELM JSON 排版

產物可為單行或排版；若要易讀可於 Node 執行 `JSON.parse` + `JSON.stringify(data, null, 2)` 寫回，**僅變更空白**，語意不變。

## 7. FHIRHelpers：`cql/FHIRHelpers.cql` 與 `elm/FHIRHelpers.json` 的角色

| 檔案 | 角色 | 何時會用到 |
|------|------|------------|
| `cql/FHIRHelpers.cql` | **標準輔助函式庫（原始碼）**：提供多個 FHIR 型別與 CQL 型別間的轉換/取值工具（例如常見的 `ToString`、`ToDecimal` 等） | 當你的規則 CQL `include FHIRHelpers`，或在 CQL 中呼叫到 FHIRHelpers 提供的函式 |
| `elm/FHIRHelpers.json` | **可執行 ELM 產物**：由 `cql/FHIRHelpers.cql` 編譯而來，供 `cql-execution` 在執行期載入 | 當你要「真跑 ELM」（例如執行 `elm/EGFR_Check.json`）且規則引用了 FHIRHelpers 時，必須一併載入 |

### 常見現象

- **只載入 `elm/EGFR_Check.json`，沒載入 `elm/FHIRHelpers.json`**：執行期可能出現「找不到函式/多載解析失敗」或資料型別處理錯誤（例如先前遇到的 `ToString` / `ToDecimal` 相關錯誤）。
- **結論**：`FHIRHelpers` 是規則庫的「相依套件」，跟一般程式碼的 dependency 類似；CQL 有 `include`，ELM 執行就要有對應的 ELM library 一起載入。

## 8. ckd-risk v1（hybrid：prefetch 建議但可省略）— 前端 UI 驗證紀錄

本段紀錄 `ckd-risk` v1 規則集合在前端 UI（Vite + React + MUI）上的實際驗證結果，重點是「缺檢驗」的 warning 是否如預期觸發，以及如何透過更新 FHIR 測資讓 warning 消失。

### 8.1 規則摘要（v1）

- **Missing uACR**：找不到 uACR Observation（LOINC `9318-7` 或 `32294-1`）→ warning：`uACR not recorded in past 12 months — order uACR (urine test)`
- **Missing eGFR**：找不到 eGFR Observation（LOINC `62238-1` 或 `33914-3`）→ warning：`eGFR not recorded in past 12 months — order eGFR (blood test)`
- **資料來源**：`ckd-risk` v1 為 **hybrid**：若請求未帶 prefetch，伺服端會向 FHIR 取得 Patient/Condition/Observation；前端 UI 目前仍會先向 FHIR 取得資料再組成 prefetch，以模擬 EHR 行為。

### 8.2 驗證結果（以測試病患為例）

- **patient-ckd-101**：補齊 uACR 後 → `Most recent uACR: 12 mg/g`，**warning 消失**（(no warning cards)），`RuleEngine: ELM`
- **patient-ckd-103**：補齊 uACR 後 → `Most recent uACR: 10 mg/g`，**warning 消失**，`RuleEngine: ELM`
- **patient-ckd-104**：補齊 uACR 後 → `Most recent uACR: 8 mg/g`，**warning 消失**，`RuleEngine: ELM`
- **patient-ckd-102**：仍缺 uACR → 只出現 **uACR warning**（eGFR=65 仍存在），`RuleEngine: ELM`
- **patient-ckd-105**：缺 eGFR + 缺 uACR → 出現 **2 張 warning**（eGFR + uACR），`RuleEngine: ELM`

### 8.3 更新 FHIR 測資（新增 uACR Observation）

若測資缺 uACR，`ckd-risk` 會一直出現 uACR warning。可用 **PUT Observation** 的方式補齊（示例為 LOINC `9318-7`，單位 `mg/g`）。

> 示範指令與實際執行紀錄：已成功建立 `obs-uacr-101` / `obs-uacr-103` / `obs-uacr-104`，並能以 `GET /Observation?patient=...&code=9318-7` 查得 `total: 1`。

## 相關文件

- [`docs/qa/ui_operation_qa.md`](ui_operation_qa.md) — **CDS Hook UI 操作與 Prefetch 開關對照（詳細 QA）**
- [`docs/CDS_Hook_UI_Operation.md`](../CDS_Hook_UI_Operation.md) — CDS Hook 前端 UI 操作說明（控制列、prefetch、RuleEngine）
- [`docs/cql_elm.md`](../cql_elm.md) — CQL→ELM 流程、VS Code／Maven 指令
- [`docs/E2E_Test_Plan.md`](../E2E_Test_Plan.md) — E2E 測試計畫
- [`dev_readme.md`](../../dev_readme.md) — 專案指令與環境變數
