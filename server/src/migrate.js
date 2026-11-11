// تشغيل: npm run migrate  — ينفذ database/schema.sql على قاعدة البيانات
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, '../../database/schema.sql');

try {
  const sql = fs.readFileSync(file, 'utf8');
  await pool.query(sql);
  console.log('✅ تم تنفيذ schema.sql بنجاح');
} catch (err) {
  console.error('❌ فشل تنفيذ schema.sql:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
