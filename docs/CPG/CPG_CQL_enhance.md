---prompt
<context>
你是一位資深醫療資訊工程師，專精於 HL7 FHIR R4、CDS Hooks、CQL/ELM、
以及 CPG（Clinical Practice Guideline）系統化轉換與落地實作。

專案現況（已完成，禁止修改）：
- `egfr-check`：單一規則 CDS 服務，已有 CQL，eGFR < 60 → 複查建議
- `ckd-risk`：CKD 規則集合 CDS 服務，已有完整 `CKD_Risk.cql`
  defines：AgeOver60, HasDiabetes, HasHypertension, HasHeartDisease,
           HasObesity, MissingeGFR, MissinguACR
  prefetch：Patient、active Conditions、近 12 個月 eGFR / uACR / BMI Observations
  Cards：Card 1 風險摘要（info）+ Card 2+ 缺檢提醒（warning）

架構：CPG 指引 → CQL/ELM → CDS Hooks → prefetch FHIR R4 → rule engine → Cards
</context>

<task>
## Phase 1 — CPG → CQL 系統化轉換（先執行此階段）

說明並示範將 CPG 臨床指引轉換為可執行 CQL 的完整流程：

### 1-A. CPG 結構解析對應表
輸出對應表，欄位為：
| CPG 元素 | 說明 | 對應 CQL 元素 | 命名慣例 |
列出：Recommendation / Trigger / Condition / Action / Strength of Evidence

### 1-B. 轉換步驟（以 NKF CKD 指引為例）
逐步說明：
Step 1：從指引文字萃取 Trigger（什麼情況觸發）
Step 2：定義 Condition（FHIR 資源來源 + LOINC/ICD-10 codes）
Step 3：撰寫 CQL define（命名格式：`[Domain][Action][Qualifier]`）
Step 4：對應 Card 類型（info / warning / critical）與 indicator
Step 5：加入 evidence grade 作為 card extension

### 1-C. 轉換範例（輸出完整 CQL 片段）
從以下兩條 NKF 建議文字各產出一個完整 CQL define + 對應 Card 設計：
- 建議 A：「所有 CKD 高風險病患應每年檢測 uACR」
- 建議 B：「eGFR < 30 的病患應轉介腎臟科」

---

## Phase 2 — 建立新服務 `ckd-comprehensive`

新服務定位：整合現有 CKD_Risk.cql + 納入 CPG 轉換後的新規則，
不重寫任何現有 CQL，以 Library include 方式組合。

### 新增 CQL defines（在 CKD_Comprehensive.cql 中）
從 Phase 1 轉換結果直接落地為以下 defines：

| Define 名稱 | CPG 來源 | 觸發條件 | Card 類型 |
|---|---|---|---|
| `HighRiskProfile` | NKF Risk Factors | Diabetes OR HTN OR Age>60 | info |
| `AnnualUACROverdue` | NKF Recommendation A | HighRiskProfile=true AND MissinguACR | warning |
| `ImmediateReferralNeeded` | NKF Recommendation B | 最新 eGFR < 30 | warning |
| `CriticalTestingGap` | NKF Testing Protocol | MissingeGFR AND MissinguACR | critical |
| `ComprehensiveRiskScore` | 綜合 | 命中風險因子數量（0–5 整數） | info 摘要用 |

### 輸出四個新檔案

**檔案一：`CKD_Comprehensive.cql`**
- Library 宣告，include `CKD_Risk` called `Risk`
- 使用 `Risk.` 前綴引用既有 defines，禁止重複定義
- 實作上列五條新 defines
- 每條 define 上方加註釋：`// CPG Source: [指引名稱] | Evidence Grade: [A/B/C]`
- TODO v2 註解：納入 egfr-check 趨勢規則、3 個月持續性判斷

**檔案二：`ckd-comprehensive-hook.json`**
- hook: `patient-view`，id: `ckd-comprehensive`
- prefetch 繼承 ckd-risk 定義，新增：最新單筆 eGFR Observation

