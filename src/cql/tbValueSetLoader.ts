/*
 * 更新時間：2026-04-22 14:00
 * 作者：CDS Service
 * 摘要：PR #3 Copilot review：
 *       1. TB_VALUESET_URLS 改讀 TB_VALUESET_BASE_URL env var（預設 https://fhir.your-hosp.org.tw），
 *          消除硬編碼 canonical URL 前綴。
 *       2. flattenCodings 遞迴改為只走訪已知 CodeableConcept 路徑（一層深度），
 *          避免遞迴進入 contained / extension / meta 造成誤判。
 *
 * 更新時間：2026-04-22 10:10
 * 作者：CDS Service
 * 摘要：TbValueSetEntry 新增 rawConcepts（保留原始 system/code 字面值，不做大小寫／去點號正規化），
 *       用於 cql-execution CodeService 建構；TS 對齊層比對仍沿用 codesBySystem/allCodes。
 *
 * 更新時間：2026-04-22 09:22
 * 作者：CDS Service
 * 摘要：TB Detection 服務 — 啟動期／首次呼叫時載入 4 份 ValueSet 並展開為 code list；
 *       提供 TS 對齊層比對（coding matches any-of）；同 key 結構預留給未來 cql-execution CodeService。
 */

import { getValueSetByUrl } from '../fhir/tbFhirClient.js';

/** 正規化單一 code：忽略大小寫並去掉點號（A16.0 → A160） */
export function normalizeCode(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw).toUpperCase().replace(/\./g, '').trim();
}

/** 正規化 system：空字串 → ''；其餘轉小寫比對 */
export function normalizeSystem(sys: string | undefined | null): string {
  return (sys ?? '').toLowerCase();
}

export interface TbValueSetEntry {
  /** 來源 canonical URL */
  url: string;
  /** 版本（對齊本次匯入之 2.1） */
  version: string;
  /**
   * 以 system（小寫）為 key 的 code Set（值為 normalizeCode 後的 code）。
   * 特別例外：若 system 為空字串則以空字串 key 匯集（允許上游無 system 的情況 fallback 比對）。
   */
  codesBySystem: Map<string, Set<string>>;
  /** 扁平 code 集（不看 system；做「任一 system 命中」快速路徑用） */
  allCodes: Set<string>;
  /**
   * 保留原始字面值的 concept 清單（未經大小寫／去點號正規化），
   * 供 cql-execution CodeService 建構使用；與 FHIR ValueSet.compose.include 原樣一致。
   */
  rawConcepts: Array<{ system?: string; code: string }>;
}

const TB_VALUESET_BASE =
  (process.env.TB_VALUESET_BASE_URL ?? 'https://fhir.your-hosp.org.tw').replace(/\/$/, '');

const TB_VALUESET_URLS = {
  diagnoses: `${TB_VALUESET_BASE}/ValueSet/tb-diagnoses`,
  medsFirstLine: `${TB_VALUESET_BASE}/ValueSet/tb-meds-firstline`,
  medsSecondLine: `${TB_VALUESET_BASE}/ValueSet/tb-meds-secondline`,
  labMonitoring: `${TB_VALUESET_BASE}/ValueSet/tb-lab-monitoring`,
} as const;

export type TbValueSetKey = keyof typeof TB_VALUESET_URLS;

interface CacheShape {
  loadedAt: number;
  entries: Record<TbValueSetKey, TbValueSetEntry>;
}

let cache: CacheShape | null = null;
let loading: Promise<CacheShape> | null = null;

function toEntry(raw: Record<string, unknown>): TbValueSetEntry {
  const url = String(raw.url ?? '');
  const version = String(raw.version ?? '');
  const codesBySystem = new Map<string, Set<string>>();
  const allCodes = new Set<string>();
  const rawConcepts: Array<{ system?: string; code: string }> = [];

  const compose = raw.compose as
    | {
        include?: Array<{
          system?: string;
          concept?: Array<{ code?: string }>;
        }>;
      }
    | undefined;

  const includes = Array.isArray(compose?.include) ? compose!.include! : [];
  for (const inc of includes) {
    const sysKey = normalizeSystem(inc?.system);
    if (!codesBySystem.has(sysKey)) codesBySystem.set(sysKey, new Set<string>());
    const codeSet = codesBySystem.get(sysKey)!;
    const concepts = Array.isArray(inc?.concept) ? inc!.concept! : [];
    for (const c of concepts) {
      const rawCode = c?.code != null ? String(c.code) : '';
      if (!rawCode) continue;
      const normalized = normalizeCode(rawCode);
      if (normalized) {
        codeSet.add(normalized);
        allCodes.add(normalized);
      }
      rawConcepts.push({ system: inc?.system, code: rawCode });
    }
  }

  return { url, version, codesBySystem, allCodes, rawConcepts };
}

