/*
 * 更新時間：2026-04-16 10:05
 * 作者：CDS Service
 * 摘要：CDS Hook UI — MUI 主題（語意色、圓角、按鈕無全大寫）符合 UI/UX Pro Max 一致性
 */
import { createTheme } from '@mui/material/styles';

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2563eb', dark: '#1d4ed8', light: '#3b82f6' },
    secondary: { main: '#64748b' },
    success: { main: '#059669' },
    warning: { main: '#d97706' },
    error: { main: '#dc2626' },
    info: { main: '#0284c7' },
    background: {
      default: '#f1f5f9',
      paper: '#ffffff',
    },
    divider: 'rgba(15, 23, 42, 0.08)',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: ['"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'].join(','),
    h5: { fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
    overline: { fontWeight: 600, letterSpacing: '0.08em' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
          paddingLeft: 16,
          paddingRight: 16,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, alignItems: 'flex-start' },
      },
    },
  },
});
