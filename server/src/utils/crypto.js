import crypto from 'node:crypto';
import { config } from '../config.js';

/** تشفير AES-256-GCM — الناتج: iv.tag.cipher (base64) */
export function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', config.credentialsKey, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload) {
  if (!payload) return null;
  try {
    const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', config.credentialsKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null; // تغيّر CREDENTIALS_KEY مثلًا
  }
}

const PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePassword(length = 10) {
  let out = '';
  for (let i = 0; i < length; i++) out += PASSWORD_CHARS[crypto.randomInt(PASSWORD_CHARS.length)];
  // ضمان وجود حرف ورقم على الأقل
  if (!/[a-zA-Z]/.test(out) || !/[0-9]/.test(out)) return generatePassword(length);
  return out;
}

const PREFIX = { male: 'm', female: 'f', kids: 'k' };

/** اسم مستخدم فريد: حرف النوع + 5 أرقام (مثال m48213) */
export async function generateUsername(client, type) {
  for (let i = 0; i < 20; i++) {
    const candidate = `${PREFIX[type] || 's'}${crypto.randomInt(10000, 100000)}`;
    const { rowCount } = await client.query('select 1 from users where lower(username) = $1', [candidate]);
    if (!rowCount) return candidate;
  }
  throw new Error('تعذر توليد اسم مستخدم فريد');
}
