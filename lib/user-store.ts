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

export async function createUser(username: string, derivToken?: string) {
  const users = await readStore();
  const id = uuidv4();
  const user: any = { id, username, createdAt: new Date().toISOString() };
  if (derivToken) {
    user.encryptedToken = encryptToken(derivToken);
  }
  users.push(user);
  await writeStore(users);
  return { id, username, createdAt: user.createdAt };
}

export async function listUsers() {
  const users = await readStore();
  return users.map((u: any) => ({ id: u.id, username: u.username, createdAt: u.createdAt }));
}

export async function getUser(id: string) {
  const users = await readStore();
  return users.find((u: any) => u.id === id) || null;
}

export async function setUserToken(id: string, derivToken: string) {
  const users = await readStore();
  const idx = users.findIndex((u: any) => u.id === id);
  if (idx === -1) throw new Error('user not found');
  users[idx].encryptedToken = encryptToken(derivToken);
  await writeStore(users);
}

export async function getUserToken(id: string) {
  const user = await getUser(id);
  if (!user || !user.encryptedToken) return null;
  try {
    return decryptToken(user.encryptedToken);
  } catch (e) {
    return null;
  }
}