/**
 * 確保 4 份 ValueSet 已載入並展開；單例快取。
 * 任一 ValueSet 載入失敗會向上拋出讓呼叫端決定 fallback 策略。
 */
export async function ensureTbValueSets(): Promise<CacheShape> {
  if (cache) return cache;
  if (loading) return loading;

  loading = (async () => {
    const keys = Object.keys(TB_VALUESET_URLS) as TbValueSetKey[];
    const fetched = await Promise.all(
      keys.map(async (k) => {
        const vs = await getValueSetByUrl(TB_VALUESET_URLS[k]);
        if (!vs) {
          throw new Error(`ValueSet not found on FHIR server: ${TB_VALUESET_URLS[k]}`);
        }
        return [k, toEntry(vs)] as const;
      }),
    );
    const entries = {} as Record<TbValueSetKey, TbValueSetEntry>;
    for (const [k, v] of fetched) entries[k] = v;
    const built: CacheShape = { loadedAt: Date.now(), entries };
    cache = built;
    return built;
  })();

  try {
    return await loading;
  } finally {
    loading = null;
  }
}

/** 測試或 runtime 重載使用（清掉快取，下次呼叫會重新拉取）。 */
export function clearTbValueSetCache(): void {
  cache = null;
}

/** 取得某一 ValueSet 的展開結果（需先 ensureTbValueSets）。 */
export function getTbValueSet(key: TbValueSetKey): TbValueSetEntry {
  if (!cache) {
    throw new Error('Tb ValueSet cache not initialized. Call ensureTbValueSets() first.');
  }
  return cache.entries[key];
}

/**
 * 將 FHIR 物件中的 coding 陣列扁平化。
 *
 * 只走訪已知的 CodeableConcept 路徑（最多一層深度），
 * 不遞迴進入 contained、extension、meta 等巢狀結構，
 * 以避免因深度遞迴而誤判非業務欄位中的 coding 物件。
 *
 * 支援的路徑：
 *  - obj.coding           (直接 CodeableConcept)
 *  - obj.code.coding      (Condition / MedicationRequest.code)
 *  - obj.medication.coding (MedicationRequest.medication[x])
 *  - obj.medicationCodeableConcept.coding
 *  - obj.vaccineCode.coding (Immunization)
 */
export function flattenCodings(obj: unknown): Array<{ system?: string; code?: string }> {
  if (!obj || typeof obj !== 'object') return [];
  const root = obj as Record<string, unknown>;
  const out: Array<{ system?: string; code?: string }> = [];

  const extractFromCoding = (codingArr: unknown) => {
    if (!Array.isArray(codingArr)) return;
    for (const c of codingArr) {
      if (c && typeof c === 'object') {
        const cc = c as { system?: string; code?: string };
        out.push({ system: cc.system, code: cc.code });
      }
    }
  };

  // 直接 CodeableConcept（obj 本身就是 CodeableConcept）
  extractFromCoding(root.coding);

  // 一層深度已知欄位
  const knownFields = ['code', 'medication', 'medicationCodeableConcept', 'vaccineCode'];
  for (const field of knownFields) {
    const child = root[field];
    if (child && typeof child === 'object') {
      extractFromCoding((child as Record<string, unknown>).coding);
    }
  }

  return out;
}

/**
 * coding-in-valueset 比對：優先以 system 對應 code；若 system 無法比對則 fallback 到 allCodes。
 */
export function codeableInValueSet(
  codeable: unknown,
  vs: TbValueSetEntry,
): boolean {
  const codings = flattenCodings(codeable);
  if (codings.length === 0) return false;
  for (const cd of codings) {
    const code = normalizeCode(cd.code);
    if (!code) continue;
    const sys = normalizeSystem(cd.system);
    const set = vs.codesBySystem.get(sys);
    if (set && set.has(code)) return true;
    // 無 system 或 system 不在值集宣告時，仍允許 code-only fallback
    if (vs.allCodes.has(code)) return true;
  }
  return false;
}

/** 取得第一個命中的 code（供 detail 展示命中碼用） */
export function firstMatchedCode(
  codeable: unknown,
  vs: TbValueSetEntry,
): { system?: string; code: string } | null {
  const codings = flattenCodings(codeable);
  for (const cd of codings) {
    const code = normalizeCode(cd.code);
    if (!code) continue;
    const sys = normalizeSystem(cd.system);
    const set = vs.codesBySystem.get(sys);
    if ((set && set.has(code)) || vs.allCodes.has(code)) {
      return { system: cd.system, code: cd.code ?? code };
    }
  }
  return null;
}