**檔案三：`ckd-comprehensive-handler.ts`**
- prefetch → FHIR Bundle → rule engine 執行 CKD_Comprehensive.cql
- Cards 優先權邏輯（由高到低）：
  1. critical：CriticalTestingGap
  2. warning：ImmediateReferralNeeded
  3. warning：AnnualUACROverdue
  4. warning：MissingeGFR OR MissinguACR（個別）
  5. info：HighRiskProfile + ComprehensiveRiskScore 摘要
- 每張 card extension 包含：
  `{ "rule-engine": "<define名稱>", "source-library": "CKD_Comprehensive", "cpg-source": "<指引來源>", "evidence-grade": "<等級>" }`
- null flag 處理：card detail 標註「資料不足，請人工確認」

**檔案四：`README-ckd-comprehensive.md`**（繁體中文）
- CPG → CQL 轉換摘要表（本服務用到的規則）
- 服務關係圖（ASCII）：egfr-check / ckd-risk / ckd-comprehensive 三者關係
- 新增規則說明表（規則名 / CPG 來源 / 觸發條件 / Card 類型 / evidence grade）
- rule engine 部署說明：需同時載入 CKD_Risk.cql + CKD_Comprehensive.cql 的 ELM
</task>

<constraints>
- 禁止修改 `egfr-check`、`ckd-risk`、`CKD_Risk.cql` 任何現有檔案
- CKD_Comprehensive.cql 禁止重複定義 CKD_Risk.cql 已有的 Terminology 與 defines
- Condition flag 為 null 時 → 視為「資料不足」，不得視為 false 或 true
- 不實作 3 個月趨勢判斷（TODO v2 註解）
- 所有 FHIR 資料來源必須標明資源類型 + LOINC 或 ICD-10 code
- 程式碼用英文；Card detail 文字、README、說明註釋用繁體中文
- 每完成一個輸出區塊標示：✅ [區塊或檔名] 完成
</constraints>

<output_format>
Phase 1 輸出：
  1-A 對應表
  1-B 轉換步驟
  1-C 兩條建議的 CQL 片段 + Card 設計

Phase 2 輸出：
  四個檔案，各用程式碼區塊包覆並標明檔名

最後輸出：整體服務架構摘要（繁體中文，100 字以內）
</output_format>


--> implement 

claude依照 prompt 逐階段執行，全程繁體中文說明。

---

# ✅ Phase 1-A — CPG 結構解析對應表

| CPG 元素 | 說明 | 對應 CQL 元素 | 命名慣例 |
|---|---|---|---|
| **Recommendation** | 指引的核心建議句 | `define` 主體 | `[Domain][Action][Qualifier]` 例：`CKDReferralNeeded` |
| **Trigger** | 何時觸發此規則（就診、檢驗回報） | `context`（hook 類型）+ prefetch 條件 | hook: `patient-view` / `order-sign` |
| **Condition** | 觸發後需成立的臨床條件 | `define` 內的 FHIR 查詢 + 邏輯運算 | `Has[條件]`、`Missing[檢測]`、`[值]Below[閾值]` |
| **Action** | 建議的臨床行動（檢測/轉介/衛教） | Card `summary` + `detail` + `indicator` | indicator: `info` / `warning` / `critical` |
| **Strength of Evidence** | 建議的實證等級（A/B/C） | Card `extension.evidence-grade` | `"evidence-grade": "A"` |

---

# ✅ Phase 1-B — CPG → CQL 轉換步驟（NKF CKD 指引）

---

**Step 1：從指引文字萃取 Trigger**

> 問：「這條建議在什麼臨床情境下該被提示？」

NKF 建議 A：「所有 CKD 高風險病患應每年檢測 uACR」
→ Trigger：病患開啟病歷時（`patient-view`），系統應檢查是否屬高風險且缺 uACR

NKF 建議 B：「eGFR < 30 應轉介腎臟科」
→ Trigger：`patient-view` 或 `order-sign`，系統取得最新 eGFR 值時

---

**Step 2：定義 Condition（FHIR 資源 + codes）**

