<!--
更新時間：2026-04-20 13:57
作者：CDS Service
摘要：急診雙服務已具 CQL／ELM 與 executor；USE_ELM 與主 CDS 共用；handler 已接入

更新時間：2026-04-20 11:38
作者：CDS Service
摘要：72hr 補述無 Encounter.id 時不去重計數；USE_ELM／TS_FALLBACK 補程式錨點

更新時間：2026-04-20 11:26
作者：CDS Service
摘要：擴充為急診雙服務（72hr-revisit、infection-control-warning）規則／FHIR／env／CQL 草稿；總覽連結 ECR 範本 ecr-template.md

更新時間：2026-04-20 10:25
作者：CDS Service
摘要：補 HIR／PDF：ICD B20–B24、ATC J05* ARV；測資 case-9.1；CQL 對齊草稿小節

更新時間：2026-04-20 10:15
作者：CDS Service
摘要：急診 infection-control-warning 服務之規則來源、與 CQL 關係、FHIR 需求摘要
-->

# 急診 CDS：規則來源與需求（`infection-control-warning` 與 `72hr-revisit`）

本文涵蓋急診獨立 CDS 之兩支 **`patient-view`** 服務：**列管／感控預警**（`infection-control-warning`）與 **72 小時內高風險重複返診**（`72hr-revisit`）。實作位置、Discovery 與路由見 [`src/emergency/emergencyServiceDefinitions.ts`](../../src/emergency/emergencyServiceDefinitions.ts)、[`src/emergency/routes.ts`](../../src/emergency/routes.ts)。

**變更請求（ECR）**：若將規則改為 **CQL／ELM 為 SSOT** 或調整臨床門檻，請先複製並填寫 [**ECR 範本**](./ecr-template.md)，取得核准並更新 [`hi_level_design.md`](../../hi_level_design.md) 與專案詳細設計後再實作。

---

## CQL／ELM（現況，兩服務共通）

已具備急診專用之 **CQL／ELM** 與 Node executor；**`USE_ELM=true`** 時優先以 ELM 評估，失敗則降級 **TypeScript** 並於 cards 標記 **`TS_FALLBACK`**（與主 CDS 行為一致）。**與主 CDS 共用**環境變數 **`USE_ELM`**（[`getUseElm()`](../../src/cds/utils.ts)）。

| 服務 | CQL 來源 | ELM 產物 | Executor |
|------|----------|----------|----------|
| `infection-control-warning` | [`cql/Infection_Control_Warning.cql`](../../cql/Infection_Control_Warning.cql) | [`elm/Infection_Control_Warning.json`](../../elm/Infection_Control_Warning.json) | [`emergencyInfectionControlElmExecutor.ts`](../../src/cql/emergencyInfectionControlElmExecutor.ts) |
| `72hr-revisit` | [`cql/Emergency_72h_Revisit.cql`](../../cql/Emergency_72h_Revisit.cql) | [`elm/Emergency_72h_Revisit.json`](../../elm/Emergency_72h_Revisit.json) | [`emergency72hRevisitElmExecutor.ts`](../../src/cql/emergency72hRevisitElmExecutor.ts) |

Hook 組裝 cards：[`infectionControlHookHandler.ts`](../../src/emergency/handlers/infectionControlHookHandler.ts)、[`revisit72hHookHandler.ts`](../../src/emergency/handlers/revisit72hHookHandler.ts)。編譯指令見 [`docs/cql_elm.md`](../cql_elm.md)。

臨床門檻與 PDF／HIR 若有修訂，仍須走 [**ECR 範本**](./ecr-template.md) 與 [`hi_level_design.md`](../../hi_level_design.md) 更新流程。

### 與主 CDS `USE_ELM`（說明）

主 CDS（`egfr-check`、`ckd-risk`、`ckd-comprehensive`）與**急診兩支 hook** 皆讀同一 **`USE_ELM`**；本機同時啟動主程式（埠 3000）與急診程式（埠 3001）且設為 `true` 時，**兩邊皆**會嘗試 ELM。`TS_FALLBACK` 與 **`urn:cds-service:rule-engine`** extension 實作可比對 [`egfrCheckHookHandler.ts`](../../src/cds/egfrCheckHookHandler.ts) 等檔案。

---

