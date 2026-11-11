import { query } from '../db.js';

export const DEFAULT_SETTINGS = {
  warning_missed_threshold: 2,
  warning_inactive_days: 14,
  exam_pass_grade: 60,
  work_start: '06:00',
  work_end: '22:00',
  recitation_minutes: 30,
  exam_minutes: 45,
  juz_pages: 20,
};

let cache = null;
let cachedAt = 0;

export async function getSettings() {
  if (cache && Date.now() - cachedAt < 10_000) return cache;
  const { rows } = await query('select key, value from settings');
  cache = { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  cachedAt = Date.now();
  return cache;
}

export const invalidateSettings = () => {
  cache = null;
};