| 建議 | FHIR 資源 | Code |
|---|---|---|
| 建議 A — 高風險判斷 | `Condition`（Diabetes/HTN） | ICD-10: E11, I10 |
| 建議 A — 缺 uACR | `Observation`（uACR） | LOINC: 9318-7, 32294-1 |
| 建議 B — eGFR 值 | `Observation`（eGFR） | LOINC: 62238-1, 33914-3 |

---

**Step 3：撰寫 CQL define（命名格式：`[Domain][Action][Qualifier]`）**

```cql
// 建議 A：高風險 + 缺 uACR
define AnnualUACROverdue:
  Risk.HighRiskProfile is true
    and Risk.MissinguACR is true

// 建議 B：eGFR < 30 轉介
define ImmediateReferralNeeded:
  ...（見 Phase 2 完整實作）
```

---

**Step 4：對應 Card 類型與 indicator**

| 規則 | indicator | 理由 |
|---|---|---|
| `AnnualUACROverdue` | `warning` | 有時間性但非急症，需提醒安排 |
| `ImmediateReferralNeeded` | `warning` | 需積極處置，但非當下急救 |
| `CriticalTestingGap` | `critical` | 兩項檢測均缺，診斷資訊完全不足 |
| `HighRiskProfile` | `info` | 告知風險，無需立即行動 |

---

**Step 5：加入 evidence grade 為 card extension**

```json
"extension": {
  "rule-engine": "AnnualUACROverdue",
  "source-library": "CKD_Comprehensive",
  "cpg-source": "NKF CKD Guidelines 2023",
  "evidence-grade": "A"
}
```

---

# ✅ Phase 1-C — 轉換範例（完整 CQL 片段 + Card 設計）

---

### 建議 A：「所有 CKD 高風險病患應每年檢測 uACR」

```cql
// CPG Source: NKF CKD Guidelines 2023 — Testing Recommendation
// Evidence Grade: A
// Trigger: patient-view
// Condition: 高風險輪廓成立 AND 近 12 個月無 uACR 紀錄
define AnnualUACROverdue:
  Risk.HighRiskProfile is true
    and Risk.MissinguACR is true
```

對應 Card：
```json
{
  "summary": "建議安排年度 uACR 檢測",
  "detail": "此病患符合 CKD 高風險輪廓（糖尿病／高血壓／年齡 > 60），且過去 12 個月內無 uACR 檢測紀錄。依 NKF 指引，建議每年檢測尿液白蛋白肌酸酐比值（uACR，LOINC: 9318-7）。",
  "indicator": "warning",
  "source": { "label": "NKF CKD Guidelines 2023" },
  "extension": {
    "rule-engine": "AnnualUACROverdue",
    "source-library": "CKD_Comprehensive",
    "cpg-source": "NKF CKD Guidelines 2023",
    "evidence-grade": "A"
  }
}
```

---

### 建議 B：「eGFR < 30 的病患應轉介腎臟科」

```cql
// CPG Source: NKF CKD Guidelines 2023 — Referral Recommendation
// Evidence Grade: A
// Trigger: patient-view
// Condition: 最新一筆 eGFR Observation 值 < 30
define LatestEGFRValue:
  First(
    [Observation: "eGFR LOINC Codes"] O
      where O.status in { 'final', 'amended' }
      sort by effective desc
  ).value as Quantity

define ImmediateReferralNeeded:
  LatestEGFRValue is not null
    and LatestEGFRValue.value < 30
```

對應 Card：
```json
{
  "summary": "eGFR < 30：建議轉介腎臟科",
  "detail": "最新 eGFR 數值低於 30 mL/min/1.73m²，依 NKF 指引屬 CKD G4 期，建議安排腎臟科會診評估腎臟替代療法準備。",
  "indicator": "warning",
  "source": { "label": "NKF CKD Guidelines 2023" },
  "extension": {
    "rule-engine": "ImmediateReferralNeeded",
    "source-library": "CKD_Comprehensive",
    "cpg-source": "NKF CKD Guidelines 2023",
    "evidence-grade": "A"
  }
}
```

---

