import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_CDS_PROXY_TARGET ?? 'http://127.0.0.1:3000';
  const emergencyProxyTarget = env.VITE_EMERGENCY_CDS_PROXY_TARGET ?? 'http://127.0.0.1:3001';
  const fhirTarget = env.VITE_FHIR_BASE_URL ?? 'http://localhost:9090/fhir';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/cds-services': proxyTarget,
        '/emergency-cds-services': {
          target: emergencyProxyTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/emergency-cds-services/, ''),
        },
        '/fhir': {
          target: fhirTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/fhir/, ''),
        },
      },
    },
  };
});

