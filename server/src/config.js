import dotenv from 'dotenv';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// الأولوية: server/.env ثم .env في جذر المشروع (dotenv لا يكتب فوق المتغيرات الموجودة)
dotenv.config({ path: path.resolve(here, '../.env') });
dotenv.config({ path: path.resolve(here, '../../.env') });

const env = process.env;
const isProd = env.NODE_ENV === 'production';

let jwtSecret = env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  if (isProd) throw new Error('JWT_SECRET مطلوب (32 حرفًا على الأقل) في بيئة الإنتاج');
  jwtSecret = 'dev-only-secret-please-change-this-before-production';
  console.warn('⚠️  JWT_SECRET غير مضبوط — يتم استخدام مفتاح تطوير فقط.');
}

let credSecret = env.CREDENTIALS_KEY;
if (!credSecret) {
  if (isProd) throw new Error('CREDENTIALS_KEY مطلوب في بيئة الإنتاج');
  credSecret = jwtSecret;
}

const databaseUrl = env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL غير مضبوط. انسخ .env.example إلى .env وضع رابط Supabase.');
}

let ssl = false;
if (env.DATABASE_SSL === 'false') ssl = false;
else if (isProd || /supabase|pooler/i.test(databaseUrl)) ssl = { rejectUnauthorized: false };

export const config = {
  isProd,
  port: Number(env.PORT) || 4000,
  databaseUrl,
  ssl,
  jwtSecret,
  credentialsKey: crypto.createHash('sha256').update(credSecret).digest(),
  timezone: env.APP_TIMEZONE || 'Asia/Hebron',
  clientOrigin: env.CLIENT_ORIGIN || '',
  admin: {
    username: env.ADMIN_USERNAME || 'admin',
    password: env.ADMIN_PASSWORD || '',
    fullName: env.ADMIN_NAME || 'المسؤول الإداري',
    forceReset: env.ADMIN_FORCE_RESET === 'true',
  },
};
