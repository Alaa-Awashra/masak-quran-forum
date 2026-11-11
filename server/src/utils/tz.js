import { config } from '../config.js';

const partsFormatter = (tz) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

/** يعيد تاريخ ووقت الموعد بتوقيت المنتدى */
export function localParts(date, tz = config.timezone) {
  const p = Object.fromEntries(
    partsFormatter(tz)
      .formatToParts(date)
      .filter((x) => x.type !== 'literal')
      .map((x) => [x.type, x.value])
  );
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    minute: Number(p.minute),
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

export const localDateStr = (date = new Date(), tz = config.timezone) => localParts(date, tz).date;

export const hmToMinutes = (hm) => {
  const [h, m] = String(hm).split(':').map(Number);
  return h * 60 + (m || 0);
};

/** أول يوم في الشهر الحالي بتوقيت المنتدى: YYYY-MM-01 */
export const monthStart = (date = new Date()) => `${localDateStr(date).slice(0, 7)}-01`;

/** إضافة أيام لتاريخ YYYY-MM-DD */
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** تنسيق وقت قصير للرسائل (مثال: 4:30 م) */
export function fmtTimeAr(date, tz = config.timezone) {
  return new Intl.DateTimeFormat('ar-PS-u-nu-latn', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * شرط SQL لنطاق تاريخ محلي [from, to] شامل.
 * يستخدم المعاملات $i (from) و $j (to) و $k (timezone).
 */
export const rangeSql = (col, i, j, k) =>
  `${col} >= ($${i}::date)::timestamp at time zone $${k}::text and ${col} < (($${j}::date + 1)::timestamp at time zone $${k}::text)`;
