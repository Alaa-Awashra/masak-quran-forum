// أرقام لاتينية (0-9) مع أسماء الأشهر الفلسطينية، مثل التقارير الورقية
const LOCALE = 'ar-PS-u-nu-latn';

const safe = (fn) => {
  try {
    return fn();
  } catch {
    return '';
  }
};

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
const dateShortFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true });
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });

const toDate = (v) => (v instanceof Date ? v : new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v));

export const fmtDate = (v) => (v ? safe(() => dateFmt.format(toDate(v))) : '—');
export const fmtDateShort = (v) => (v ? safe(() => dateShortFmt.format(toDate(v))) : '—');
export const fmtTime = (v) => (v ? safe(() => timeFmt.format(toDate(v))) : '—');
export const fmtWeekday = (v) => (v ? safe(() => weekdayFmt.format(toDate(v))) : '');
export const fmtMonth = (v) => (v ? safe(() => monthFmt.format(toDate(v))) : '');
export const fmtDateTime = (v) => (v ? `${fmtDate(v)} • ${fmtTime(v)}` : '—');
/** التاريخ بصيغة ISO مثل التقارير: 2026-10-07 */
export const fmtIso = (v) => (v ? localISODate(toDate(v)) : '—');

export function fmtNum(n, digits = 2) {
  if (n === null || n === undefined || n === '') return '—';
  return String(parseFloat(Number(n).toFixed(digits)));
}

export const pad = (n) => String(n).padStart(2, '0');

/** YYYY-MM-DD بتوقيت المتصفح */
export const localISODate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localHM = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return localISODate(d);
}

export const monthStartISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;

export function lastMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: localISODate(first), to: localISODate(last) };
}

/** من تاريخ + وقت محليين إلى ISO UTC */
export const toISO = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr}:00`).toISOString();

export function age(birthDate) {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T00:00:00`);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a -= 1;
  return a;
}

/** توحيد النص العربي للبحث (أ/إ/آ → ا ، ى → ي ، ة → ه ، إزالة التشكيل) */
export function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

export function relativeDays(v) {
  if (!v) return null;
  const days = Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000);
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  return `منذ ${days} يومًا`;
}
