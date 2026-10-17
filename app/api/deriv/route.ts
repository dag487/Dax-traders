export const runtime = 'nodejs';

import { requestDeriv } from '@/lib/deriv-client';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Expect body to be: { app_id?: string, token?: string, request: { ... } }
    if (!body || typeof body !== 'object' || !body.request) {
      return new Response(JSON.stringify({ error: 'Request body must be JSON with a `request` property' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const appId = body.app_id ?? process.env.NEXT_PUBLIC_DERIV_APP_ID;
    const token = body.token ?? process.env.DERIV_API_TOKEN ?? undefined;

    const payload = body.request;

    // If caller provided authorize token inline, caller should send a `{ "authorize": { "authorize": "TOKEN" } }` style request
    const resp = await requestDeriv(payload, { appId, token });

    return new Response(JSON.stringify({ ok: true, data: resp }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