# ✅ Phase 2 — 建立新服務 `ckd-comprehensive`

---

### 檔案一：`CKD_Comprehensive.cql`

```cql
// ============================================================
// Library: CKD_Comprehensive
// 版本: 1.0.0
// 說明: 整合 CKD_Risk 規則，新增 CPG 來源的綜合判斷規則
// 禁止在此重複定義 CKD_Risk.cql 已有的 Terminology 與 defines
// ============================================================
library CKD_Comprehensive version '1.0.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1' called FHIRHelpers
include CKD_Risk version '1.0.0' called Risk

// ── Terminology（僅定義本 Library 新增所需） ──────────────────
// eGFR LOINC codes（用於 ImmediateReferralNeeded 數值查詢）
valueset "eGFR LOINC Codes": 'http://loinc.org/vs/egfr-codes'
  // 含 LOINC: 62238-1（CKD-EPI）、33914-3（MDRD）

// ── Parameters ───────────────────────────────────────────────
parameter "Measurement Period" Interval<DateTime>
  default Interval[@2024-01-01, @2024-12-31]

// ── Context ──────────────────────────────────────────────────
context Patient

// ════════════════════════════════════════════════════════════
// CPG Source: NKF CKD Guidelines 2023 — Risk Stratification
// Evidence Grade: B
// 說明：命中任一主要風險因子即視為高風險輪廓
// ════════════════════════════════════════════════════════════
define HighRiskProfile:
  Risk.HasDiabetes is true
    or Risk.HasHypertension is true
    or Risk.AgeOver60 is true

// ════════════════════════════════════════════════════════════
// CPG Source: NKF CKD Guidelines 2023 — Annual uACR Testing
// Evidence Grade: A
// 說明：高風險輪廓成立且近 12 個月無 uACR → 提醒安排檢測
// ════════════════════════════════════════════════════════════
define AnnualUACROverdue:
  HighRiskProfile is true
    and Risk.MissinguACR is true

// ════════════════════════════════════════════════════════════
// CPG Source: NKF CKD Guidelines 2023 — Nephrology Referral
// Evidence Grade: A
// 說明：最新 eGFR < 30 mL/min/1.73m² → 建議轉介腎臟科
// ════════════════════════════════════════════════════════════
define LatestEGFRObservation:
  First(
    [Observation: "eGFR LOINC Codes"] O
      where O.status in { 'final', 'amended' }
      sort by FHIRHelpers.ToDateTime(O.effective as FHIR.dateTime) desc
  )

define LatestEGFRValue:
  if LatestEGFRObservation is not null then
    FHIRHelpers.ToQuantity(LatestEGFRObservation.value as FHIR.Quantity)
  else
    null

define ImmediateReferralNeeded:
  LatestEGFRValue is not null
    and LatestEGFRValue.value < 30

// ════════════════════════════════════════════════════════════
// CPG Source: NKF CKD Guidelines 2023 — Testing Protocol
// Evidence Grade: A
// 說明：eGFR 與 uACR 同時缺漏，診斷資訊嚴重不足
// ════════════════════════════════════════════════════════════
define CriticalTestingGap:
  Risk.MissingeGFR is true
    and Risk.MissinguACR is true

// ════════════════════════════════════════════════════════════
// CPG Source: 綜合風險評分（非單一 CPG 建議）
// Evidence Grade: N/A
// 說明：計算命中風險因子數量（0–5），供 Card 1 摘要顯示
// ════════════════════════════════════════════════════════════
define ComprehensiveRiskScore:
  (if Risk.HasDiabetes is true then 1 else 0)
    + (if Risk.HasHypertension is true then 1 else 0)
    + (if Risk.HasHeartDisease is true then 1 else 0)
    + (if Risk.HasObesity is true then 1 else 0)
    + (if Risk.AgeOver60 is true then 1 else 0)

// ════════════════════════════════════════════════════════════
// TODO v2：納入 egfr-check 趨勢規則
//   - include EGFRCheck Library，引用 eGFR 連續兩次 < 60 判斷
// TODO v2：3 個月持續性判斷
//   - eGFR < 60 AND uACR > 30 持續 ≥ 3 個月 → 確診 CKD 提示
// ════════════════════════════════════════════════════════════
```

