/*
 * 更新時間：2026-04-16 14:12
 * 作者：CDS Service
 * 摘要：UI 文案補上 ckd-comprehensive（第三服務）與其 Prefetch/Discovery 鍵說明
 *
 * 更新時間：2026-04-16 10:15
 * 作者：CDS Service
 * 摘要：CDS Hook UI 繁體中文（zh-TW）標題說明與欄位 Tooltip 文案
 */

/** 頂部標題列：應用說明（給使用者一眼理解用途） */
export const APP_TITLE = 'CDS Hook 測試台';

export const APP_SUBTITLE = 'patient-view · HL7 CDS Hooks · 臨床決策支援';

/** 標題列內較長描述（可換行） */
export const APP_DESCRIPTION =
  '模擬電子病歷在「病患檢視」時觸發 CDS：向本機 CDS Service 送出 Hook，檢視回傳卡片與規則引擎。開發模式下經 Vite 代理連線 FHIR 與 CDS，無需處理 CORS。';

export const TT = {
  /** 標題列圖示 */
  brandIcon: '臨床決策支援（CDS Hooks）測試工具：模擬 EHR 呼叫後端服務',

  /** CDS 服務 */
  cdsService:
    '選擇要測試的 CDS 服務：egfr-check（eGFR 複查建議）、ckd-risk（CKD 風險與檢驗提醒；hybrid）或 ckd-comprehensive（CKD 綜合規則：CPG + risk + testing；hybrid）。',

  /** 服務說明（顯示於 UI） */
  serviceExplainEgfr:
    'egfr-check：偵測最新 eGFR，若低於門檻則提供複查建議。可選擇是否由前端先組 prefetch（EHR 模式）或讓後端自行查 FHIR。',
  serviceExplainCkd:
    'ckd-risk：彙整 CKD 風險因子與檢測缺漏提醒。hybrid：可不帶 prefetch（後端會向 FHIR 取資料），也可由前端先組 prefetch（更貼近 EHR）。',
  serviceExplainCkdComprehensive:
    'ckd-comprehensive：整合 ckd-risk 既有風險/缺檢偵測，並加入 CPG（NKF）規則：高風險輪廓、年度 uACR、eGFR < 30 轉介、嚴重缺檢與綜合分數。hybrid：prefetch 可省略。',

  /** Patient ID */
  patientId:
    'FHIR 病患邏輯 ID（與伺服器上 Patient.id 一致）。可從清單選取測試病患，或手動輸入。變更後若已開啟「自動呼叫」會立即重送。',

  /** 自動呼叫 */
  autoStart:
    '開啟時：變更病患、服務或 Prefetch 設定後會自動呼叫 Hook，模擬醫師開啟病患畫面即觸發。關閉時僅在您按「立即呼叫 Hook」時送出。',

  /** Prefetch egfr */
  prefetchEgfr:
    '僅適用 egfr-check：開啟時會先向 FHIR 取得病患、eGFR、Creatinine，並依 Discovery 鍵名放入請求 prefetch；關閉時改由 CDS 後端自行查 FHIR。',

  /** Prefetch ckd-risk */
  prefetchCkd:
    '適用 ckd-risk / ckd-comprehensive：開啟時前端會先向 FHIR 取得 Patient/Condition/Observation（ckd-comprehensive 另加 latestEgfr）組成 prefetch（較貼近 EHR 實作）；關閉時只送 patientId，由 CDS 後端以 hybrid 模式向 FHIR 取資料補齊。',

  /** Discovery 鍵 Chip */
  discoveryKeysChip:
    '本次請求將帶入 prefetch 欄位：patient、latestEgfr、latestCreatinine，與 Discovery 範本一致，供後端優先使用。',

  /** CKD Discovery 鍵 Chip */
  discoveryKeysChipCkd:
    '本次請求將帶入 prefetch 欄位：patient、conditions、conditionsAll、observations、familyHistory（searchset Bundles），供 ckd-risk 優先使用；若不帶 prefetch，後端會自行向 FHIR 取資料。',

  /** CKD Comprehensive Discovery 鍵 Chip */
  discoveryKeysChipCkdComprehensive:
    '本次請求將帶入 prefetch 欄位：patient、conditions、observations、latestEgfr，供 ckd-comprehensive 優先使用；若不帶 prefetch，後端會自行向 FHIR 取資料（hybrid）。',

  /** 重新載入 Discovery */
  reloadDiscovery:
    '重新向 GET /cds-services 取得服務清單、href 與 prefetch 查詢範本，確認與後端設定一致。',

  /** 立即呼叫 */
  callHook:
    '手動送出 POST /cds-services/{服務}。若 FHIR 資料剛更新，請按此強制重送以取得最新卡片。',

  /** RuleEngine Chip */
  ruleEngine:
    '規則執行來源：ELM 為 CQL/ELM 引擎；TS 為 TypeScript 對齊層；TS_FALLBACK 表示 ELM 失敗時降級。請於 CDS Service 設定 USE_ELM=true 以使用 ELM。',

  /** 請求設定區塊標題 */
  sectionRequest: '組合 Hook 請求：服務、病患、是否自動呼叫、是否預先從 FHIR 帶入 egfr-check 所需資料。',

  /** 請求本文 */
  sectionRequestBody: '實際送給 CDS 的 JSON。ckd-risk 或 egfr-check 開啟 Prefetch 時內容會較大。',

  /** 情境輸出 */
  sectionOutput: '後端回傳的 CDS Cards：摘要（info）與建議／警示（warning、critical），以及完整 JSON。',

  /** Discovery 摺疊 */
  discoveryJson: 'CDS Service 對 GET /cds-services 的回應，含各服務的 hook、href 與 prefetch 範本字串。',

  /** Raw response */
  rawResponse: 'Hook 回應的完整 JSON，便於與 Postman 或自動測試比對。',
} as const;
