/*
 * 更新時間：2026-04-22 10:58
 * 作者：CDS Service
 * 摘要：Phase 4 — TB Detection（patient-view）前端輔助：提供測試病患快選 chips，
 *       讓使用者以單鍵切換 patient-tb-001（Active+FirstLine）/ 002（2nd-line w/o dx）/
 *       016（LTBI）/ 017（Flag only）/ 018（Contact）情境進行驗證。
 *       服務本身為 patient-view（只需 patientId），故不提供 context JSON builder；
 *       Prefetch（Patient/Condition/MedReq/MedStmt/Flag/Observation）於 App.tsx 組裝。
 */

import { Box, Chip, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export const TB_DETECTION_SERVICE_ID = 'tb-detection' as const;

export interface TbDetectionQuickPreset {
  id: string;
  label: string;
  description: string;
}

export const TB_DETECTION_QUICK_PRESETS: TbDetectionQuickPreset[] = [
  { id: 'patient-tb-001', label: 'patient-tb-001', description: 'Active TB + Isoniazid（case-14）' },
  { id: 'patient-tb-002', label: 'patient-tb-002', description: '2nd-line 無 TB 診斷（case-15）' },
  { id: 'patient-tb-016', label: 'patient-tb-016', description: 'LTBI + Isoniazid（case-16）' },
  { id: 'patient-tb-017', label: 'patient-tb-017', description: 'Infection-Control Flag（case-17）' },
  { id: 'patient-tb-018', label: 'patient-tb-018', description: 'TB Contact（case-18）' },
];

export function renderTbDetectionQuickPresets(props: {
  patientId: string;
  setPatientId: (next: string) => void;
}): ReactNode {
  const { patientId, setPatientId } = props;

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        TB Detection 測試病患快選：
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
        {TB_DETECTION_QUICK_PRESETS.map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            title={p.description}
            size="small"
            color={patientId === p.id ? 'primary' : 'default'}
            variant={patientId === p.id ? 'filled' : 'outlined'}
            onClick={() => setPatientId(p.id)}
          />
        ))}
      </Stack>
    </Box>
  );
}