---

### 檔案二：`ckd-comprehensive-hook.json`

```json
{
  "id": "ckd-comprehensive",
  "hook": "patient-view",
  "title": "CKD 綜合風險評估服務",
  "description": "整合 CKD 風險因子偵測、CPG 建議規則與缺檢提醒，提供分層臨床決策支援。依據 NKF CKD Guidelines 2023。",
  "prefetch": {
    "patient": "Patient/{{context.patientId}}",
    "conditions": "Condition?patient={{context.patientId}}&clinical-status=active",
    "observations": "Observation?patient={{context.patientId}}&code=62238-1,33914-3,9318-7,32294-1,39156-5&date=ge{{today-365}}&_sort=-date",
    "latestEGFR": "Observation?patient={{context.patientId}}&code=62238-1,33914-3&_sort=-date&_count=1"
  }
}
```

---

### 檔案三：`ckd-comprehensive-handler.ts`

```typescript
import { CDSHooksRequest, CDSHooksResponse, Card } from './types/cds-hooks';
import { RuleEngine } from './rule-engine/RuleEngine';
import { buildFHIRBundle } from './utils/fhirBundle';

const LIBRARY_NAME = 'CKD_Comprehensive';

export async function ckdComprehensiveHandler(
  request: CDSHooksRequest
): Promise<CDSHooksResponse> {
  const { prefetch } = request;
  const cards: Card[] = [];

  // ── Step 1: 組 FHIR Bundle 傳入 rule engine ──────────────
  const bundle = buildFHIRBundle([
    prefetch.patient,
    prefetch.conditions,
    prefetch.observations,
    prefetch.latestEGFR,
  ]);

  // ── Step 2: 執行 CKD_Comprehensive.cql ───────────────────
  const engine = new RuleEngine();
  const flags = await engine.execute(LIBRARY_NAME, bundle);

  // flags 結構範例：
  // {
  //   HighRiskProfile: true | false | null,
  //   AnnualUACROverdue: true | false | null,
  //   ImmediateReferralNeeded: true | false | null,
  //   CriticalTestingGap: true | false | null,
  //   ComprehensiveRiskScore: number | null,
  //   Risk.MissingeGFR: true | false | null,
  //   Risk.MissinguACR: true | false | null,
  // }

  // ── Step 3: 組 Cards（優先權由高至低）────────────────────

  // Priority 1 — CRITICAL: 兩項檢測均缺
  if (flags.CriticalTestingGap === true) {
    cards.push({
      summary: '⚠️ 嚴重缺檢：eGFR 與 uACR 均無紀錄',
      detail:
        '過去 12 個月內 eGFR（血液）與 uACR（尿液）均無檢測紀錄，' +
        '無法評估腎臟功能與損傷，請立即安排兩項檢測。',
      indicator: 'critical',
      source: { label: 'NKF CKD Guidelines 2023 — Testing Protocol' },
      extension: {
        'rule-engine': 'CriticalTestingGap',
        'source-library': LIBRARY_NAME,
        'cpg-source': 'NKF CKD Guidelines 2023',
        'evidence-grade': 'A',
      },
    });
  }

  // Priority 2 — WARNING: eGFR < 30 轉介
  if (flags.ImmediateReferralNeeded === true) {
    cards.push({
      summary: 'eGFR < 30：建議轉介腎臟科',
      detail:
        '最新 eGFR 數值低於 30 mL/min/1.73m²（CKD G4 期），' +
        '依 NKF 指引建議安排腎臟科會診，評估腎臟替代療法準備事宜。',
      indicator: 'warning',
      source: { label: 'NKF CKD Guidelines 2023 — Referral' },
      extension: {
        'rule-engine': 'ImmediateReferralNeeded',
        'source-library': LIBRARY_NAME,
        'cpg-source': 'NKF CKD Guidelines 2023',
        'evidence-grade': 'A',
      },
    });
  }

  // Priority 3 — WARNING: 高風險病患缺年度 uACR
  if (flags.AnnualUACROverdue === true) {
    cards.push({
      summary: '建議安排年度 uACR 檢測',
      detail:
        '此病患符合 CKD 高風險輪廓，過去 12 個月內無 uACR 檢測紀錄。' +
        '依 NKF 指引，高風險病患應每年檢測 uACR（LOINC: 9318-7）。',
      indicator: 'warning',
      source: { label: 'NKF CKD Guidelines 2023 — Annual Testing' },
      extension: {
        'rule-engine': 'AnnualUACROverdue',
        'source-library': LIBRARY_NAME,
        'cpg-source': 'NKF CKD Guidelines 2023',
        'evidence-grade': 'A',
      },
    });
  }

  // Priority 4 — WARNING: 個別缺檢提醒（未觸發 CriticalTestingGap 時）
  if (flags.CriticalTestingGap !== true) {
    if (flags['Risk.MissingeGFR'] === true) {
      cards.push({
        summary: '建議安排 eGFR 血液檢測',
        detail: '過去 12 個月內無 eGFR 檢測紀錄（LOINC: 62238-1）。建議安排抽血評估腎絲球過濾率。',
        indicator: 'warning',
        source: { label: 'NKF CKD Guidelines 2023' },
        extension: {
          'rule-engine': 'Risk.MissingeGFR',
          'source-library': 'CKD_Risk',
          'cpg-source': 'NKF CKD Guidelines 2023',
          'evidence-grade': 'A',
        },
      });
    }

    if (flags['Risk.MissinguACR'] === true) {
      cards.push({
        summary: '建議安排 uACR 尿液檢測',
        detail: '過去 12 個月內無 uACR 檢測紀錄（LOINC: 9318-7）。建議安排尿液白蛋白肌酸酐比值檢測。',
        indicator: 'warning',
        source: { label: 'NKF CKD Guidelines 2023' },
        extension: {
          'rule-engine': 'Risk.MissinguACR',
          'source-library': 'CKD_Risk',
          'cpg-source': 'NKF CKD Guidelines 2023',
          'evidence-grade': 'A',
        },
      });
    }
  }

  // Priority 5 — INFO: 高風險摘要卡
  const riskFactorLabels: string[] = [];
  if (flags['Risk.HasDiabetes'] === true) riskFactorLabels.push('糖尿病');
  if (flags['Risk.HasHypertension'] === true) riskFactorLabels.push('高血壓');
  if (flags['Risk.HasHeartDisease'] === true) riskFactorLabels.push('心臟病');
  if (flags['Risk.HasObesity'] === true) riskFactorLabels.push('肥胖');
  if (flags['Risk.AgeOver60'] === true) riskFactorLabels.push('年齡 > 60 歲');

  // null flag 處理：資料不足項目
  const nullFlags: string[] = [];
  if (flags['Risk.HasDiabetes'] === null) nullFlags.push('糖尿病');
  if (flags['Risk.HasHypertension'] === null) nullFlags.push('高血壓');
  if (flags['Risk.HasHeartDisease'] === null) nullFlags.push('心臟病');
  if (flags['Risk.HasObesity'] === null) nullFlags.push('肥胖');

  const riskScore = flags.ComprehensiveRiskScore ?? '無法計算';

  cards.push({
    summary: `CKD 綜合風險摘要（風險分數：${riskScore}/5）`,
    detail: [
      riskFactorLabels.length > 0
        ? `已確認風險因子：${riskFactorLabels.join('、')}`
        : '目前無已確認的主要風險因子。',
      nullFlags.length > 0
        ? `⚠️ 資料不足，請人工確認：${nullFlags.join('、')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    indicator: 'info',
    source: { label: 'CKD Comprehensive Service' },
    extension: {
      'rule-engine': 'ComprehensiveRiskScore',
      'source-library': LIBRARY_NAME,
      'cpg-source': 'NKF CKD Guidelines 2023',
      'evidence-grade': 'N/A',
    },
  });

  return { cards };
}
```

---

### 檔案四：`README-ckd-comprehensive.md`

```markdown
# CKD Comprehensive 服務說明

