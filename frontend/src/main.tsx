/*
 * 更新時間：2026-04-16 10:05
 * 作者：CDS Service
 * 摘要：套用 appTheme（UI/UX Pro Max 語意色與元件預設）
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';

import App from './App';
import { appTheme } from './theme';
import './style.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <ThemeProvider theme={appTheme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

