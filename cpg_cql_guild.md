<!--
更新時間：2026-04-16 15:38
作者：CDS Service
摘要：彙整 CPG→CQL 落地關鍵要點（QA/Checklist）：元素拆解、FHIR/Code 對應、tri-state、ELM 執行與 Cards 映射
-->

# CPG → CQL 落地 QA 指引（Checklist）

本文件用於將 **CPG（Clinical Practice Guideline）** 轉換為可執行之 **CQL/ELM**，並落地到 **CDS Hooks** 的過程中，提供可重複使用的 QA 檢查清單。

參考範例與專案實作：`ckd-risk`、`ckd-comprehensive`。

---

## 1) CPG 元素拆解（必做）

將每一條 CPG 建議句拆成五個元素，才能落到可實作的規則：

- **Recommendation**：建議內容（要做什麼）
- **Trigger**：何時觸發（例：CDS Hooks `patient-view`）
- **Condition**：成立條件（FHIR 資源 + code + 時間範圍 + 邏輯）
- **Action**：輸出行為（cards summary/detail/indicator）
- **Strength of Evidence**：實證等級（A/B/C…，寫入 card extension）

### QA Check
- [ ] 每條規則都能明確寫出上述 5 欄位，不可缺漏。
- [ ] Trigger 與服務 hook 類型一致（例：`patient-view`）。

---

## 2) Condition 必須可機器執行（FHIR + Codes）

每個條件必須對應到 FHIR R4 可取得的資源與欄位，並明確標註代碼：

- **資源類型**：`Patient` / `Condition` / `Observation` / `FamilyMemberHistory` …
- **Coding 系統**：LOINC / ICD-10 / SNOMED CT
- **代碼集合**：具體 codes（例：eGFR `62238-1, 33914-3`；AKI `N17*`；Family history CKD `709044004`）
- **時間範圍**：例「近 12 個月」→ 對應查詢 `date=ge{{today-365}}`

### QA Check
- [ ] 每個 Condition 都寫出「資源類型 + code system + code」。
- [ ] 時間範圍（若有）能在 prefetch / FHIR search 表達出來。
- [ ] 不要用「文字敘述」代替 codes（避免不可執行）。

---

## 3) Tri-state（true/false/null）是臨床規則落地核心

在臨床資料中，**資料不足**必須保留為 `null`，不可當成 `false`：

- **CQL**：條件判斷使用 `is true` / `is false`，避免 `null` 被當成 false。
- **TS fallback**：不可用 `Boolean(x)`、`|| false` 抹平 null。
- **Cards**：detail 必須標註「資料不足，請人工確認」。

### QA Check
- [ ] 風險因子旗標（Risk flags）若缺必要資料，回傳 `null`（insufficient data）。
- [ ] 聚合規則（例如 HighRiskProfile）不得因一個條件 `false` 就忽略其他條件 `null` 的不確定性；需明確定義 tri-state 合成策略。

---

## 4) 命名規範與可追溯性（Traceability）

建議 `define` 命名使用一致格式（例：`[Domain][Action][Qualifier]`），並在每個 define 上方寫明：

- `CPG Source`
- `Evidence Grade`

### QA Check
- [ ] define 名稱可讀、可對照規則意圖。
- [ ] 每個 define 都能追溯回 CPG 來源與證據等級。

---

## 5) CQL → ELM → Executor（可執行鏈）

標準執行鏈：

1. CQL 原始碼（版控）  
2. 編譯成 ELM JSON（可版控）  
3. Node 執行期用 `cql-execution` + `cql-exec-fhir` 執行  

### QA Check
- [ ] ELM 編譯成功，且 `includes`（如 `FHIRHelpers`、被 include 的 library）版本可 resolve。
- [ ] 執行期載入的 repository 包含所有依賴 library（例：`FHIRHelpers` + `CKD_Risk` + `CKD_Comprehensive`）。
- [ ] 若 ELM 失敗，fallback（TS）需標記 `TS_FALLBACK`，並保持規則語意一致。

---

## 6) Condition → Cards 的映射（CDS Hooks 輸出）

規則結果需要映射成 cards，並建立明確的優先序：

- **優先序**（範例）：critical → warning → info
- **內容**：`summary`（短句）、`detail`（可含 codes/原因/提醒）
- **extension**：至少保留 `urn:cds-service:rule-engine`（ELM/TS/TS_FALLBACK），其餘 meta 以額外 url 方式擴充（避免破壞既有解析）

### QA Check
- [ ] priority 規則一致且可測（critical 不被低優先權覆蓋）。
- [ ] cards detail 不得產生誤導（尤其 null/資料不足情境）。

---

## 7) 測試資料與測試方法（E2E/手測）

要驗證規則，必須具備「可重現」的測資：

- transaction Bundles 使用 PUT 固定 id（可重複匯入覆蓋）
- 針對每條規則準備「命中」與「未命中」的病患資料
- 對照 Prefetch ON/OFF（hybrid）應產生一致 cards 結論（FHIR 資料不變時）

### QA Check
- [ ] 每條新規則都有至少一組測資可命中。
- [ ] Prefetch OFF（後端抓）與 Prefetch ON（前端組）結論一致。