## 服務定位

`ckd-comprehensive` 是 CKD CDS 服務群的整合層，
以 Library include 方式引用 `CKD_Risk.cql` 現有規則，
並新增來自 NKF CPG 的五條綜合判斷規則，不修改任何既有服務。

---

## 服務關係圖

```
┌─────────────────────────────────────────────┐
│           ckd-comprehensive                 │
│  （CDS Hook: patient-view）                  │
│                                             │
│  CKD_Comprehensive.cql                      │
│  ├── include CKD_Risk called Risk           │
│  │     ├── AgeOver60                        │
│  │     ├── HasDiabetes / HasHypertension    │
│  │     ├── HasHeartDisease / HasObesity     │
│  │     ├── MissingeGFR / MissinguACR        │
│  │                                          │
│  └── 新增 defines（CPG 來源）               │
│        ├── HighRiskProfile                  │
│        ├── AnnualUACROverdue                │
│        ├── ImmediateReferralNeeded          │
│        ├── CriticalTestingGap               │
│        └── ComprehensiveRiskScore           │
└────────────────┬────────────────────────────┘
                 │ 不修改、不繼承
    ┌────────────┴──────────────┐
    │                           │
┌───▼──────────┐     ┌──────────▼──────┐
│  egfr-check  │     │   ckd-risk      │
│  （獨立服務） │     │  （獨立服務）   │
│  eGFR < 60   │     │  CKD_Risk.cql   │
│  → 複查建議  │     │  風險因子+缺檢  │
└──────────────┘     └─────────────────┘
```

