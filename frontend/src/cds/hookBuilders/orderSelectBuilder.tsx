/*
 * 更新時間：2026-04-20 17:55
 * 作者：CDS Service
 * 摘要：新增 order-select hook 的 Context builder（模板預填＋JSON 編輯＋基本驗證）
 */

import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export const ORDER_SELECT_HOOK = 'order-select' as const;

export type OrderSelectContextBuilderState = {
  contextJsonText: string;
  contextJsonError: string | null;
};

function buildOrderSelectContextTemplate(patientId?: string): Record<string, unknown> {
  const now = new Date();
  const iso = now.toISOString();

  // CDS Hooks: order-select context commonly contains draftOrders (Bundle) and selections (array of ids/refs).
  // Use a minimal ServiceRequest draft order as a sane default for future backend expansion.
  const serviceRequestId = 'sr-001';
  return {
    ...(patientId ? { patientId } : {}),
    draftOrders: {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        {
          resource: {
            resourceType: 'ServiceRequest',
            id: serviceRequestId,
            status: 'draft',
            intent: 'order',
            code: {
              text: 'Basic metabolic panel',
            },
            authoredOn: iso,
            ...(patientId ? { subject: { reference: `Patient/${patientId}` } } : {}),
          },
        },
      ],
    },
    selections: [`ServiceRequest/${serviceRequestId}`],
  };
}

function validateOrderSelectContextShape(ctx: Record<string, unknown>): string | null {
  const draftOrders = ctx.draftOrders;
  if (!draftOrders || typeof draftOrders !== 'object' || Array.isArray(draftOrders)) {
    return 'order-select：context.draftOrders 必須是 FHIR Bundle 物件';
  }
  const b = draftOrders as Record<string, unknown>;
  if (b.resourceType !== 'Bundle') return 'order-select：draftOrders.resourceType 必須是 "Bundle"';

  const selections = ctx.selections;
  if (!Array.isArray(selections)) return 'order-select：context.selections 必須是陣列（array）';
  const hasAnySelection = selections.some((s) => typeof s === 'string' && s.length > 0);
  if (!hasAnySelection) return 'order-select：selections 至少需包含一筆字串（例如 "ServiceRequest/sr-001"）';

  return null;
}

export function createOrderSelectBuilderState(patientId?: string): OrderSelectContextBuilderState {
  return {
    contextJsonText: JSON.stringify(buildOrderSelectContextTemplate(patientId), null, 2),
    contextJsonError: null,
  };
}

export function parseOrderSelectContext(
  state: OrderSelectContextBuilderState,
  patientId?: string,
): { context: Record<string, unknown>; error: string | null } {
  try {
    const parsed = JSON.parse(state.contextJsonText || '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { context: {}, error: 'order-select：context JSON 必須是物件（object）' };
    }

    const obj = parsed as Record<string, unknown>;
    const merged = { ...(patientId ? { patientId } : {}), ...obj };
    const err = validateOrderSelectContextShape(merged);
    return { context: merged, error: err };
  } catch (e) {
    return { context: {}, error: `order-select：context JSON 解析失敗：${String(e)}` };
  }
}

export function renderOrderSelectBuilder(props: {
  patientId?: string;
  state: OrderSelectContextBuilderState;
  setState: (next: OrderSelectContextBuilderState) => void;
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
          order-select · Context Builder
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            setState({
              contextJsonText: JSON.stringify(buildOrderSelectContextTemplate(patientId), null, 2),
              contextJsonError: null,
            });
          }}
        >
          套用 Order 範本
        </Button>
      </Stack>

      <TextField
        fullWidth
        size="small"
        multiline
        minRows={8}
        label="Context JSON（order-select）"
        value={state.contextJsonText}
        onChange={(e) => setState({ ...state, contextJsonText: e.target.value })}
        error={Boolean(state.contextJsonError)}
        helperText={state.contextJsonError ?? tooltipTitle ?? '至少需包含 draftOrders（Bundle）與 selections（array）'}
      />
    </Box>
  );
}