## `infection-control-warning`（列管／感控預警）

### CQL 對齊（待實作／草稿）

以下為與 **HIR** 及目前 TS 行為對應之**邏輯骨架**，供未來撰寫 `cql/Infection_Control_Warning.cql`（檔名僅為建議）時對照（**非可執行 CQL**）：

1. **Context**：`Patient`（由 `context.patientId` 解析）。
2. **FlagExists**：存在 `Flag`，`status = 'active'`，且 `code` 具 `text` 或 `coding`（特殊註記）。  
   - 對應環境變數 **`EMERGENCY_INFECT_CTRL_SKIP_FLAGS=true`** 時：CQL 可將「Flag 分支」以參數 **`SkipFlags`** 包在外層，或由 executor 在呼叫 CQL 前短路為不納入 FlagExists（**須與 TS 略過整條 Flag 邏輯一致**）。
3. **ArvMedExists**：存在 `MedicationStatement`，`medicationCodeableConcept` 之 ATC／WHOCC coding 的 `code` 以 **J05** 開頭（ARV／全身抗病毒）。
4. **TbMedExists**：同上，**J04** 開頭（結核化療）。
5. **HivOrTbDxExists**：存在 **active** `Condition`，ICD-10 編碼符合 **B20–B24**（愛滋病相關）或 **A15–A19**（結核）。
6. **Alert**：`FlagExists or ArvMedExists or TbMedExists or HivOrTbDxExists`（與 PDF 若要求「僅列管」再 AND 其他條件，須以院內文件修訂）。

### 行為需求摘要（與程式一致）

| 條件（OR，滿足任一即 **warning**） | FHIR／資料（HIR） | 程式要點 |
|-----------------------------------|-------------------|----------|
| 作用中 Flag 且有「可讀 code」 | 病患歷史**特殊註記** | `status === 'active'` + `code.text` 或 `coding`；`EMERGENCY_INFECT_CTRL_SKIP_FLAGS=true` 時整條略過 |
| 抗病毒／ARV 領藥 | **MedicationStatement**，ATC **J05\*** | `ATC_ARV_PREFIX = 'J05'` |
| 結核相關用藥 | **MedicationStatement**，ATC **J04\*** | `ATC_TB_PREFIX = 'J04'` |
| 愛滋／結核相關診斷 | **Condition**（active），ICD-10 **B20–B24** 或 **A15–A19** | 正則 `^B2[0-4]`、`^A1[5-9]`（去小數點後比對） |

皆不成立時回傳 **info** 卡片。

### FHIR 搜尋與 HAPI 限制（感控）

- **Flag**：`searchFlagsForPatient` 僅使用 `Flag?patient=&_count=`（**不**使用 `status` query）；**active** 於 CDS 端依 `resource.status` 過濾。
- **MedicationStatement**、**Condition**：見 [`src/fhir/fhirClient.ts`](../../src/fhir/fhirClient.ts)。

### Prefetch（Discovery）

見 `emergencyInfectionControlService`：`patient`、`flags`、`medicationStatements`、`conditions`。

---

## `72hr-revisit`（72 小時內高風險重複返診）

### TS 實作位置

[`src/emergency/handlers/revisit72hHookHandler.ts`](../../src/emergency/handlers/revisit72hHookHandler.ts)

### 行為摘要（與程式一致）

- **時間窗**：預設 **72** 小時，環境變數 **`EMERGENCY_REVISIT_WINDOW_HOURS`**（正整數，無效則用預設）。
- **門檻**：時間窗內 **`Encounter` 筆數**預設 **≥ 2** 則 **warning**，否則 **info**；門檻由 **`EMERGENCY_REVISIT_MIN_ENCOUNTERS`** 控制。  
  - **去重**：僅當資源具非空字串之 **`id`** 時才以 `id` 去重；**無 `id` 或 `id` 為空**時，每一筆仍各計一次（與 [`revisit72hHookHandler.ts`](../../src/emergency/handlers/revisit72hHookHandler.ts) 一致）。
