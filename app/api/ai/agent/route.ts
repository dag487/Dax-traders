export const runtime = 'nodejs';

import { verify } from '@/lib/jwt';
import { createClient } from '@supabase/supabase-js';
import { getUserToken } from '@/lib/user-store';
import { requestDeriv } from '@/lib/deriv-client';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function callOpenAI(prompt: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return data;
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
    const prompt = typeof body?.prompt === 'string' ? body.prompt : null;
    const task = typeof body?.task === 'string' ? body.task : 'insights';

    if (!prompt) return new Response(JSON.stringify({ error: 'prompt is required' }), { status: 400, headers: { 'content-type': 'application/json' } });

    // If OpenAI key is configured, call OpenAI. Otherwise provide a safe fallback.
    if (process.env.OPENAI_API_KEY) {
      try {
        const aiResp = await callOpenAI(prompt);
        // Persist AI interactions to Supabase if available
        const supabase = getSupabase();
        if (supabase) {
          await supabase.from('ai_interactions').insert([{ user_id: String(payload.userId), prompt, response: JSON.stringify(aiResp) }]);
        }
        return new Response(JSON.stringify({ ok: true, ai: aiResp }), { status: 200, headers: { 'content-type': 'application/json' } });
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), { status: 500, headers: { 'content-type': 'application/json' } });
      }
    }

    // Fallback: simple heuristic agent
    const derivToken = await getUserToken(String(payload.userId));
    let accountSummary = null;
    if (derivToken) {
      try {
        accountSummary = await requestDeriv({ authorize: derivToken }, { appId: process.env.NEXT_PUBLIC_DERIV_APP_ID });
      } catch (e) {
        accountSummary = { error: 'unable_to_authorize' };
      }
    }

    // simple rule-based reply
    const reply = `Agent fallback: received task=${task}. Account summary present=${Boolean(accountSummary)}. Prompt received: ${prompt.slice(0, 300)}`;

    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('ai_interactions').insert([{ user_id: String(payload.userId), prompt, response: reply }]);
    }

    return new Response(JSON.stringify({ ok: true, ai: { fallback: true, reply, accountSummary } }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
