/*
 * 更新時間：2026-04-14 16:56
 * 作者：CDS Service
 * 摘要：啟動時載入 .env（dotenv/config），讓 FHIR_BASE_URL 等設定可由檔案提供
 *
 * 更新時間：2026-04-14 12:00
 * 作者：CDS Service
 * 摘要：Fastify 啟動、註冊 CDS 路由
 */
import 'dotenv/config';
import Fastify from 'fastify';
import { registerCdsRoutes } from './cds/routes.js';

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({ logger: true });
  await registerCdsRoutes(app);
  await app.listen({ port, host });
  app.log.info(`CDS Service listening on http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
