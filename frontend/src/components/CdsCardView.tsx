/*
 * 更新時間：2026-04-16 10:05
 * 作者：CDS Service
 * 摘要：CDS Hook 回傳卡片 — 左側語意色條、階層與連結無障礙
 */
import { Box, Chip, Link, Paper, Typography } from '@mui/material';
import type { CdsCard } from '../types/cdsHooks';

export function CdsCardView(props: { card: CdsCard }) {
  const { card } = props;
  const indicator = card.indicator ?? 'info';
  const title = card.summary ?? '(no summary)';
  const detail = card.detail ?? '';

  const severity = indicator === 'warning' ? 'warning' : indicator === 'critical' ? 'error' : 'info';

  const chipColor = severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'info';

  const borderLeftColor =
    severity === 'error' ? 'error.main' : severity === 'warning' ? 'warning.main' : 'primary.main';

  return (
    <Paper
      variant="outlined"
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 2,
        borderLeftWidth: 4,
        borderLeftStyle: 'solid',
        borderLeftColor,
        transition: 'box-shadow 0.2s ease',
        '&:hover': {
          boxShadow: '0 1px 3px rgba(15,23,42,0.08)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
        <Chip size="small" label={indicator} color={chipColor} variant={severity === 'info' ? 'outlined' : 'filled'} sx={{ fontWeight: 600 }} />
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700, lineHeight: 1.35, flex: 1 }}>
          {title}
        </Typography>
      </Box>

      {card.source?.label ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {card.source.url ? (
            <Link href={card.source.url} target="_blank" rel="noreferrer" underline="hover">
              {card.source.label}
            </Link>
          ) : (
            card.source.label
          )}
        </Typography>
      ) : null}

      {detail ? (
        <Typography
          variant="body2"
          component="pre"
          sx={{
            m: 0,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
            color: 'text.primary',
          }}
        >
          {detail}
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary">
          (no detail)
        </Typography>
      )}

      {Array.isArray(card.links) && card.links.length ? (
        <Box component="nav" aria-label="Card links" sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {card.links.map((l) => (
            <Link
              key={`${l.label}-${l.url}`}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              variant="body2"
              sx={{ fontWeight: 500 }}
            >
              {l.label}
            </Link>
          ))}
        </Box>
      ) : null}
    </Paper>
  );
}
