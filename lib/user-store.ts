import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = 'data';
const DATA_FILE = `${DATA_DIR}/users.json`;

function getKey() {
  const raw = process.env.USER_STORE_KEY;
  if (!raw) throw new Error('USER_STORE_KEY environment variable is required for encrypted user store');
  return createHash('sha256').update(raw).digest();
}

function encryptToken(token: string) {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptToken(b64: string) {
  const key = getKey();
  const b = Buffer.from(b64, 'base64');
  const iv = b.slice(0, 12);
  const tag = b.slice(12, 28);
  const enc = b.slice(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

// Supabase connection if available
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

async function readStore() {
  try {
    await ensureDataDir();
    const content = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err: any) {
    return [];
  }
}

async function writeStore(users: any[]) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2), 'utf8');
}

export async function createUser(username: string, derivToken?: string) {
  const supabase = getSupabase();
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const encryptedToken = derivToken ? encryptToken(derivToken) : null;

  if (supabase) {
    const { error } = await supabase.from('users').insert([{ id, username, encrypted_token: encryptedToken, created_at: createdAt }]);
    if (error) throw error;
    return { id, username, createdAt };
  }

  const users = await readStore();
  const user: any = { id, username, createdAt };
  if (encryptedToken) user.encryptedToken = encryptedToken;
  users.push(user);
  await writeStore(users);
  return { id, username, createdAt };
}

export async function listUsers() {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.from('users').select('id, username, created_at');
    if (error) throw error;
    return (data || []).map((u: any) => ({ id: u.id, username: u.username, createdAt: u.created_at }));
  }

  const users = await readStore();
  return users.map((u: any) => ({ id: u.id, username: u.username, createdAt: u.createdAt }));
}

export async function getUser(id: string) {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.from('users').select('id, username, created_at, encrypted_token').eq('id', id).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, username: data.username, createdAt: data.created_at, encryptedToken: data.encrypted_token ?? null };
  }

  const users = await readStore();
  return users.find((u: any) => u.id === id) || null;
}

export async function setUserToken(id: string, derivToken: string) {
  const supabase = getSupabase();
  const encrypted = encryptToken(derivToken);
  if (supabase) {
    const { error } = await supabase.from('users').upsert({ id, encrypted_token: encrypted }, { onConflict: 'id' });
    if (error) throw error;
    return;
  }

  const users = await readStore();
  const idx = users.findIndex((u: any) => u.id === id);
  if (idx === -1) throw new Error('user not found');
  users[idx].encryptedToken = encrypted;
  await writeStore(users);
}

export async function getUserToken(id: string) {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.from('users').select('encrypted_token').eq('id', id).limit(1).maybeSingle();
    if (error) throw error;
    const enc = data?.encrypted_token ?? null;
    if (!enc) return null;
    try {
      return decryptToken(enc);
    } catch (e) {
      return null;
    }
  }

  const user = await getUser(id);
  if (!user || !user.encryptedToken) return null;
  try {
    return decryptToken(user.encryptedToken);
  } catch (e) {
    return null;
  }
}
