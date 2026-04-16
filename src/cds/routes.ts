/*
 * 更新時間：2026-04-15 09:08
 * 作者：CDS Service
 * 摘要：步驟二 — Discovery 合併 egfr-check + ckd-risk；POST /cds-services/egfr-check 與 ckd-risk 共用 handler
 *
 * 更新時間：2026-04-14 12:00
 * 作者：CDS Service
 * 摘要：註冊 GET /cds-services、POST /cds-services/ckd-risk
 */
import type { FastifyInstance } from 'fastify';
import { egfrCheckService, getDiscoveryResponse } from './cdsServices.js';
import { ckdRiskService } from './ckdServiceDefinition.js';
import { handleCkdRiskHook, type CdsHooksRequest } from './ckdHookHandler.js';
import { handleEgfrCheckHook } from './egfrCheckHookHandler.js';

async function postCdsHook(
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

export async function registerCdsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/cds-services', async () =>
    getDiscoveryResponse([egfrCheckService, ckdRiskService]),
  );

  app.post<{ Body: CdsHooksRequest }>('/cds-services/egfr-check', async (request, reply) =>
    postCdsHook(request, reply, 'egfr-check', handleEgfrCheckHook),
  );

  app.post<{ Body: CdsHooksRequest }>('/cds-services/ckd-risk', async (request, reply) =>
    postCdsHook(request, reply, 'ckd-risk', handleCkdRiskHook),
  );
}