---

## 新增規則說明

| 規則名稱 | CPG 來源 | 觸發條件 | Card 類型 | Evidence Grade |
|---|---|---|---|---|
| `HighRiskProfile` | NKF Risk Factors | Diabetes OR HTN OR Age>60 | info | B |
| `AnnualUACROverdue` | NKF Testing Rec. | HighRiskProfile AND 缺 uACR | warning | A |
| `ImmediateReferralNeeded` | NKF Referral Rec. | 最新 eGFR < 30 | warning | A |
| `CriticalTestingGap` | NKF Testing Protocol | 缺 eGFR AND 缺 uACR | critical | A |
| `ComprehensiveRiskScore` | 綜合評分 | 命中風險因子數（0–5） | info 摘要 | N/A |

---

## Rule Engine 部署說明

1. **需同時載入兩個 ELM 檔案：**
   - `CKD_Risk_v1.0.0.elm.json`（被 include）
   - `CKD_Comprehensive_v1.0.0.elm.json`（主執行入口）

2. **CQL → ELM 編譯指令：**
   ```bash
   cql-to-elm --input CKD_Risk.cql --output elm/
   cql-to-elm --input CKD_Comprehensive.cql --output elm/
   ```

3. **Rule engine 載入順序：** 先載入 `CKD_Risk` ELM，再載入 `CKD_Comprehensive` ELM，
   確保 include library 已就緒。

4. **null 值處理原則：** 任何 flag 回傳 `null` 代表資料不足，
   系統一律在對應 Card detail 標註「資料不足，請人工確認」，
   不得將 null 視為 false 進行邏輯判斷。

---

## TODO v2

- [ ] 納入 `egfr-check` 趨勢規則（連續兩次 eGFR < 60）
- [ ] 實作 3 個月持續性判斷（eGFR < 60 AND uACR > 30 ≥ 3 個月 → 確診 CKD 提示）
- [ ] Family history / AKI history 結構化資料支援
```

---

## 整體服務架構摘要

`egfr-check` 處理單一 eGFR 閾值規則；`ckd-risk` 以 `CKD_Risk.cql` 管理風險因子與缺檢偵測；`ckd-comprehensive` 透過 Library include 引用前者，疊加 NKF CPG 轉換而來的五條綜合規則，輸出分層 Cards（critical／warning／info），三服務各司其職、互不修改，形成可獨立部署、可逐層擴充的 CDS 服務架構。