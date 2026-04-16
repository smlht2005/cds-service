/*
 * 更新時間：2026-04-16 10:05
 * 作者：CDS Service
 * 摘要：可捲動 JSON 區塊 — 固定最大高度、等寬字體、可讀性
 */
import { Box, Typography } from '@mui/material';

type Props = {
  value: unknown;
  emptyLabel?: string;
  maxHeight?: number | string;
};

export function JsonBlock({ value, emptyLabel = '—', maxHeight = 360 }: Props) {
  const text = value == null ? '' : JSON.stringify(value, null, 2);
  const isEmpty = text === '' || text === 'null';

  return (
    <Box
      component="pre"
      tabIndex={0}
      aria-label="JSON content"
      sx={{
        m: 0,
        p: 2,
        maxHeight,
        overflow: 'auto',
        borderRadius: 1,
        bgcolor: 'grey.50',
        border: 1,
        borderColor: 'divider',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.8125rem',
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      <Typography component="span" variant="inherit" sx={{ fontFamily: 'inherit', fontSize: 'inherit' }}>
        {isEmpty ? emptyLabel : text}
      </Typography>
    </Box>
  );
}
