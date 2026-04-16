/*
 * 更新時間：2026-04-16 10:08
 * 作者：CDS Service
 * 摘要：ckd-risk hybrid：新增 Condition active 與 CKD risk Observation（多 code + 365 天）搜尋 API
 *
 * 更新時間：2026-04-16 14:59
 * 作者：CDS Service
 * 摘要：ckd-risk 擴充風險因子資料來源：新增 searchAllConditions（既往 AKI）與 searchFamilyMemberHistory（家族史）
 *
 * 更新時間：2026-04-14 16:28
 * 作者：CDS Service
 * 摘要：修正 getLatestEGFR/Creatinine 回傳型別與 TS 編譯
 *
 * 更新時間：2026-04-14 12:00
 * 作者：CDS Service
 * 摘要：初版 FHIR Client（axios、OperationOutcome、Patient/Observation 查詢）
 */
import axios, { type AxiosInstance } from 'axios';

const defaultBaseUrl = process.env.FHIR_BASE_URL ?? 'http://localhost:9090/fhir';

/**
 * 初始化 FHIR Axios 實例
 * 配置本機 HAPI FHIR 的連線參數（可透過 FHIR_BASE_URL 覆寫）
 */
function createFhirInstance(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 10_000,
    headers: {
      Accept: 'application/fhir+json',
      'Content-Type': 'application/fhir+json',
    },
  });
}

const fhirInstance = createFhirInstance(defaultBaseUrl);

/**
 * 統一處理 FHIR 錯誤邏輯
 * @param error - Axios 錯誤物件
 */
export function handleFhirError(error: unknown): never {
  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data as {
      resourceType?: string;
      issue?: Array<{ diagnostics?: string }>;
    };
    if (data && data.resourceType === 'OperationOutcome' && Array.isArray(data.issue)) {
      const diagnostics = data.issue
        .map((i) => i.diagnostics ?? '')
        .filter(Boolean)
        .join(', ');
      throw new Error(`FHIR OperationOutcome: ${diagnostics || '(no diagnostics)'}`);
    }
    throw new Error(
      `FHIR Server Error: ${error.response.status} ${error.response.statusText}`,
    );
  }
  if (axios.isAxiosError(error) && error.request) {
    throw new Error('FHIR Network Error: No response received from server.');
  }
  const msg = error instanceof Error ? error.message : String(error);
  throw new Error(`FHIR Client Error: ${msg}`);
}

/**
 * 取得單一 Patient 資源
 * @param patientId - 患者 ID (例如: patient-ckd-001)
 * @returns FHIR Patient Resource
 */
export async function getPatient(patientId: string): Promise<Record<string, unknown>> {
  try {
    const response = await fhirInstance.get(`/Patient/${patientId}`);
    return response.data as Record<string, unknown>;
  } catch (error) {
    handleFhirError(error);
  }
}

/**
 * 查詢最新一筆 eGFR Observation (LOINC 62238-1)
 */
export async function getLatestEGFR(
  patientId: string,
): Promise<Record<string, unknown> | null> {
  const r = await getObservationsByCode(patientId, '62238-1', 1);
  if (Array.isArray(r)) return r[0] ?? null;
  return r;
}

/**
 * 查詢最新一筆 Creatinine Observation (LOINC 2160-0)
 */
export async function getLatestCreatinine(
  patientId: string,
): Promise<Record<string, unknown> | null> {
  const r = await getObservationsByCode(patientId, '2160-0', 1);
  if (Array.isArray(r)) return r[0] ?? null;
  return r;
}

/**
 * 通用查詢函式：依據 LOINC Code 取得 Observation
 * @param count - 取得筆數，預設 5 筆
 * @returns 若 count 為 1 回傳單一物件，否則回傳陣列
 */
