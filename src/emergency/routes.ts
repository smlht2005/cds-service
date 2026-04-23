/*
 * 更新時間：2026-04-22 09:22
 * 作者：CDS Service
 * 摘要：急診路由 — 新增 POST /cds-services/tb-detection 繫入 handleTbDetectionHook；既有兩支 hook 行為不變
 *
 * 更新時間：2026-04-17 11:55
 * 作者：CDS Service
 * 摘要：急診獨立 CDS — GET /cds-services、POST 兩支 patient-view hook
 */

import type { FastifyInstance } from 'fastify';
import type { CdsHooksRequest } from '../cds/ckdHookHandler.js';
import { getDiscoveryResponse } from '../cds/cdsServices.js';
import { emergencyDiscoveryServices } from './emergencyServiceDefinitions.js';
import { handleRevisit72hHook } from './handlers/revisit72hHookHandler.js';
import { handleInfectionControlHook } from './handlers/infectionControlHookHandler.js';
import { handleTbDetectionHook } from './handlers/tbDetectionHookHandler.js';

async function postEmergencyCdsHook(
  request: { body: CdsHooksRequest; log: { error: (o: unknown, msg: string) => void } },
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  routeLabel: string,
  handler: (body: CdsHooksRequest) => Promise<unknown>,
): Promise<unknown> {
  try {
    const body = request.body ?? {};
    const result = await handler(body);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    request.log.error({ err }, `${routeLabel} failed`);
    return reply.status(502).send({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          diagnostics: msg,
        },
      ],
    });
  }
}

export async function registerEmergencyCdsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/cds-services', async () => getDiscoveryResponse(emergencyDiscoveryServices));

  app.post<{ Body: CdsHooksRequest }>('/cds-services/72hr-revisit', async (request, reply) =>
    postEmergencyCdsHook(request, reply, '72hr-revisit', handleRevisit72hHook),
  );

  app.post<{ Body: CdsHooksRequest }>(
    '/cds-services/infection-control-warning',
    async (request, reply) =>
      postEmergencyCdsHook(request, reply, 'infection-control-warning', handleInfectionControlHook),
  );

  app.post<{ Body: CdsHooksRequest }>('/cds-services/tb-detection', async (request, reply) =>
    postEmergencyCdsHook(request, reply, 'tb-detection', handleTbDetectionHook),
  );
}
