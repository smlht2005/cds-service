/*
 * 更新時間：2026-04-22 10:58
 * 作者：CDS Service
 * 摘要：Phase 4 — 支援 tb-detection：
 *       1. supportsPrefetchFromFhir 納入 tb-detection；
 *       2. 前端 Prefetch 組裝（Patient/Condition/MedicationRequest/MedicationStatement/Flag/Observation）；
 *       3. Tooltip 文案延伸至 tb-detection；
 *       4. patientId 輸入旁掛載 tb-detection 測試病患快選 chips。
 *
 * 更新時間：2026-04-20 17:58
 * 作者：CDS Service
 * 摘要：UI 文案 tooltip 採安全索引存取（避免 TT 型別快取導致誤判）；不影響實際行為
 *
 * 更新時間：2026-04-20 17:55
 * 作者：CDS Service
 * 摘要：mixed hooks 表單化 builder：observation-create / order-select（取代非 patient-view 的最小 Context JSON 輸入）
 *
 * 更新時間：2026-04-20 17:18
 * 作者：CDS Service
 * 摘要：急診服務支援前端 Prefetch from FHIR：72hr-revisit（patient+recentEncounters）、infection-control-warning（patient+flags+medicationStatements+conditions）
 *
 * 更新時間：2026-04-20 16:55
 * 作者：CDS Service
 * 摘要：Prefetch 開關對齊實作範圍：非 egfr/ckd 服務停用並提示（避免誤以為會帶入 patient/prefetch）
 *
 * 更新時間：2026-04-20 16:18
 * 作者：CDS Service
 * 摘要：前端 Patient 下拉清單對齊急診測試資料（patient-ckd-001、patient-ckd-002）
 *
 * 更新時間：2026-04-20 15:41
 * 作者：CDS Service
 * 摘要：前端 UI 重構：服務清單改為 Discovery 動態載入；新增主/急診 target 切換；支援 mixed hooks（最小 context JSON 輸入）
 *
 * 更新時間：2026-04-16 15:21
 * 作者：CDS Service
 * 摘要：Patient 下拉清單新增 patient-ckd-107（用於驗證 ckd-risk 家族史/AKI warning）
 *
 * 更新時間：2026-04-16 14:12
 * 作者：CDS Service
 * 摘要：前端新增 ckd-comprehensive（第三服務）：ServiceId/選單/說明文案/Prefetch 組裝（含 latestEgfr）
 *
 * 更新時間：2026-04-16 10:15
 * 作者：CDS Service
 * 摘要：標題列應用說明（zh-TW）＋主要欄位 Tooltip；copy/zhTwUi 集中文案
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AppBar,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

import { callHook, fetchDiscovery } from './api/cdsClient';
import { fhirGet, fhirSearch } from './api/fhirClient';
import type { CdsCard, CdsHookRequest, CdsHookResponse, OperationOutcome } from './types/cdsHooks';
import { CdsCardView } from './components/CdsCardView';
import { JsonBlock } from './components/JsonBlock';
import { APP_DESCRIPTION, APP_SUBTITLE, APP_TITLE, TT } from './copy/zhTwUi';
import { getDiscoveryServices, getServiceLabel } from './cds/discovery';
import { CDS_TARGETS } from './cds/targets';
import type { CdsTargetId, DiscoveryService } from './cds/types';
import {
  createObservationCreateBuilderState,
  createOrderSelectBuilderState,
  OBSERVATION_CREATE_HOOK,
  ORDER_SELECT_HOOK,
  parseObservationCreateContext,
  parseOrderSelectContext,
  renderObservationCreateBuilder,
  renderOrderSelectBuilder,
  renderTbDetectionQuickPresets,
  TB_DETECTION_SERVICE_ID,
} from './cds/hookBuilders';

/** Tooltip 較長中文說明時限制寬度、提升可讀性 */
const tooltipSlotProps = {
  popper: {
    sx: {
      '& .MuiTooltip-tooltip': {
        maxWidth: 380,
        fontSize: '0.8125rem',
        lineHeight: 1.55,
        py: 1,
        px: 1.25,
      },
    },
  },
} as const;

/** 將 FHIR search 結果包成 searchset Bundle，供 egfr-check prefetch.latestEgfr / latestCreatinine 使用 */
function bundleFromResources(resources: Array<Record<string, unknown>>): Record<string, unknown> {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: resources.length,
    entry: resources.map((r) => ({ resource: r })),
  };
}

