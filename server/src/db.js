import pg from 'pg';
import { config } from './config.js';

const { Pool, types } = pg;

// numeric -> number ، bigint (count) -> number ، date -> 'YYYY-MM-DD' (بدون إزاحة توقيت)
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
types.setTypeParser(1082, (v) => v);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.ssl,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => console.error('خطأ غير متوقع في اتصال قاعدة البيانات:', err.message));

export const query = (text, params) => pool.query(text, params);

/** تنفيذ مجموعة عمليات داخل transaction واحدة */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    try {
      await client.query('rollback');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}