export async function getObservationsByCode(
  patientId: string,
  loincCode: string,
  count = 5,
): Promise<Record<string, unknown> | Record<string, unknown>[] | null> {
  try {
    const response = await fhirInstance.get('/Observation', {
      params: {
        patient: patientId,
        code: loincCode,
        _sort: '-date',
        _count: count,
      },
    });

    const bundle = response.data as {
      entry?: Array<{ resource?: Record<string, unknown> }>;
    };
    if (!bundle.entry || bundle.entry.length === 0) {
      return null;
    }

    return count === 1
      ? (bundle.entry[0].resource as Record<string, unknown>)
      : bundle.entry.map((e) => e.resource as Record<string, unknown>);
  } catch (error) {
    handleFhirError(error);
  }
}

function formatYyyyMmDd(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatYyyyMmDd(d);
}

/**
 * 查詢 active Conditions（對齊 Discovery：Condition?patient=...&clinical-status=active）
 */
export async function searchActiveConditions(patientId: string): Promise<Record<string, unknown>[]> {
  try {
    const response = await fhirInstance.get('/Condition', {
      params: {
        patient: patientId,
        'clinical-status': 'active',
        _count: 200,
      },
    });
    const bundle = response.data as { entry?: Array<{ resource?: Record<string, unknown> }> };
    const entry = Array.isArray(bundle.entry) ? bundle.entry : [];
    return entry.map((e) => e.resource).filter(Boolean) as Record<string, unknown>[];
  } catch (error) {
    handleFhirError(error);
  }
}

/**
 * 查詢 Conditions（不限制 clinical-status；用於「既往史」如 AKI N17*）
 */
export async function searchAllConditions(patientId: string): Promise<Record<string, unknown>[]> {
  try {
    const response = await fhirInstance.get('/Condition', {
      params: {
        patient: patientId,
        _count: 200,
      },
    });
    const bundle = response.data as { entry?: Array<{ resource?: Record<string, unknown> }> };
    const entry = Array.isArray(bundle.entry) ? bundle.entry : [];
    return entry.map((e) => e.resource).filter(Boolean) as Record<string, unknown>[];
  } catch (error) {
    handleFhirError(error);
  }
}

/**
 * 查詢 FamilyMemberHistory（家族史；用於 CKD 風險因子）
 */
export async function searchFamilyMemberHistory(patientId: string): Promise<Record<string, unknown>[]> {
  try {
    const response = await fhirInstance.get('/FamilyMemberHistory', {
      params: {
        patient: patientId,
        _count: 200,
      },
    });
    const bundle = response.data as { entry?: Array<{ resource?: Record<string, unknown> }> };
    const entry = Array.isArray(bundle.entry) ? bundle.entry : [];
    return entry.map((e) => e.resource).filter(Boolean) as Record<string, unknown>[];
  } catch (error) {
    handleFhirError(error);
  }
}

/**
 * 查詢 CKD risk 相關 Observations（對齊 Discovery：多 LOINC + date=ge{{today-365}}）
 *
 * 預設 lookbackDays=365，等同「過去 12 個月」。
 */
export async function searchObservationsForCkdRisk(
  patientId: string,
  options?: { lookbackDays?: number; count?: number },
): Promise<Record<string, unknown>[]> {
  const lookbackDays = options?.lookbackDays ?? 365;
  const count = options?.count ?? 200;
  const dateGe = `ge${daysAgo(lookbackDays)}`;
  const codes = ['62238-1', '33914-3', '9318-7', '32294-1', '39156-5'].join(',');

  try {
    const response = await fhirInstance.get('/Observation', {
      params: {
        patient: patientId,
        code: codes,
        date: dateGe,
        _sort: '-date',
        _count: count,
      },
    });
    const bundle = response.data as { entry?: Array<{ resource?: Record<string, unknown> }> };
    const entry = Array.isArray(bundle.entry) ? bundle.entry : [];
    return entry.map((e) => e.resource).filter(Boolean) as Record<string, unknown>[];
  } catch (error) {
    handleFhirError(error);
  }
}
