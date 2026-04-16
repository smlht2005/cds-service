/*
 * 更新時間：2026-04-16 14:59
 * 作者：CDS Service
 * 摘要：ckd-risk cards 擴充：新增 AKI 病史與家族史 CKD 的 warning（不再僅缺檢提醒）
 *
 * 更新時間：2026-04-15 17:50
 * 作者：CDS Service
 * 摘要：ckd-risk v1 cards 組裝（Card 1: CKD Risk Summary；Card 2+: eGFR/uACR 缺漏提醒），每張含 rule-engine extension
 */
import type { CdsCard } from './ckdHookHandler.js';
import type { CkdRiskElmResult } from '../cql/ckdRiskElmExecutor.js';

export function buildCkdRiskCards(params: {
  engine: 'ELM' | 'TS' | 'TS_FALLBACK';
  result: CkdRiskElmResult;
}): CdsCard[] {
  const { engine, result } = params;
  const engineExtension = [{ url: 'urn:cds-service:rule-engine', valueString: engine }];

  const activeFlags: string[] = [];
  if (result.AgeOver60 === true) activeFlags.push('Age > 60');
  if (result.HasDiabetes === true) activeFlags.push('Diabetes');
  if (result.HasHypertension === true) activeFlags.push('Hypertension');
  if (result.HasHeartDisease === true) activeFlags.push('Heart disease / heart failure');
  if (result.HasObesity === true) activeFlags.push('Obesity (BMI ≥ 30)');

  const unknownFlags: string[] = [];
  if (result.AgeOver60 === null) unknownFlags.push('Age > 60');
  if (result.HasDiabetes === null) unknownFlags.push('Diabetes');
  if (result.HasHypertension === null) unknownFlags.push('Hypertension');
  if (result.HasHeartDisease === null) unknownFlags.push('Heart disease / heart failure');
  if (result.HasObesity === null) unknownFlags.push('Obesity (BMI ≥ 30)');

  const lines: string[] = [];
  lines.push(
    `Risk factors: ${activeFlags.length ? activeFlags.join(', ') : '(none detected)'}`,
  );
  if (unknownFlags.length) {
    lines.push(`Unknown (insufficient coded data): ${unknownFlags.join(', ')}`);
  }
  if (result.HasFamilyHistoryOfCKD === true) lines.push('Family history of CKD: Yes');
  else if (result.HasFamilyHistoryOfCKD === false) lines.push('Family history of CKD: No');
  else lines.push('Family history of CKD: Insufficient data — review manually');

  if (result.HasAkiHistory === true) lines.push('Personal history of AKI: Yes');
  else if (result.HasAkiHistory === false) lines.push('Personal history of AKI: No');
  else lines.push('Personal history of AKI: Insufficient data — review manually');

  const egfrLine =
    result.MostRecentEgfrValue != null
      ? `Most recent eGFR: ${result.MostRecentEgfrValue}${result.MostRecentEgfrUnit ? ` ${result.MostRecentEgfrUnit}` : ''}`
      : 'Most recent eGFR: (not found)';
  const uacrLine =
    result.MostRecentUacrValue != null
      ? `Most recent uACR: ${result.MostRecentUacrValue}${result.MostRecentUacrUnit ? ` ${result.MostRecentUacrUnit}` : ''}`
      : 'Most recent uACR: (not found)';
  lines.push(egfrLine);
  lines.push(uacrLine);

  const cards: CdsCard[] = [
    {
      uuid: 'ckd-risk-summary',
      summary: 'CKD Risk Summary',
      indicator: 'info',
      source: { label: 'CDS Service / Prefetch' },
      detail: lines.join('\n'),
      extension: engineExtension,
    },
  ];

  if (result.MissingeGFR) {
    cards.push({
      uuid: 'ckd-risk-missing-egfr',
      summary: 'eGFR not recorded in past 12 months — order eGFR (blood test)',
      indicator: 'warning',
      source: { label: 'CKD Risk (Testing)' },
      detail: result.MissingeGFRRecommendation ?? undefined,
      extension: engineExtension,
    });
  }

  if (result.MissinguACR) {
    cards.push({
      uuid: 'ckd-risk-missing-uacr',
      summary: 'uACR not recorded in past 12 months — order uACR (urine test)',
      indicator: 'warning',
      source: { label: 'CKD Risk (Testing)' },
      detail: result.MissinguACRRecommendation ?? undefined,
      extension: engineExtension,
    });
  }

  if (result.HasFamilyHistoryOfCKD === true) {
    cards.push({
      uuid: 'ckd-risk-family-history-ckd',
      summary: 'Family history of CKD — increased risk',
      indicator: 'warning',
      source: { label: 'CKD Risk (History)' },
      detail:
        'Family history of chronic kidney disease was detected (FHIR FamilyMemberHistory). Consider closer monitoring.',
      extension: engineExtension,
    });
  }

  if (result.HasAkiHistory === true) {
    cards.push({
      uuid: 'ckd-risk-aki-history',
      summary: 'Personal history of AKI (N17*) — increased risk',
      indicator: 'warning',
      source: { label: 'CKD Risk (History)' },
      detail:
        'A prior AKI diagnosis (ICD-10 N17*) was detected in Condition history. Consider closer monitoring.',
      extension: engineExtension,
    });
  }

  return cards;
}

