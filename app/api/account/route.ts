export const runtime = 'nodejs';

import { requestDeriv } from '@/lib/deriv-client';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    // Allow passing a token for testing as a query param (avoid in production)
    const token = url.searchParams.get('token') ?? process.env.DERIV_API_TOKEN ?? undefined;
    const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID;

    // If a token is present, attempt an authorize call first.
    if (token) {
      const authResp = await requestDeriv({ authorize: token }, { appId });
      // If Deriv returned an error for authorize, surface it.
      if (authResp?.error) {
        return new Response(JSON.stringify({ ok: false, error: authResp.error }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
    }

    // Request account status
    const accountResp = await requestDeriv({ get_account_status: 1 }, { appId });

    return new Response(JSON.stringify({ ok: true, data: accountResp }), {
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
