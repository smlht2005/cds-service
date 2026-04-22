/*
 * 更新時間：2026-04-20 17:55
 * 作者：CDS Service
 * 摘要：新增 observation-create hook 的 Context builder（模板預填＋JSON 編輯＋基本驗證）
 */

import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export const OBSERVATION_CREATE_HOOK = 'observation-create' as const;

export type ObservationCreateContextBuilderState = {
  contextJsonText: string;
  contextJsonError: string | null;
};

function buildObservationCreateContextTemplate(patientId?: string): Record<string, unknown> {
  const now = new Date();
  const iso = now.toISOString();

  // CDS Hooks: observation-create context commonly contains an "observation" resource.
  // Keep it minimal but usable; UI still allows full JSON editing.
  const observation: Record<string, unknown> = {
    resourceType: 'Observation',
    status: 'final',
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '2160-0',
          display: 'Creatinine [Mass/volume] in Serum or Plasma',
        },
      ],
      text: 'Creatinine',
    },
    effectiveDateTime: iso,
    ...(patientId ? { subject: { reference: `Patient/${patientId}` } } : {}),
    valueQuantity: {
      value: 1.0,
      unit: 'mg/dL',
      system: 'http://unitsofmeasure.org',
      code: 'mg/dL',
    },
  };

  return {
    ...(patientId ? { patientId } : {}),
    observation,
  };
}

function validateObservationCreateContextShape(ctx: Record<string, unknown>): string | null {
  const obs = ctx.observation;
  if (!obs || typeof obs !== 'object' || Array.isArray(obs)) return 'observation-create：context.observation 必須是 FHIR Observation 物件';

  const r = obs as Record<string, unknown>;
  if (r.resourceType !== 'Observation') return 'observation-create：observation.resourceType 必須是 "Observation"';

  const hasCode = Boolean(r.code);
  if (!hasCode) return 'observation-create：observation.code 為必要欄位';

  const hasEffective = typeof r.effectiveDateTime === 'string' && r.effectiveDateTime.length > 0;
  if (!hasEffective) return 'observation-create：observation.effectiveDateTime 為必要欄位（ISO 字串）';

  const hasSubject =
    r.subject && typeof r.subject === 'object' && r.subject !== null && !Array.isArray(r.subject) && 'reference' in (r.subject as any);
  if (!hasSubject && !ctx.patientId) return 'observation-create：請提供 observation.subject（reference）或 context.patientId';

  const hasValueQuantity = Boolean(r.valueQuantity);
  const hasValueCodeableConcept = Boolean(r.valueCodeableConcept);
  if (!hasValueQuantity && !hasValueCodeableConcept) {
    return 'observation-create：請提供 observation.valueQuantity 或 observation.valueCodeableConcept';
  }
  return null;
}

export function createObservationCreateBuilderState(patientId?: string): ObservationCreateContextBuilderState {
  return {
    contextJsonText: JSON.stringify(buildObservationCreateContextTemplate(patientId), null, 2),
    contextJsonError: null,
  };
}

export function parseObservationCreateContext(
  state: ObservationCreateContextBuilderState,
  patientId?: string,
): { context: Record<string, unknown>; error: string | null } {
  try {
    const parsed = JSON.parse(state.contextJsonText || '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { context: {}, error: 'observation-create：context JSON 必須是物件（object）' };
    }

    const obj = parsed as Record<string, unknown>;
    const merged = { ...(patientId ? { patientId } : {}), ...obj };
    const err = validateObservationCreateContextShape(merged);
    return { context: merged, error: err };
  } catch (e) {
    return { context: {}, error: `observation-create：context JSON 解析失敗：${String(e)}` };
  }
}

export function renderObservationCreateBuilder(props: {
  patientId?: string;
  state: ObservationCreateContextBuilderState;
  setState: (next: ObservationCreateContextBuilderState) => void;
  tooltipTitle?: ReactNode;
}): ReactNode {
  const { patientId, state, setState, tooltipTitle } = props;

  return (
    <Box sx={{ mt: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { xs: 'stretch', sm: 'center' }, mb: 1 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          observation-create · Context Builder
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            setState({
              contextJsonText: JSON.stringify(buildObservationCreateContextTemplate(patientId), null, 2),
              contextJsonError: null,
            });
          }}
        >
          套用 Observation 範本
        </Button>
      </Stack>

      <TextField
        fullWidth
        size="small"
        multiline
        minRows={8}
        label="Context JSON（observation-create）"
        value={state.contextJsonText}
        onChange={(e) => setState({ ...state, contextJsonText: e.target.value })}
        error={Boolean(state.contextJsonError)}
        helperText={state.contextJsonError ?? tooltipTitle ?? '至少需包含 observation（resourceType/code/value/effectiveDateTime/subject）'}
      />
    </Box>
  );
}

