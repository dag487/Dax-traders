import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  // Note: we don't throw at module import time because some tooling may import this file
}

export function sign(payload: object, opts: jwt.SignOptions = {}) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
  return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d', ...opts });
}

export function verify(token: string) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
  try {
    return jwt.verify(token, process.env.JWT_SECRET) as any;
  } catch (err) {
    return null;
  }
}