- **時間基準**：各筆 Encounter 以 **`period.start`** 解析為即時；納入條件為 **start ∈ \[now − window, now\]**（閉區間端點與 TS `Date` 比較一致）。
- **選用類別過濾**：若設定 **`EMERGENCY_ENCOUNTER_CLASS_CODES`**（逗號分隔 `Encounter.class.coding.code`），僅統計列於清單內之 Encounter；**未設定**則不過濾 class。
- **資料來源**：`prefetch.recentEncounters` 有資料則用之，否則 **`searchEncountersForPatient(patientId, { count: 50 })`**（預設 `_count=50`）。Discovery 之 prefetch 模板為 `_count=30`，與補位查詢之上限可並存；以程式為準。

### 環境變數一覽（72hr）

| 變數 | 預設行為（程式） |
|------|------------------|
| `EMERGENCY_REVISIT_WINDOW_HOURS` | 72（小時） |
| `EMERGENCY_REVISIT_MIN_ENCOUNTERS` | 2 |
| `EMERGENCY_ENCOUNTER_CLASS_CODES` | 空＝全部 class；有值則 allowlist |

### FHIR 與 Prefetch（72hr）

- Discovery：`patient`、`recentEncounters`（`Encounter?patient=…&_sort=-date&_count=30`）。
- 伺服端搜尋：見 `fhirClient.searchEncountersForPatient`（`_sort: '-date'`、`_count` 可調）。

### CQL 對齊（待實作／草稿）

供未來撰寫 `cql/Emergency_72h_Revisit.cql`（檔名僅為建議）時對照（**非可執行 CQL**）：

1. **Context**：`Patient`（由 `context.patientId` 解析）。
2. **Encounters**：取得該病患之 `Encounter` 清單（與 prefetch／搜尋範圍對齊之語意須在設計中訂明）。
3. **ClassFilter**：若對應 **`EMERGENCY_ENCOUNTER_CLASS_CODES`**，僅保留 `class.coding.code` 落在允許集合之 Encounter；未設定參數則略過此步驟。
4. **WindowFilter**：保留 `period.start` 落在 **`Now - windowHours`** 至 **`Now`**（含邊界語意與 TS 一致）之 Encounter。
5. **DedupCount**：有 **`id`** 者以 `id` 去重後計數；**無 `id`** 之各筆 Encounter 各計一次（勿與有 id 之去重語意混淆）。
6. **Alert**：計數 **≥ `MinEncounters`** 則為高風險（warning），否則 info。

**`Now` 與 TS 對齊**：CQL 常見作法為定義 **`parameter "Now" System.DateTime`**（或由呼叫端以 `ExecutionRequest` 等注入評估時刻）。TS 使用 **`new Date()`**（伺服器本地／UTC 行為依執行環境）；實作 ELM 時**必須**與院內約定之「評估基準時刻」一致，避免與 TS 漂移。

### 測資與維護

- Bundle 與 README：[`case-08-emergency-72h-revisit-patient-ckd-001.bundle.json`](../../input/tests/fhir/case-08-emergency-72h-revisit-patient-ckd-001.bundle.json)、[`case-08-emergency-72h-revisit-patient-ckd-001.README.md`](../../input/tests/fhir/case-08-emergency-72h-revisit-patient-ckd-001.README.md)（**`period.start` 須落在測試當下之 72h 內**）。

---

## 測資總表（兩服務）

| 服務 | 檔案 | 病患／說明 |
|------|------|------------|
| 72hr-revisit | [`case-08-emergency-72h-revisit-patient-ckd-001.bundle.json`](../../input/tests/fhir/case-08-emergency-72h-revisit-patient-ckd-001.bundle.json) | `patient-ckd-001`（[README](../../input/tests/fhir/case-08-emergency-72h-revisit-patient-ckd-001.README.md)） |
| infection-control-warning | [`case-09-emergency-infection-control-patient-ckd-001.bundle.json`](../../input/tests/fhir/case-09-emergency-infection-control-patient-ckd-001.bundle.json) | `patient-ckd-001`（[README](../../input/tests/fhir/case-09-emergency-infection-control-patient-ckd-001.README.md)） |
| infection-control-warning | [`case-09-1-emergency-infection-control-patient-ckd-002.bundle.json`](../../input/tests/fhir/case-09-1-emergency-infection-control-patient-ckd-002.bundle.json) | `patient-ckd-002`（HIR；[README](../../input/tests/fhir/case-09-1-emergency-infection-control-patient-ckd-002.README.md)） |
