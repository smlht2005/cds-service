/*
 * 更新時間：2026-04-16 14:09
 * 作者：CDS Service
 * 摘要：新增 ckd-comprehensive cards 組裝（優先序 critical→warning→info；extension 含 rule-engine + CPG meta；detail 繁中）
 */
import type { CdsCard } from './ckdHookHandler.js';
import type { CkdRiskElmResult } from '../cql/ckdRiskElmExecutor.js';
import type { CkdComprehensiveElmResult } from '../cql/ckdComprehensiveElmExecutor.js';

type EngineLabel = 'ELM' | 'TS' | 'TS_FALLBACK';

const EXT_RULE_ENGINE = 'urn:cds-service:rule-engine';
const EXT_RULE_ID = 'urn:cds-service:rule-id';
const EXT_SOURCE_LIBRARY = 'urn:cds-service:source-library';
const EXT_CPG_SOURCE = 'urn:cds-service:cpg-source';
const EXT_EVIDENCE_GRADE = 'urn:cds-service:evidence-grade';

function extMeta(params: {
  engine: EngineLabel;
  ruleId: string;
  sourceLibrary: string;
  cpgSource: string;
  evidenceGrade: string;
}): Array<{ url: string; valueString: string }> {
  const { engine, ruleId, sourceLibrary, cpgSource, evidenceGrade } = params;
  return [
    { url: EXT_RULE_ENGINE, valueString: engine },
    { url: EXT_RULE_ID, valueString: ruleId },
    { url: EXT_SOURCE_LIBRARY, valueString: sourceLibrary },
    { url: EXT_CPG_SOURCE, valueString: cpgSource },
    { url: EXT_EVIDENCE_GRADE, valueString: evidenceGrade },
  ];
}

function yn(v: boolean | null): string {
  if (v === true) return '是';
  if (v === false) return '否';
  return '資料不足';
}

