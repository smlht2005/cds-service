/*
 * 更新時間：2026-04-17 11:55
 * 作者：CDS Service
 * 摘要：急診獨立 CDS Server 入口（獨立 port；與 src/server.ts 並存）
 */

import 'dotenv/config';
import Fastify from 'fastify';
import { registerEmergencyCdsRoutes } from './routes.js';

const port = Number(process.env.EMERGENCY_CDS_PORT) || 3001;
const host = process.env.EMERGENCY_CDS_HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({ logger: true });
  await registerEmergencyCdsRoutes(app);
  await app.listen({ port, host });
  app.log.info(`Emergency CDS Service listening on http://${host}:${port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
