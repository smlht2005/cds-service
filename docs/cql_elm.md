<!--
更新時間：2026-04-20 13:57
作者：CDS Service
摘要：補急診 Infection_Control_Warning、Emergency_72h_Revisit 之 Maven 編譯範例行

更新時間：2026-04-15 12:11
作者：CDS Service
摘要：相關文件加入 docs/qa/README.md（CQL／ELM／UCUM QA 紀錄）

更新時間：2026-04-15 12:07
作者：CDS Service
摘要：方式二補充 Maven＋cql-to-elm-cli（scripts/cql-compile-pom.xml）實際指令；UCUM mL/min/1.73/m2

更新時間：2026-04-15 11:11
作者：CDS Service
摘要：CQL→ELM 編譯說明、產物路徑與執行期依賴（cql-execution）；與 cql/EGFR_Check.cql 對齊
-->

# CQL 與 ELM（Expression Logical Model）

## 為什麼需要 ELM？

- **Node.js / 瀏覽器無法直接執行** `.cql` 文字檔。
- 標準流程為：**CQL 原始碼** →（**CQL→ELM 編譯器**）→ **ELM JSON** →（**`cql-execution`**）→ 執行結果。
- 本專案規則來源為 [`cql/EGFR_Check.cql`](../cql/EGFR_Check.cql)；執行期目標產物建議置於 **`elm/EGFR_Check.json`**（檔名可依團隊慣例調整，但需與程式載入路徑一致）。

## 建議目錄配置

| 路徑 | 說明 |
|------|------|
| [`cql/EGFR_Check.cql`](../cql/EGFR_Check.cql) | 人類可讀、版控之 **CQL 來源** |
| `elm/EGFR_Check.json` | **ELM JSON**（編譯產物，建議一併版控） |
| [`src/cql/egfrRecheckEvaluation.ts`](../src/cql/egfrRecheckEvaluation.ts) | 過渡用 **TS 對齊層**（未接 ELM 前與 CQL 決策一致） |

> 若尚未產出 `elm/EGFR_Check.json`，CDS 仍可依環境變數走 TS 對齊層（見 `dev_readme.md` 與遷移計畫）。

---

## 方式一：VS Code（CQL 外掛）

以下為**一般性**步驟，實際選單名稱依你所安裝的 CQL / FHIR 外掛版本為準：

1. 安裝 **Clinical Quality Language (CQL)** 相關擴充功能（或院內指定套件）。
2. 在編輯器中開啟 `cql/EGFR_Check.cql`。
3. 使用外掛提供的 **Compile / Translate to ELM** 類指令，將輸出儲存為 **`elm/EGFR_Check.json`**。
4. 確認 ELM 內含與下列 CQL 對應之定義（名稱需一致）：
   - `Needs Recheck`
   - `Recommendation Summary`
   - `Recommendation Detail`

**注意**：`include FHIRHelpers` 與 `using FHIR version '4.0.1'` 需讓編譯器能解析對應 IG／函式庫；若編譯失敗，請在外掛設定中指定 **FHIR R4** 與 **FHIRHelpers** 路徑（或依外掛文件加入 dependency）。

---

## 方式二：Maven＋`cql-to-elm-cli`（CQFramework，本專案已附 helper POM）

已安裝 **Java**、**Maven** 時，可於專案根目錄執行（會下載 CQFramework 3.26.0 依賴並將 ELM 寫入 `elm/EGFR_Check.json`）：

```powershell
cd "c:\Development\HISCore\CDS Service"
mvn -f scripts/cql-compile-pom.xml exec:java "-Dexec.args=--input cql/EGFR_Check.cql --output elm/EGFR_Check.json --format JSON"
```

- Helper POM 路徑：[`scripts/cql-compile-pom.xml`](../scripts/cql-compile-pom.xml)（內含 `exec-maven-plugin`、`workingDirectory` 設為專案根，以便解析 `cql/`）。
- 編譯器可能對 `FHIRHelpers` 多載回報 **warning**（`CqlToElmError` 且 `errorSeverity: warning`）；與 **UCUM 單位無法解析**（先前 `'mL/min/1.73m2'` → `73m`）之 **error** 不同。門檻單位請使用 **`'mL/min/1.73/m2'`**（見 `cql/EGFR_Check.cql`）。

亦可自行組 **classpath** 後呼叫 `org.cqframework.cql.cql2elm.cli.Main`（舊版示意）：

```powershell
# java -cp ... org.cqframework.cql.cql2elm.cli.Main --input cql/EGFR_Check.cql --output elm/EGFR_Check.json --format JSON
```

編譯成功後，請確認 **`elm/EGFR_Check.json`** 已生成且可被 JSON 解析。

### 急診獨立 CDS（`infection-control-warning`／`72hr-revisit`）

```powershell
cd "c:\Development\HISCore\CDS Service"
mvn -f scripts/cql-compile-pom.xml exec:java "-Dexec.args=--input cql/Infection_Control_Warning.cql --output elm/Infection_Control_Warning.json --format JSON"
mvn -f scripts/cql-compile-pom.xml exec:java "-Dexec.args=--input cql/Emergency_72h_Revisit.cql --output elm/Emergency_72h_Revisit.json --format JSON"
```

---

## 執行期（Node）依賴（遷移實作時）

接續將於 `package.json` 加入（版本以實作時鎖定為準）：

- `cql-execution`：執行 ELM。
- `cql-exec-fhir`：FHIR R4 資料模型與 `Patient` 情境。

並以環境變數（計畫中）**`USE_ELM=true`** 切換 **ELM** 與 **TS 對齊層**。

---

## 驗證檢查清單

- [ ] `cql/EGFR_Check.cql` 可成功編譯為 ELM，無錯誤。
- [ ] `elm/EGFR_Check.json` 已提交或由 CI 產出且可重現。
- [ ] 與測試病患（如 `patient-ckd-001`）資料搭配時，`Needs Recheck` 與 TS 路徑結果一致（金樣比對）。

---

## 相關文件

- [`dev_readme.md`](../dev_readme.md) — 專案指令與環境變數。
- [`docs/E2E_Test_Plan.md`](E2E_Test_Plan.md) — 含未來 **TC-CQL-ELM-xx** 案例時之前置條件。
- [`docs/qa/README.md`](qa/README.md) — **CQL／ELM／UCUM QA 紀錄**（問題排查、驗證清單、warning／error 區別）。