export function buildCkdComprehensiveCards(params: {
  engine: EngineLabel;
  risk: Pick<
    CkdRiskElmResult,
    | 'AgeOver60'
    | 'HasDiabetes'
    | 'HasHypertension'
    | 'HasHeartDisease'
    | 'HasObesity'
    | 'MostRecentEgfrValue'
    | 'MostRecentEgfrUnit'
    | 'MostRecentUacrValue'
    | 'MostRecentUacrUnit'
    | 'MissingeGFR'
    | 'MissinguACR'
  >;
  comprehensive: CkdComprehensiveElmResult;
}): CdsCard[] {
  const { engine, risk, comprehensive } = params;
  const cpgSource = 'NKF CKD Guidelines 2023';

  const cards: CdsCard[] = [];

  // Priority 1: critical — CriticalTestingGap
  if (comprehensive.CriticalTestingGap === true) {
    cards.push({
      uuid: 'ckd-comprehensive-critical-testing-gap',
      summary: '嚴重缺檢：eGFR 與 uACR 均無紀錄',
      indicator: 'critical',
      source: { label: 'CKD Comprehensive / Testing' },
      detail:
        '過去 12 個月內未找到 eGFR（血液）與 uACR（尿液）檢測紀錄，無法評估腎功能與腎損傷程度。請優先安排兩項檢測後再評估。',
      extension: extMeta({
        engine,
        ruleId: 'CriticalTestingGap',
        sourceLibrary: 'CKD_Comprehensive',
        cpgSource,
        evidenceGrade: 'A',
      }),
    });
  }

  // Priority 2: warning — ImmediateReferralNeeded
  if (comprehensive.ImmediateReferralNeeded === true) {
    const egfrValue =
      risk.MostRecentEgfrValue != null
        ? `${risk.MostRecentEgfrValue}${risk.MostRecentEgfrUnit ? ` ${risk.MostRecentEgfrUnit}` : ''}`
        : '(未取得)';
    cards.push({
      uuid: 'ckd-comprehensive-immediate-referral',
      summary: 'eGFR < 30：建議轉介腎臟科',
      indicator: 'warning',
      source: { label: 'CKD Comprehensive / Referral' },
      detail:
        `最新 eGFR：${egfrValue}\n` +
        '若 eGFR 低於 30 mL/min/1.73/m2（CKD G4 期），依指引建議安排腎臟科會診評估後續處置與準備。',
      extension: extMeta({
        engine,
        ruleId: 'ImmediateReferralNeeded',
        sourceLibrary: 'CKD_Comprehensive',
        cpgSource,
        evidenceGrade: 'A',
      }),
    });
  }

  // Priority 3: warning — AnnualUACROverdue
  if (comprehensive.AnnualUACROverdue === true) {
    cards.push({
      uuid: 'ckd-comprehensive-annual-uacr-overdue',
      summary: '建議安排年度 uACR 檢測',
      indicator: 'warning',
      source: { label: 'CKD Comprehensive / Annual testing' },
      detail:
        '此病患符合 CKD 高風險輪廓（糖尿病／高血壓／年齡 > 60 其中之一），且過去 12 個月內未找到 uACR 檢測紀錄（LOINC: 9318-7 / 32294-1）。依指引建議每年檢測一次 uACR。',
      extension: extMeta({
        engine,
        ruleId: 'AnnualUACROverdue',
        sourceLibrary: 'CKD_Comprehensive',
        cpgSource,
        evidenceGrade: 'A',
      }),
    });
  }

  // Priority 4: warning — 個別缺檢（未觸發 CriticalTestingGap 時）
  if (comprehensive.CriticalTestingGap !== true) {
    if (risk.MissingeGFR) {
      cards.push({
        uuid: 'ckd-comprehensive-missing-egfr',
        summary: '建議安排 eGFR 血液檢測（過去 12 個月未記錄）',
        indicator: 'warning',
        source: { label: 'CKD Comprehensive / Testing' },
        detail: '過去 12 個月內未找到 eGFR 檢測（LOINC: 62238-1 / 33914-3）。建議安排抽血檢測以評估腎功能。',
        extension: extMeta({
          engine,
          ruleId: 'MissingeGFR',
          sourceLibrary: 'CKD_Risk',
          cpgSource,
          evidenceGrade: 'A',
        }),
      });
    }

    if (risk.MissinguACR) {
      cards.push({
        uuid: 'ckd-comprehensive-missing-uacr',
        summary: '建議安排 uACR 尿液檢測（過去 12 個月未記錄）',
        indicator: 'warning',
        source: { label: 'CKD Comprehensive / Testing' },
        detail: '過去 12 個月內未找到 uACR 檢測（LOINC: 9318-7 / 32294-1）。建議安排尿液白蛋白肌酸酐比值檢測。',
        extension: extMeta({
          engine,
          ruleId: 'MissinguACR',
          sourceLibrary: 'CKD_Risk',
          cpgSource,
          evidenceGrade: 'A',
        }),
      });
    }
  }

  // Priority 5: info — 摘要（HighRiskProfile + ComprehensiveRiskScore）
  const confirmedRiskFactors: string[] = [];
  if (risk.HasDiabetes === true) confirmedRiskFactors.push('糖尿病');
  if (risk.HasHypertension === true) confirmedRiskFactors.push('高血壓');
  if (risk.HasHeartDisease === true) confirmedRiskFactors.push('心臟病');
  if (risk.HasObesity === true) confirmedRiskFactors.push('肥胖（BMI ≥ 30）');
  if (risk.AgeOver60 === true) confirmedRiskFactors.push('年齡 > 60 歲');

  const unknownRiskFactors: string[] = [];
  if (risk.HasDiabetes === null) unknownRiskFactors.push('糖尿病');
  if (risk.HasHypertension === null) unknownRiskFactors.push('高血壓');
  if (risk.HasHeartDisease === null) unknownRiskFactors.push('心臟病');
  if (risk.HasObesity === null) unknownRiskFactors.push('肥胖');
  if (risk.AgeOver60 === null) unknownRiskFactors.push('年齡');

  const egfrLine =
    risk.MostRecentEgfrValue != null
      ? `最新 eGFR：${risk.MostRecentEgfrValue}${risk.MostRecentEgfrUnit ? ` ${risk.MostRecentEgfrUnit}` : ''}`
      : '最新 eGFR：未取得';
  const uacrLine =
    risk.MostRecentUacrValue != null
      ? `最新 uACR：${risk.MostRecentUacrValue}${risk.MostRecentUacrUnit ? ` ${risk.MostRecentUacrUnit}` : ''}`
      : '最新 uACR：未取得';

  const scoreText =
    comprehensive.ComprehensiveRiskScore != null ? String(comprehensive.ComprehensiveRiskScore) : '無法計算';

  const lines: string[] = [];
  lines.push(`高風險輪廓（HighRiskProfile）：${yn(comprehensive.HighRiskProfile)}`);
  lines.push(`綜合風險分數（0–5）：${scoreText}`);
  lines.push(
    confirmedRiskFactors.length
      ? `已確認風險因子：${confirmedRiskFactors.join('、')}`
      : '已確認風險因子：無',
  );
  if (unknownRiskFactors.length) {
    lines.push(`資料不足，請人工確認：${unknownRiskFactors.join('、')}`);
  }
  lines.push(egfrLine);
  lines.push(uacrLine);

  cards.push({
    uuid: 'ckd-comprehensive-summary',
    summary: `CKD 綜合風險摘要（分數：${scoreText}/5）`,
    indicator: 'info',
    source: { label: 'CKD Comprehensive' },
    detail: lines.join('\n'),
    extension: extMeta({
      engine,
      ruleId: 'ComprehensiveRiskScore',
      sourceLibrary: 'CKD_Comprehensive',
      cpgSource,
      evidenceGrade: 'N/A',
    }),
  });

  return cards;
}

