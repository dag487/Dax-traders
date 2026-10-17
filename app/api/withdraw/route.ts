export const runtime = 'nodejs';

import { verify } from '@/lib/jwt';
import { getUserToken } from '@/lib/user-store';
import { createClient } from '@supabase/supabase-js';
import { requestDeriv } from '@/lib/deriv-client';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || '';
    const m = auth.match(/^Bearer (.+)$/i);
    if (!m) return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { 'content-type': 'application/json' } });
    const token = m[1];
    const payload = verify(token);
    if (!payload || !payload.userId) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { 'content-type': 'application/json' } });

    const body = await req.json();
    const amount = Number(body?.amount);
    const currency = typeof body?.currency === 'string' ? body.currency.toUpperCase() : 'USD';
    const method = typeof body?.method === 'string' ? body.method : 'deriv_withdrawal';

    if (!amount || amount <= 0) return new Response(JSON.stringify({ error: 'Invalid amount' }), { status: 400, headers: { 'content-type': 'application/json' } });

    const supabase = getSupabase();
    if (!supabase) {
      return new Response(JSON.stringify({ error: 'SUPABASE_URL and SUPABASE_KEY must be set to persist withdrawals in production' }), { status: 503, headers: { 'content-type': 'application/json' } });
    }

    // Persist withdrawal request
    const { data, error } = await supabase.from('withdrawals').insert([{ user_id: String(payload.userId), amount, currency, method, status: 'pending' }]).select('*').single();
    if (error) throw error;

    // Optionally attempt to call Deriv (NOT performing actual withdrawal automatically — Deriv has specific KYC/cashier flows).
    // We'll attempt a lightweight authorize to verify token validity, but won't perform the withdrawal.
    const derivToken = await getUserToken(String(payload.userId));
    let derivCheck = null;
    if (derivToken) {
      try {
        const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID;
        derivCheck = await requestDeriv({ authorize: derivToken }, { appId });
      } catch (e) {
        derivCheck = { error: 'authorize_failed', message: (e as any)?.message ?? String(e) };
      }
    }

    return new Response(JSON.stringify({ ok: true, withdrawal: data, derivCheck }), { status: 201, headers: { 'content-type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