function formatFhirError(e: unknown): string {
  if (e && typeof e === 'object' && e !== null && 'kind' in e) {
    const fe = e as { kind: string; status?: number; statusText?: string; bodyText?: string };
    if (fe.kind === 'http') {
      return `HTTP ${fe.status ?? '?'} ${fe.statusText ?? ''}${fe.bodyText ? `\n${fe.bodyText}` : ''}`;
    }
    if (fe.kind === 'invalid-json') {
      return `Invalid JSON (${fe.status ?? '?'})${fe.bodyText ? `\n${fe.bodyText}` : ''}`;
    }
  }
  return String(e);
}

function getRuleEngine(cards: CdsCard[]): string | undefined {
  const ext = cards?.[0]?.extension?.find((e) => e.url === 'urn:cds-service:rule-engine');
  return ext?.valueString;
}

function formatOutcome(outcome: OperationOutcome): string {
  const issues = Array.isArray(outcome.issue) ? outcome.issue : [];
  const lines = issues
    .map((i) => {
      const sev = i.severity ?? 'unknown';
      const code = i.code ?? 'unknown';
      const diag = i.diagnostics ? ` — ${i.diagnostics}` : '';
      return `${sev}/${code}${diag}`;
    })
    .filter(Boolean);
  return lines.length ? lines.join('\n') : 'OperationOutcome (no issue details)';
}

function EmptyCardsPlaceholder(props: { message: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 4,
        textAlign: 'center',
        bgcolor: 'grey.50',
        borderStyle: 'dashed',
      }}
    >
      <InboxOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} aria-hidden />
      <Typography variant="body2" color="text.secondary">
        {props.message}
      </Typography>
    </Paper>
  );
}

