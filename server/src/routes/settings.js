import { Router } from 'express';
import { tx } from '../db.js';
import { config } from '../config.js';
import { requireAdmin } from '../middleware/auth.js';
import { getSettings, invalidateSettings } from '../services/settings.js';
import { logActivity } from '../services/activity.js';
import { parse, z } from '../utils/validate.js';

const router = Router();

router.get('/', async (req, res) => {
  const s = await getSettings();
  res.json({ settings: s, timezone: config.timezone });
});

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'صيغة الوقت غير صحيحة (HH:MM)');

const schema = z
  .object({
    warning_missed_threshold: z.coerce.number().int('يجب أن يكون عددًا صحيحًا').min(1, 'الحد الأدنى 1').max(30),
    warning_inactive_days: z.coerce.number().int('يجب أن يكون عددًا صحيحًا').min(1, 'الحد الأدنى 1').max(365),
    exam_pass_grade: z.coerce.number().min(0, 'العلامة بين 0 و 100').max(100, 'العلامة بين 0 و 100'),
    work_start: hm,
    work_end: hm,
    recitation_minutes: z.coerce.number().int().min(5, 'الحد الأدنى 5 دقائق').max(240),
    exam_minutes: z.coerce.number().int().min(5, 'الحد الأدنى 5 دقائق').max(240),
    juz_pages: z.coerce.number().int().min(1).max(100),
  })
  .refine((v) => v.work_start < v.work_end, { message: 'وقت بداية الدوام يجب أن يسبق وقت نهايته' });

router.put('/', requireAdmin, async (req, res) => {
  const b = parse(schema, req.body);
  await tx(async (c) => {
    for (const [key, value] of Object.entries(b)) {
      await c.query(
        `insert into settings (key, value, updated_at) values ($1, $2::jsonb, now())
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [key, JSON.stringify(value)]
      );
    }
    await logActivity(c, req.user, 'settings.update', 'settings', null, 'الإعدادات');
  });
  invalidateSettings();
  res.json({ settings: await getSettings() });
});

export default router;
