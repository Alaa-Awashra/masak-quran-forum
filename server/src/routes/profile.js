import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, tx } from '../db.js';
import { HttpError } from '../utils/errors.js';
import { parse, z, reqText, optText, optDate, optEmail, optPhone } from '../utils/validate.js';
import { logActivity } from '../services/activity.js';

const router = Router();

async function loadProfile(userId) {
  const { rows } = await query(
    `select u.id, u.username, u.role, u.full_name, u.phone, u.email, u.created_at,
            sp.id as supervisor_id, sp.supervisor_type, sp.birth_date, sp.address,
            sp.national_id, sp.qualification, sp.join_date
     from users u left join supervisors sp on sp.user_id = u.id
     where u.id = $1`,
    [userId]
  );
  return rows[0];
}

router.get('/', async (req, res) => {
  res.json({ profile: await loadProfile(req.user.id) });
});

const updateSchema = z.object({
  full_name: reqText('الاسم', 120),
  phone: optPhone,
  email: optEmail,
  birth_date: optDate,
  address: optText('العنوان', 300),
});

router.put('/', async (req, res) => {
  const b = parse(updateSchema, req.body);
  await tx(async (c) => {
    await c.query('update users set full_name = $1, phone = $2, email = $3 where id = $4', [
      b.full_name,
      b.phone ?? null,
      b.email ?? null,
      req.user.id,
    ]);
    if (req.user.role === 'supervisor') {
      await c.query('update supervisors set birth_date = $1, address = $2 where user_id = $3', [
        b.birth_date ?? null,
        b.address ?? null,
        req.user.id,
      ]);
    }
    await logActivity(c, req.user, 'profile.update', req.user.role, req.user.supervisor_id || req.user.id, b.full_name);
  });
  res.json({ profile: await loadProfile(req.user.id) });
});

const passwordSchema = z.object({
  current_password: z.string({ required_error: 'كلمة المرور الحالية مطلوبة' }).min(1, 'كلمة المرور الحالية مطلوبة'),
  new_password: z
    .string({ required_error: 'كلمة المرور الجديدة مطلوبة' })
    .min(8, 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف')
    .max(100, 'كلمة المرور طويلة جدًا'),
});

router.put('/password', async (req, res) => {
  const b = parse(passwordSchema, req.body);
  const { rows } = await query('select password_hash from users where id = $1', [req.user.id]);
  const ok = await bcrypt.compare(b.current_password, rows[0].password_hash);
  if (!ok) throw new HttpError(400, 'كلمة المرور الحالية غير صحيحة');
  const hash = await bcrypt.hash(b.new_password, 10);
  // password_enc = null: لم تعد كلمة المرور معروفة للمسؤول بعد أن غيّرها صاحبها
  await query('update users set password_hash = $1, password_enc = null where id = $2', [hash, req.user.id]);
  await logActivity({ query }, req.user, 'profile.password', req.user.role, req.user.supervisor_id || req.user.id, req.user.full_name);
  res.json({ ok: true });
});

export default router;
