/*
 * 更新時間：2026-04-20 13:55
 * 作者：CDS Service
 * 摘要：USE_ELM 時執行 Emergency_72h_Revisit ELM，失敗 TS_FALLBACK；cards 加 urn:cds-service:rule-engine
 *
 * 更新時間：2026-04-17 11:55
 * 作者：CDS Service
 * 摘要：72hr-revisit patient-view：Encounter 時間窗內次數門檻（環境變數可調；臨床門檻請對齊院內 PDF）
 */

import { randomUUID } from 'node:crypto';
import type { CdsHooksRequest, CdsHooksResponse } from '../../cds/ckdHookHandler.js';
import { extractBundleResources, formatError, getUseElm, stripPatientPrefix } from '../../cds/utils.js';
import { evaluateEmergency72hRevisitWithElm } from '../../cql/emergency72hRevisitElmExecutor.js';
import { getPatient, searchEncountersForPatient } from '../../fhir/fhirClient.js';

const EXT_RULE_ENGINE = 'urn:cds-service:rule-engine';
const EXT_EMERGENCY_RULE = 'urn:cds:emergency:rule';

function readPositiveInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  if (!Number.isFinite(v) || v <= 0) return fallback;
  return Math.floor(v);
}

/** 返診偵測時間窗（小時），預設 72。 */
const WINDOW_HOURS_DEFAULT = 72;
/** 時間窗內至少幾筆 Encounter 起算視為高風險，預設 2。 */
const MIN_ENCOUNTERS_DEFAULT = 2;

function parseFhirInstant(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readEncounterClassAllowlist(): Set<string> {
  const raw = process.env.EMERGENCY_ENCOUNTER_CLASS_CODES?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function encounterMatchesClass(enc: Record<string, unknown>, allow: Set<string>): boolean {
  if (allow.size === 0) return true;
  const encClass = enc.class as { coding?: Array<{ code?: string }> } | undefined;
  const codings = encClass?.coding ?? [];
  return codings.some((c) => typeof c.code === 'string' && allow.has(c.code));
}

function encounterSortStart(enc: Record<string, unknown>): Date | null {
  const period = enc.period as { start?: string } | undefined;
  return parseFhirInstant(period?.start);
}

/**
 * 統計「就醫開始時間」落在 [now - window, now] 內的 Encounter 筆數（依 id 去重）。
 */
function countEncountersStartingInWindow(
  encounters: Array<Record<string, unknown>>,
  windowHours: number,
  classAllow: Set<string>,
  now: Date,
): number {
  const windowMs = windowHours * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - windowMs);
  const seenIds = new Set<string>();
  let n = 0;
  for (const enc of encounters) {
    if (!encounterMatchesClass(enc, classAllow)) continue;
    const start = encounterSortStart(enc);
    if (!start || start < windowStart || start > now) continue;
    const id = typeof enc.id === 'string' ? enc.id : '';
    if (id) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
    }
    n += 1;
  }
  return n;
}

function buildRevisitCards(params: {
  engine: 'ELM' | 'TS' | 'TS_FALLBACK';
  windowHours: number;
  minEncounters: number;
  countInWindow: number;
  classAllow: Set<string>;
}): CdsHooksResponse {
  const { engine, windowHours, minEncounters, countInWindow, classAllow } = params;
  const engineExt = { url: EXT_RULE_ENGINE, valueString: engine };

  if (countInWindow >= minEncounters) {
    return {
      cards: [
        {
          uuid: randomUUID(),
          summary: `近 ${windowHours} 小時內偵測到 ${countInWindow} 筆就醫 Encounter（門檻 ${minEncounters}）`,
          indicator: 'warning',
          detail: `請依院內「72 小時內高風險重複返診」流程覆核。若已設定 EMERGENCY_ENCOUNTER_CLASS_CODES，僅統計該類別之 Encounter。`,
          source: { label: 'Emergency CDS', url: process.env.CDS_GUIDELINE_URL },
          extension: [
            engineExt,
            {
              url: EXT_EMERGENCY_RULE,
              valueString: `revisit_window_hours=${windowHours};min_encounters=${minEncounters};class_filter=${classAllow.size ? [...classAllow].join('|') : 'none'}`,
            },
          ],
        },
      ],
    };
  }

  return {
    cards: [
      {
        uuid: randomUUID(),
        summary: '未達近程多次就醫門檻',
        indicator: 'info',
        detail: `近 ${windowHours} 小時內符合條件之 Encounter 共 ${countInWindow} 筆（門檻 ${minEncounters}）。`,
        extension: [
          engineExt,
          {
            url: EXT_EMERGENCY_RULE,
            valueString: `revisit_window_hours=${windowHours};min_encounters=${minEncounters}`,
          },
        ],
      },
    ],
  };
}

export async function handleRevisit72hHook(body: CdsHooksRequest): Promise<CdsHooksResponse> {
  const rawId = body.context?.patientId;
  if (!rawId) {
    return {
      cards: [
        {
          uuid: randomUUID(),
          summary: '缺少 patientId',
          indicator: 'warning',
          detail: '請在 context 中提供 patientId。',
        },
      ],
    };
  }

  const patientId = stripPatientPrefix(rawId);
  const pf = body.prefetch ?? {};
  const windowHours = readPositiveInt('EMERGENCY_REVISIT_WINDOW_HOURS', WINDOW_HOURS_DEFAULT);
  const minEncounters = readPositiveInt('EMERGENCY_REVISIT_MIN_ENCOUNTERS', MIN_ENCOUNTERS_DEFAULT);
  const classAllow = readEncounterClassAllowlist();

  const pfPatientList = extractBundleResources(pf.patient, 'Patient');
  const pfPatient = pfPatientList[0] ?? null;
  const patientForElm = (pfPatient ?? (await getPatient(patientId))) as Record<string, unknown>;

  const pfEncounters = extractBundleResources(pf.recentEncounters, 'Encounter');
  const encounters =
    pf.recentEncounters && pfEncounters.length > 0
      ? pfEncounters
      : await searchEncountersForPatient(patientId, { count: 50 });

  const now = new Date();
  const classAllowCodes = classAllow.size > 0 ? [...classAllow] : [];

  const useElm = getUseElm();
  let engine: 'ELM' | 'TS' | 'TS_FALLBACK' = useElm ? 'ELM' : 'TS';

  if (useElm) {
    try {
      const elm = await evaluateEmergency72hRevisitWithElm({
        patient: patientForElm,
        encounters,
        windowHours,
        minEncounters,
        now,
        classAllowCodes,
      });
      return buildRevisitCards({
        engine,
        windowHours,
        minEncounters,
        countInWindow: elm.countInWindow,
        classAllow,
      });
    } catch (err) {
      console.error('[72hr-revisit] ELM execution failed, falling back to TS:', formatError(err));
      engine = 'TS_FALLBACK';
    }
  }

  const countInWindow = countEncountersStartingInWindow(encounters, windowHours, classAllow, now);
  return buildRevisitCards({
    engine,
    windowHours,
    minEncounters,
    countInWindow,
    classAllow,
  });
}
