<!--
更新時間：2026-04-16 14:12
作者：CDS Service
摘要：新增 ckd-comprehensive（CPG + Risk + Testing）說明：規則表、三服務關係圖、ELM 載入與 null（資料不足）原則
-->

# ckd-comprehensive（CKD 綜合風險評估）服務說明

## 服務定位

`ckd-comprehensive` 是 CKD CDS 服務群的「整合層」：透過 CQL `include` 方式引用既有 [`cql/CKD_Risk.cql`](../../cql/CKD_Risk.cql)（不重寫既有術語與 define），並新增 NKF CPG 轉換而來的綜合規則，輸出分層 Cards（critical／warning／info）。

## 服務關係圖（ASCII）

```
┌──────────────────────────────────────────────────────────┐
│                      ckd-comprehensive                    │
│                  (CDS Hook: patient-view)                 │
│                                                          │
│  cql/CKD_Comprehensive.cql                                │
│  ├── include CKD_Risk called Risk                         │
│  │     ├── AgeOver60 / HasDiabetes / HasHypertension      │
│  │     ├── HasHeartDisease / HasObesity                   │
│  │     ├── MissingeGFR / MissinguACR                      │
│  │     └── MostRecentEgfrValue / MostRecentUacrValue      │
│  └── 新增 defines（CPG 來源）                             │
│        ├── HighRiskProfile                                │
│        ├── AnnualUACROverdue                              │
│        ├── ImmediateReferralNeeded                        │
│        ├── CriticalTestingGap                             │
│        └── ComprehensiveRiskScore                         │
└──────────────────────────────┬───────────────────────────┘
                               │ 不修改、不覆寫
              ┌────────────────┴────────────────┐
              │                                 │
┌─────────────▼─────────────┐     ┌─────────────▼─────────────┐
│          egfr-check        │     │           ckd-risk          │
│（獨立服務：eGFR < 60 複查）│     │（獨立服務：CKD_Risk 規則集）│
└───────────────────────────┘     └───────────────────────────┘
```

## 新增規則說明（CPG → CQL 摘要）

| 規則名（define） | CPG 來源 | 觸發條件（摘要） | Card 類型 | Evidence Grade |
|---|---|---|---|---|
| `HighRiskProfile` | NKF Risk Factors | Diabetes OR HTN OR Age>60（遇到資料不足則回傳 null） | info | B |
| `AnnualUACROverdue` | NKF Recommendation A | HighRiskProfile=true AND MissinguACR=true | warning | A |
| `ImmediateReferralNeeded` | NKF Recommendation B | MostRecentEgfrValue < 30 | warning | A |
| `CriticalTestingGap` | NKF Testing Protocol | MissingeGFR=true AND MissinguACR=true | critical | A |
| `ComprehensiveRiskScore` | 綜合 | 命中風險因子數（0–5；任一風險因子資料不足則回傳 null） | info（摘要用） | N/A |

## Prefetch（Discovery 範本）

可參考 [`ckd-comprehensive-hook.json`](ckd-comprehensive-hook.json)。

- `patient`：Patient/{{context.patientId}}
- `conditions`：active Conditions
- `observations`：近 12 個月 eGFR / uACR / BMI Observations（多 LOINC）
- `latestEgfr`：最新單筆 eGFR（便於除錯；服務端仍以 hybrid 合併處理）

## Rule engine 部署（CQL/ELM）

### 必要 ELM 檔案

當後端設 `USE_ELM=true` 時，`ckd-comprehensive` 需要同時載入：

- `elm/FHIRHelpers.json`
- `elm/CKD_Risk.json`（被 include）
- `elm/CKD_Comprehensive.json`（主執行入口）

### CQL → ELM（Maven）

編譯方式請見 [`docs/cql_elm.md`](../cql_elm.md)。範例：

```powershell
cd "c:\Development\HISCore\CDS Service"
mvn -f scripts/cql-compile-pom.xml exec:java "-Dexec.args=--input cql/CKD_Comprehensive.cql --output elm/CKD_Comprehensive.json --format JSON"
```

## null（資料不足）處理原則

- 本服務遵守 **三態邏輯**：任何風險因子旗標若為 `null`，代表「資料不足」，不得視為 `false` 或 `true`。
- UI/卡片 detail 會以繁中標註「資料不足，請人工確認」，避免誤導臨床決策。

## TODO v2

- [ ] 納入 `egfr-check` 趨勢規則（連續兩次 eGFR < 60）
- [ ] 實作 3 個月持續性判斷（eGFR < 60 AND uACR > 30 持續 ≥ 3 個月 → 確診 CKD 提示）