export default function App() {
  const patientOptions = useMemo(
    () => [
      'patient-ckd-001',
      'patient-ckd-002',
      'patient-ckd-101',
      'patient-ckd-102',
      'patient-ckd-103',
      'patient-ckd-104',
      'patient-ckd-105',
      'patient-ckd-107',
      // TB detection 測試病患（case-14 ~ case-28）
      'patient-tb-001',
      'patient-tb-002',
      'patient-tb-003',
      'patient-tb-004',
      'patient-tb-005',
      'patient-tb-006',
      'patient-tb-007',
      'patient-tb-008',
      'patient-tb-009',
      'patient-tb-010',
      'patient-tb-011',
      'patient-tb-012',
      'patient-tb-013',
      'patient-tb-014',
      'patient-tb-015',
    ],
    [],
  );

  const [cdsTargetId, setCdsTargetId] = useState<CdsTargetId>('main');
  const cdsTarget = CDS_TARGETS.find((t) => t.id === cdsTargetId) ?? CDS_TARGETS[0];

  const [serviceId, setServiceId] = useState<string>('');
  const [selectedService, setSelectedService] = useState<DiscoveryService | null>(null);
  const initialPatientId = patientOptions[0] ?? '';
  const [patientId, setPatientId] = useState<string>(initialPatientId);
  const [autoStart, setAutoStart] = useState<boolean>(true);
  const [useEgfrPrefetchFromFhir, setUseEgfrPrefetchFromFhir] = useState<boolean>(false);
  const [useCkdPrefetchFromFhir, setUseCkdPrefetchFromFhir] = useState<boolean>(true);
  const [hookContextJsonText, setHookContextJsonText] = useState<string>('{}');
  const [hookContextJsonError, setHookContextJsonError] = useState<string | null>(null);

  const [observationCreateBuilderState, setObservationCreateBuilderState] = useState(() =>
    createObservationCreateBuilderState(initialPatientId),
  );
  const [orderSelectBuilderState, setOrderSelectBuilderState] = useState(() => createOrderSelectBuilderState(initialPatientId));

  const uiCopy = TT as Record<string, string>;

  const hookType = (selectedService?.hook && typeof selectedService.hook === 'string' ? selectedService.hook : 'patient-view') as string;
  const supportsPrefetchFromFhir =
    hookType === 'patient-view' &&
    (serviceId === 'egfr-check' ||
      serviceId === 'ckd-risk' ||
      serviceId === 'ckd-comprehensive' ||
      serviceId === '72hr-revisit' ||
      serviceId === 'infection-control-warning' ||
      serviceId === TB_DETECTION_SERVICE_ID);

  const prefetchFromFhirEnabled = serviceId === 'egfr-check' ? useEgfrPrefetchFromFhir : useCkdPrefetchFromFhir;
  const setPrefetchFromFhirEnabled = (v: boolean) => {
    if (serviceId === 'egfr-check') setUseEgfrPrefetchFromFhir(v);
    else setUseCkdPrefetchFromFhir(v);
  };

  const [discoveryJson, setDiscoveryJson] = useState<unknown>(null);
  const [hookReqJson, setHookReqJson] = useState<CdsHookRequest | null>(null);
  const [hookRes, setHookRes] = useState<CdsHookResponse | null>(null);
  const [hookRawJson, setHookRawJson] = useState<unknown>(null);

  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [loadingHook, setLoadingHook] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ruleEngine = hookRes ? getRuleEngine(hookRes.cards) : undefined;
  const busy = loadingHook || loadingDiscovery;

  async function loadDiscovery() {
    setLoadingDiscovery(true);
    setError(null);
    try {
      const json = await fetchDiscovery({ basePath: cdsTarget.basePath });
      setDiscoveryJson(json);
      const services = getDiscoveryServices(json);
      const next =
        services.find((s) => typeof s.id === 'string' && s.id === serviceId) ??
        services.find((s) => typeof s.id === 'string') ??
        null;
      const nextId = typeof next?.id === 'string' ? next.id : '';
      setSelectedService(next);
      setServiceId(nextId);
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in (e as any) ? String((e as any).message) : String(e);
      setError(`Discovery failed: ${msg}`);
      setDiscoveryJson(null);
      setSelectedService(null);
      setServiceId('');
    } finally {
      setLoadingDiscovery(false);
    }
  }

  async function runHook() {
    if (!serviceId) return;
    setLoadingHook(true);
    setError(null);

    const hook = hookType;
    let extraContext: Record<string, unknown> = {};
    if (hook !== 'patient-view') {
      if (hook === OBSERVATION_CREATE_HOOK) {
        const parsed = parseObservationCreateContext(observationCreateBuilderState, patientId);
        if (parsed.error) {
          setObservationCreateBuilderState((s) => ({ ...s, contextJsonError: parsed.error }));
          setLoadingHook(false);
          return;
        }
        extraContext = parsed.context;
      } else if (hook === ORDER_SELECT_HOOK) {
        const parsed = parseOrderSelectContext(orderSelectBuilderState, patientId);
        if (parsed.error) {
          setOrderSelectBuilderState((s) => ({ ...s, contextJsonError: parsed.error }));
          setLoadingHook(false);
          return;
        }
        extraContext = parsed.context;
      } else {
        try {
          const parsed = JSON.parse(hookContextJsonText || '{}') as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            extraContext = parsed as Record<string, unknown>;
            setHookContextJsonError(null);
          } else {
            setHookContextJsonError('context JSON 必須是物件（object）');
            setLoadingHook(false);
            return;
          }
        } catch (e) {
          setHookContextJsonError(`context JSON 解析失敗：${String(e)}`);
          setLoadingHook(false);
          return;
        }
      }
    } else {
      setHookContextJsonError(null);
    }

    const req: CdsHookRequest = {
      hook,
      context: { ...(patientId ? { patientId } : {}), ...extraContext },
    };

    try {
      // 目前前端 prefetch 組裝僅針對既有 CKD/egfr 三支 patient-view 服務提供（其他 hook 以後端 hybrid 為主）
      if ((serviceId === 'ckd-risk' || serviceId === 'ckd-comprehensive') && prefetchFromFhirEnabled && supportsPrefetchFromFhir) {
        const patient = await fhirGet(`Patient/${encodeURIComponent(patientId)}`);
        const conditions = await fhirSearch(
          'Condition',
          `patient=${encodeURIComponent(patientId)}&clinical-status=active`,
        );
        const conditionsAll = await fhirSearch(
          'Condition',
          `patient=${encodeURIComponent(patientId)}`,
        );
        const codes = ['62238-1', '33914-3', '9318-7', '32294-1', '39156-5'].join(',');
        const observations = await fhirSearch(
          'Observation',
          `patient=${encodeURIComponent(patientId)}&code=${encodeURIComponent(codes)}`,
        );
        const familyHistory = await fhirSearch(
          'FamilyMemberHistory',
          `patient=${encodeURIComponent(patientId)}`,
        );
        const latestEgfr =
          serviceId === 'ckd-comprehensive'
            ? await fhirSearch(
                'Observation',
                `patient=${encodeURIComponent(patientId)}&code=62238-1,33914-3&_sort=-date&_count=1`,
              )
            : [];

        req.prefetch = {
          patient,
          conditions: {
            resourceType: 'Bundle',
            type: 'searchset',
            total: conditions.length,
            entry: conditions.map((r) => ({ resource: r })),
          },
          conditionsAll: {
            resourceType: 'Bundle',
            type: 'searchset',
            total: conditionsAll.length,
            entry: conditionsAll.map((r) => ({ resource: r })),
          },
          observations: {
            resourceType: 'Bundle',
            type: 'searchset',
            total: observations.length,
            entry: observations.map((r) => ({ resource: r })),
          },
          familyHistory: {
            resourceType: 'Bundle',
            type: 'searchset',
            total: familyHistory.length,
            entry: familyHistory.map((r) => ({ resource: r })),
          },
          ...(serviceId === 'ckd-comprehensive'
            ? { latestEgfr: bundleFromResources(latestEgfr) }
            : {}),
        };
      } else if (serviceId === 'egfr-check' && prefetchFromFhirEnabled && supportsPrefetchFromFhir) {
        const patient = await fhirGet(`Patient/${encodeURIComponent(patientId)}`);
        const egfrObs = await fhirSearch(
          'Observation',
          `patient=${encodeURIComponent(patientId)}&code=62238-1&_sort=-date&_count=1`,
        );
        const creaObs = await fhirSearch(
          'Observation',
          `patient=${encodeURIComponent(patientId)}&code=2160-0&_sort=-date&_count=1`,
        );
        req.prefetch = {
          patient,
          latestEgfr: bundleFromResources(egfrObs),
          latestCreatinine: bundleFromResources(creaObs),
        };
      } else if (serviceId === '72hr-revisit' && prefetchFromFhirEnabled && supportsPrefetchFromFhir) {
        const patient = await fhirGet(`Patient/${encodeURIComponent(patientId)}`);
        const encounters = await fhirSearch(
          'Encounter',
          `patient=${encodeURIComponent(patientId)}&_sort=-date&_count=30`,
        );
        req.prefetch = {
          patient,
          recentEncounters: bundleFromResources(encounters),
        };
      } else if (serviceId === 'infection-control-warning' && prefetchFromFhirEnabled && supportsPrefetchFromFhir) {
        const patient = await fhirGet(`Patient/${encodeURIComponent(patientId)}`);
        const flags = await fhirSearch('Flag', `patient=${encodeURIComponent(patientId)}&_count=50`);
        const medicationStatements = await fhirSearch(
          'MedicationStatement',
          `patient=${encodeURIComponent(patientId)}&_count=50`,
        );
        const conditions = await fhirSearch(
          'Condition',
          `patient=${encodeURIComponent(patientId)}&clinical-status=active`,
        );
        req.prefetch = {
          patient,
          flags: bundleFromResources(flags),
          medicationStatements: bundleFromResources(medicationStatements),
          conditions: bundleFromResources(conditions),
        };
      } else if (
        serviceId === TB_DETECTION_SERVICE_ID &&
        prefetchFromFhirEnabled &&
        supportsPrefetchFromFhir
      ) {
        const patient = await fhirGet(`Patient/${encodeURIComponent(patientId)}`);
        const conditions = await fhirSearch(
          'Condition',
          `patient=${encodeURIComponent(patientId)}&_count=200`,
        );
        const medicationRequests = await fhirSearch(
          'MedicationRequest',
          `patient=${encodeURIComponent(patientId)}&_count=200`,
        );
        const medicationStatements = await fhirSearch(
          'MedicationStatement',
          `patient=${encodeURIComponent(patientId)}&_count=200`,
        );
        const flags = await fhirSearch(
          'Flag',
          `patient=${encodeURIComponent(patientId)}&_count=50`,
        );
        const observations = await fhirSearch(
          'Observation',
          `patient=${encodeURIComponent(patientId)}&_sort=-date&_count=200`,
        );
        req.prefetch = {
          patient,
          conditions: bundleFromResources(conditions),
          medicationRequests: bundleFromResources(medicationRequests),
          medicationStatements: bundleFromResources(medicationStatements),
          flags: bundleFromResources(flags),
          observations: bundleFromResources(observations),
        };
      }
    } catch (e) {
      setError(`Prefetch / FHIR failed:\n${formatFhirError(e)}`);
      setHookRes(null);
      setHookRawJson(null);
      setLoadingHook(false);
      return;
    }

    setHookReqJson(req);

    try {
      const { response, rawJson } = await callHook(serviceId, req, { basePath: cdsTarget.basePath });
      setHookRes(response);
      setHookRawJson(rawJson);
    } catch (e) {
      const err = e as {
        kind?: string;
        status?: number;
        statusText?: string;
        bodyText?: string;
        outcome?: OperationOutcome;
      };
      if (err?.kind === 'operation-outcome' && err.outcome) {
        setError(`Hook failed (${err.status}):\n${formatOutcome(err.outcome)}`);
      } else if (err?.kind === 'http') {
        const body = err.bodyText ? `\n${err.bodyText}` : '';
        setError(`Hook failed (${err.status} ${err.statusText})${body}`);
      } else if (err?.kind === 'invalid-json') {
        setError(`Hook invalid response (${err.status}): ${err.bodyText ?? ''}`);
      } else {
        setError(`Hook failed: ${String(e)}`);
      }
      setHookRes(null);
      setHookRawJson(null);
    } finally {
      setLoadingHook(false);
    }
  }

  useEffect(() => {
    void loadDiscovery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cdsTargetId]);

  useEffect(() => {
    if (!autoStart) return;
    if (!serviceId) return;
    if (hookType === 'patient-view' && !patientId) return;
    void runHook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, serviceId, cdsTargetId, autoStart, useEgfrPrefetchFromFhir, useCkdPrefetchFromFhir, hookContextJsonText]);

  const infoCards = hookRes?.cards?.filter((c) => (c.indicator ?? 'info') === 'info') ?? [];
  const warningCards =
    hookRes?.cards?.filter((c) => (c.indicator ?? '') === 'warning' || (c.indicator ?? '') === 'critical') ?? [];

  return (
    <>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
        <a href="#main-content" className="skip-link">
          跳至主要內容
        </a>

        {busy ? (
          <LinearProgress
            sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.drawer + 2 }}
            aria-busy="true"
            aria-label="載入中"
          />
        ) : null}

        <AppBar
          position="sticky"
          elevation={0}
          component="header"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Toolbar sx={{ py: { xs: 1.25, sm: 1.5 }, px: { xs: 2, sm: 3 } }}>
            <Stack direction="row" spacing={1.25} sx={{ width: '100%', alignItems: 'center' }}>
              <Tooltip title={TT.brandIcon} arrow placement="bottom-start" slotProps={tooltipSlotProps}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: { xs: 40, sm: 44 },
                    height: { xs: 40, sm: 44 },
                    borderRadius: 2,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  <LocalHospitalOutlinedIcon sx={{ color: 'primary.main', fontSize: 26 }} />
                </Box>
              </Tooltip>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                  <Typography variant="h6" component="h1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                    {APP_TITLE}
                  </Typography>
                  <Tooltip title={APP_DESCRIPTION} arrow placement="bottom-start" slotProps={tooltipSlotProps}>
                    <IconButton size="small" aria-label="應用說明" sx={{ p: 0.25 }}>
                      <InfoOutlinedIcon fontSize="small" color="action" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Typography variant="caption" color="primary" sx={{ display: 'block', fontWeight: 600 }}>
                  {APP_SUBTITLE}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1.25} sx={{ flexShrink: 0, alignItems: 'center' }}>
                <Tooltip title={TT.ruleEngine} arrow placement="bottom-end" slotProps={tooltipSlotProps}>
                  <span>
                    <Chip
                      label={`RuleEngine：${ruleEngine ?? 'N/A'}`}
                      color={ruleEngine === 'ELM' ? 'success' : ruleEngine === 'TS_FALLBACK' ? 'warning' : 'default'}
                      variant={ruleEngine ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 700, px: 0.5 }}
                    />
                  </span>
                </Tooltip>
                {loadingHook ? (
                  <CircularProgress size={24} aria-label="Hook 請求處理中" />
                ) : null}
              </Stack>
            </Stack>
          </Toolbar>
        </AppBar>

        <Container component="main" id="main-content" maxWidth="xl" sx={{ py: { xs: 2, sm: 3 }, flex: 1 }}>
          <Stack spacing={3}>
            <Paper
              elevation={0}
              variant="outlined"
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 2,
              }}
            >
              <Stack direction="row" spacing={0.75} sx={{ mb: 2, alignItems: 'center' }}>
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.14em' }}>
                  請求設定
                </Typography>
                <Tooltip title={TT.sectionRequest} arrow placement="right-start" slotProps={tooltipSlotProps}>
                  <IconButton size="small" aria-label="請求設定說明" sx={{ p: 0.25 }}>
                    <InfoOutlinedIcon fontSize="small" color="action" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Tooltip title={TT.cdsTarget} arrow placement="top" slotProps={tooltipSlotProps}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="target-label">CDS 目標</InputLabel>
                      <Select
                        labelId="target-label"
                        label="CDS 目標"
                        value={cdsTargetId}
                        onChange={(e) => setCdsTargetId(e.target.value as CdsTargetId)}
                      >
                        {CDS_TARGETS.map((t) => (
                          <MenuItem key={t.id} value={t.id}>
                            {t.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Tooltip>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Tooltip title={TT.cdsService} arrow placement="top" slotProps={tooltipSlotProps}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="service-label">CDS 服務</InputLabel>
                      <Select
                        labelId="service-label"
                        label="CDS 服務"
                        value={serviceId}
                        onChange={(e) => {
                          const v = String(e.target.value ?? '');
                          setServiceId(v);
                          const services = getDiscoveryServices(discoveryJson);
                          const svc = services.find((s) => s.id === v) ?? null;
                          setSelectedService(svc);
                        }}
                      >
                        {getDiscoveryServices(discoveryJson).map((s, idx) => {
                          const id = typeof s.id === 'string' ? s.id : `svc-${idx}`;
                          return (
                            <MenuItem key={id} value={typeof s.id === 'string' ? s.id : ''} disabled={typeof s.id !== 'string'}>
                              {getServiceLabel(s)}
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>
                  </Tooltip>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, lineHeight: 1.6 }}>
                    {serviceId === 'egfr-check'
                      ? TT.serviceExplainEgfr
                      : serviceId === 'ckd-risk'
                        ? TT.serviceExplainCkd
                        : serviceId === 'ckd-comprehensive'
                          ? TT.serviceExplainCkdComprehensive
                          : selectedService?.description
                            ? String(selectedService.description)
                            : `hook: ${String(selectedService?.hook ?? 'unknown')}`}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <Tooltip title={TT.patientId} arrow placement="top" slotProps={tooltipSlotProps}>
                    <Box>
                      <Autocomplete
                        freeSolo
                        options={patientOptions}
                        value={patientId}
                        onInputChange={(_, v) => setPatientId(v)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size="small"
                            label="Patient ID"
                            placeholder="輸入或選擇病患 ID"
                            fullWidth
                            slotProps={{
                              ...params.slotProps,
                              htmlInput: {
                                ...params.slotProps.htmlInput,
                                'aria-label': 'Patient identifier',
                              },
                            }}
                          />
                        )}
                      />
                    </Box>
                  </Tooltip>
                  {serviceId === TB_DETECTION_SERVICE_ID
                    ? renderTbDetectionQuickPresets({ patientId, setPatientId })
                    : null}
                </Grid>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Stack spacing={1}>
                    <Tooltip title={TT.autoStart} arrow placement="left" slotProps={tooltipSlotProps}>
                      <span>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={autoStart}
                              onChange={(e) => setAutoStart(e.target.checked)}
                              slotProps={{ input: { 'aria-label': '病患畫面開啟時自動呼叫 Hook' } }}
                            />
                          }
                          label="自動呼叫（patient-view）"
                        />
                      </span>
                    </Tooltip>
                    <Tooltip
                      title={
                        supportsPrefetchFromFhir
                          ? serviceId === 'egfr-check'
                            ? TT.prefetchEgfr
                            : serviceId === '72hr-revisit' ||
                                serviceId === 'infection-control-warning' ||
                                serviceId === TB_DETECTION_SERVICE_ID
                              ? TT.prefetchEmergency
                              : TT.prefetchCkd
                          : TT.prefetchUnsupported
                      }
                      arrow
                      placement="left"
                      slotProps={tooltipSlotProps}
                    >
                      <span>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={prefetchFromFhirEnabled}
                              onChange={(e) => setPrefetchFromFhirEnabled(e.target.checked)}
                              slotProps={{ input: { 'aria-label': '是否由前端先向 FHIR 組 prefetch' } }}
                              disabled={!supportsPrefetchFromFhir}
                            />
                          }
                          label={`Prefetch from FHIR（${serviceId}）`}
                        />
                      </span>
                    </Tooltip>
                  </Stack>
                </Grid>
              </Grid>

              {(selectedService?.hook ?? 'patient-view') !== 'patient-view' ? (
                hookType === OBSERVATION_CREATE_HOOK ? (
                  <Tooltip
                    title={uiCopy['hookContextObservationCreate'] ?? TT.hookContextJson}
                    arrow
                    placement="top"
                    slotProps={tooltipSlotProps}
                  >
                    <Box>
                      {renderObservationCreateBuilder({
                        patientId,
                        state: observationCreateBuilderState,
                        setState: setObservationCreateBuilderState,
                        tooltipTitle: uiCopy['hookContextObservationCreate'] ?? TT.hookContextJson,
                      })}
                    </Box>
                  </Tooltip>
                ) : hookType === ORDER_SELECT_HOOK ? (
                  <Tooltip
                    title={uiCopy['hookContextOrderSelect'] ?? TT.hookContextJson}
                    arrow
                    placement="top"
                    slotProps={tooltipSlotProps}
                  >
                    <Box>
                      {renderOrderSelectBuilder({
                        patientId,
                        state: orderSelectBuilderState,
                        setState: setOrderSelectBuilderState,
                        tooltipTitle: uiCopy['hookContextOrderSelect'] ?? TT.hookContextJson,
                      })}
                    </Box>
                  </Tooltip>
                ) : (
                  <Box sx={{ mt: 2 }}>
                    <Tooltip title={TT.hookContextJson} arrow placement="top" slotProps={tooltipSlotProps}>
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        minRows={4}
                        label={`Context JSON（${String(selectedService?.hook ?? 'unknown')}）`}
                        value={hookContextJsonText}
                        onChange={(e) => setHookContextJsonText(e.target.value)}
                        error={Boolean(hookContextJsonError)}
                        helperText={hookContextJsonError ?? '（最小可用：{}）'}
                      />
                    </Tooltip>
                  </Box>
                )
              ) : null}

              {serviceId === 'egfr-check' && prefetchFromFhirEnabled ? (
                <Tooltip title={TT.discoveryKeysChip} arrow placement="top" slotProps={tooltipSlotProps}>
                  <span>
                    <Chip
                      sx={{ mt: 2, cursor: 'help' }}
                      size="small"
                      label="將帶入 Discovery 鍵：patient · latestEgfr · latestCreatinine"
                      variant="outlined"
                      color="primary"
                    />
                  </span>
                </Tooltip>
              ) : null}
              {serviceId === 'ckd-risk' && prefetchFromFhirEnabled ? (
                <Tooltip title={TT.discoveryKeysChipCkd} arrow placement="top" slotProps={tooltipSlotProps}>
                  <span>
                    <Chip
                      sx={{ mt: 2, cursor: 'help' }}
                      size="small"
                      label="將帶入 Discovery 鍵：patient · conditions · conditionsAll · observations · familyHistory"
                      variant="outlined"
                      color="primary"
                    />
                  </span>
                </Tooltip>
              ) : null}
              {serviceId === 'ckd-comprehensive' && prefetchFromFhirEnabled ? (
                <Tooltip title={TT.discoveryKeysChipCkdComprehensive} arrow placement="top" slotProps={tooltipSlotProps}>
                  <span>
                    <Chip
                      sx={{ mt: 2, cursor: 'help' }}
                      size="small"
                      label="將帶入 Discovery 鍵：patient · conditions · observations · latestEgfr"
                      variant="outlined"
                      color="primary"
                    />
                  </span>
                </Tooltip>
              ) : null}

              <Divider sx={{ my: 2 }} />

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
              >
                <Tooltip title={TT.reloadDiscovery} arrow slotProps={tooltipSlotProps}>
                  <span>
                    <Button
                      variant="outlined"
                      fullWidth
                      sx={{ minWidth: { sm: 200 } }}
                      startIcon={loadingDiscovery ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                      onClick={() => void loadDiscovery()}
                      disabled={loadingDiscovery}
                      aria-busy={loadingDiscovery}
                    >
                      重新載入 Discovery
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title={TT.callHook} arrow slotProps={tooltipSlotProps}>
                  <span>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      sx={{ minWidth: { sm: 200 } }}
                      startIcon={loadingHook ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
                      onClick={() => void runHook()}
                      disabled={loadingHook || !serviceId || ((selectedService?.hook ?? 'patient-view') === 'patient-view' && !patientId)}
                      aria-busy={loadingHook}
                    >
                      立即呼叫 Hook
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Paper>

            {error ? (
              <Alert severity="error" role="alert" aria-live="assertive" sx={{ borderRadius: 2 }}>
                <Typography component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                  {error}
                </Typography>
              </Alert>
            ) : null}

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, lg: 5 }}>
                <Stack spacing={2}>
                  <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2 }}>
                    <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, alignItems: 'center' }}>
                      <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
                        請求本文（{hookType}）
                      </Typography>
                      <Tooltip title={TT.sectionRequestBody} arrow placement="right" slotProps={tooltipSlotProps}>
                        <IconButton size="small" aria-label="請求本文說明" sx={{ p: 0.25 }}>
                          <InfoOutlinedIcon fontSize="small" color="action" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      送向{' '}
                      <Box component="code" sx={{ bgcolor: 'grey.100', px: 0.5, borderRadius: 0.5 }}>
                        /cds-services/{serviceId}
                      </Box>{' '}
                      的 JSON；開啟 Prefetch 時內容會較大屬正常。
                    </Typography>
                    <JsonBlock value={hookReqJson} emptyLabel="（尚未送出請求）" maxHeight={420} />
                  </Paper>

                  <Accordion defaultExpanded variant="outlined" sx={{ borderRadius: '10px !important', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="discovery-json" id="discovery-header">
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <Typography sx={{ fontWeight: 700 }}>Discovery JSON</Typography>
                        <Tooltip title={TT.discoveryJson} arrow slotProps={tooltipSlotProps}>
                          <IconButton
                            component="span"
                            size="small"
                            aria-label="Discovery JSON 說明"
                            onClick={(e) => e.stopPropagation()}
                            sx={{ p: 0.25 }}
                          >
                            <InfoOutlinedIcon fontSize="small" color="action" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <JsonBlock value={discoveryJson} emptyLabel="（無資料）" maxHeight={280} />
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, lg: 7 }}>
                <Stack direction="row" spacing={0.5} sx={{ mb: 2, alignItems: 'center' }}>
                  <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
                    情境輸出
                  </Typography>
                  <Tooltip title={TT.sectionOutput} arrow placement="right" slotProps={tooltipSlotProps}>
                    <IconButton size="small" aria-label="情境輸出說明" sx={{ p: 0.25 }}>
                      <InfoOutlinedIcon fontSize="small" color="action" />
                    </IconButton>
                  </Tooltip>
                </Stack>

                <Stack spacing={3}>
                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.12em' }}>
                      A · 檢驗摘要（info）
                    </Typography>
                    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {infoCards.length ? (
                        infoCards.map((c, idx) => (
                          <CdsCardView
                            key={c.uuid ?? `info-${idx}`}
                            card={c}
                            allowSourceLink={cdsTargetId === 'main'}
                            showSource={cdsTargetId === 'main'}
                          />
                        ))
                      ) : (
                        <EmptyCardsPlaceholder message="尚無 info 卡片 — 請確認已呼叫 Hook 且後端有回傳。" />
                      )}
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.12em' }}>
                      B · 建議與警示（warning / critical）
                    </Typography>
                    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {warningCards.length ? (
                        warningCards.map((c, idx) => (
                          <CdsCardView
                            key={c.uuid ?? `warn-${idx}`}
                            card={c}
                            allowSourceLink={cdsTargetId === 'main'}
                            showSource={cdsTargetId === 'main'}
                          />
                        ))
                      ) : (
                        <EmptyCardsPlaceholder message="目前無警示卡片（規則未觸發或資料不足）。" />
                      )}
                    </Box>
                  </Box>

                  <Accordion variant="outlined" sx={{ borderRadius: '10px !important', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="raw-json" id="raw-header">
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <Typography sx={{ fontWeight: 700 }}>原始回應 JSON</Typography>
                        <Tooltip title={TT.rawResponse} arrow slotProps={tooltipSlotProps}>
                          <IconButton
                            component="span"
                            size="small"
                            aria-label="原始回應說明"
                            onClick={(e) => e.stopPropagation()}
                            sx={{ p: 0.25 }}
                          >
                            <InfoOutlinedIcon fontSize="small" color="action" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                      <JsonBlock value={hookRawJson} emptyLabel="（無資料）" maxHeight={320} />
                    </AccordionDetails>
                  </Accordion>

                  <Typography variant="caption" color="text.secondary" component="p" sx={{ lineHeight: 1.6 }}>
                    開發模式下請求經 Vite proxy 轉發：<code>/cds-services/*</code> → <code>VITE_CDS_PROXY_TARGET</code>
                    ；<code>/fhir/*</code> → FHIR。若改為跨網域直連，後端需設定 CORS。
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </Container>
      </Box>
    </>
  );
}
