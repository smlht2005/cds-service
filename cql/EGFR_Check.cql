// 階段三：臨床邏輯來源（CQL）
// 更新時間：2026-04-15 15:17
// 作者：CDS Service
// 摘要：FHIRHelpers 版本由 4.0.1 調整為 4.1.0（對齊 cql/FHIRHelpers.cql），供 ELM 執行期正確 resolve includes
//
// 更新時間：2026-04-15 12:05
// 作者：CDS Service
// 摘要：Needs Recheck 門檻 UCUM 由 'mL/min/1.73m2' 改為 'mL/min/1.73/m2'，避免 CqlToElmError（73m 解析錯誤）
// 更新時間：2026-04-15 09:32
// 說明：與 src/cql/egfrRecheckEvaluation.ts 規則對齊；未來可改以 ELM / 引擎執行取代 TS 評估層

// 1. Library 宣告與版本
library EGFR_Check version '1.0.0'

// 2. 指定使用 FHIR R4 規範
using FHIR version '4.0.1'

// 3. 引入標準輔助函式（用於將 FHIR 資料轉換為 CQL 可運算的型別）
include FHIRHelpers version '4.1.0'

// 定義代碼系統與 LOINC Code
codesystem "LOINC": 'http://loinc.org'
code "eGFR Code": '62238-1' from "LOINC"

// 4. 定義上下文為 Patient，這代表邏輯是針對「單一患者」執行的
context Patient

// 5. 從 Observation 中取得最新 eGFR 數值的 Expression
define "eGFR Observations":
  [Observation: "eGFR Code"] Obs
    where Obs.status in { 'final', 'amended' }
    sort by effective desc

// 取得最新的數值（Quantity）
define "Latest eGFR Value":
  (First("eGFR Observations")).value as Quantity

// 6. 觸發建議的條件判斷 Expression
define "Needs Recheck":
  "Latest eGFR Value" is not null
    and "Latest eGFR Value" < 60 'mL/min/1.73/m2'

// 定義回傳給 CDS Service 的摘要文字
define "Recommendation Summary":
  '偵測到患者最近一次 eGFR 數值偏低'

define "Recommendation Detail":
  '患者最新 eGFR 為 ' + ToString("Latest eGFR Value".value) + ' ' + "Latest eGFR Value".unit +
  '，低於正常門檻值 60，建議安排腎功能複查以確認病況發展。'
