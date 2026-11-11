import { Router } from 'express';
import { query, tx } from '../db.js';
import { requireSupervisor } from '../middleware/auth.js';
import { notFound, conflict, badRequest, uuidParam, isUuid } from '../utils/errors.js';
import { parse, z, optText } from '../utils/validate.js';
import { logActivity } from '../services/activity.js';
import { getSettings } from '../services/settings.js';
import { localParts, hmToMinutes, fmtTimeAr } from '../utils/tz.js';
import { config } from '../config.js';

const router = Router();
router.param('id', uuidParam);

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

const SELECT = `
  select a.*, s.full_name as student_name, s.gender as student_gender,
         sp.supervisor_type, u.full_name as supervisor_name
  from appointments a
  join students s on s.id = a.student_id
  left join supervisors sp on sp.id = a.supervisor_id
  left join users u on u.id = sp.user_id`;

async function getAppointment(id, db = { query }) {
  const { rows } = await db.query(`${SELECT} where a.id = $1`, [id]);
  return rows[0] || null;
}

/** يحمّل الموعد ويتأكد أنه يخص المشرف الحالي */
async function loadOwned(req, id) {
  const a = await getAppointment(id);
  if (!a || a.supervisor_id !== req.user.supervisor_id) throw notFound('الموعد غير موجود');
  return a;
}

// ---------------------------------------------------------------- قائمة المواعيد
router.get('/', async (req, res) => {
  const params = [];
  const where = [];
  const add = (sql, val) => {
    params.push(val);
    where.push(sql.replace('?', `$${params.length}`));
  };

  if (req.user.role === 'supervisor') add('a.supervisor_id = ?', req.user.supervisor_id);
  else if (isUuid(req.query.supervisor_id)) add('a.supervisor_id = ?', req.query.supervisor_id);

  if (isUuid(req.query.student_id)) add('a.student_id = ?', req.query.student_id);
  if (req.query.from && !Number.isNaN(Date.parse(req.query.from))) add('a.end_at > ?::timestamptz', req.query.from);
  if (req.query.to && !Number.isNaN(Date.parse(req.query.to))) add('a.start_at < ?::timestamptz', req.query.to);
  if (['recitation', 'exam'].includes(req.query.kind)) add('a.kind = ?', req.query.kind);
  if (['scheduled', 'completed', 'missed', 'cancelled'].includes(req.query.status)) add('a.status = ?', req.query.status);
  if (req.query.include_cancelled !== 'true' && !req.query.status) where.push(`a.status <> 'cancelled'`);

  const { rows } = await query(
    `${SELECT} ${where.length ? `where ${where.join(' and ')}` : ''} order by a.start_at limit 3000`,
    params
  );
  res.json({ appointments: rows });
});

router.get('/:id', async (req, res) => {
  const a = await getAppointment(req.params.id);
  if (!a) throw notFound('الموعد غير موجود');
  if (req.user.role === 'supervisor' && a.supervisor_id !== req.user.supervisor_id) throw notFound('الموعد غير موجود');
  res.json({ appointment: a });
});

// ---------------------------------------------------------------- التحقق من التوقيت
function assertWorkingHours(start, end, settings) {
  const s = localParts(start);
  const e = localParts(end);
  if (s.date !== e.date) throw badRequest('يجب أن ينتهي الموعد في نفس اليوم');
  const from = hmToMinutes(settings.work_start);
  const to = hmToMinutes(settings.work_end);
  if (s.minutes < from || e.minutes > to) {
    throw badRequest(`الموعد خارج ساعات الدوام (${settings.work_start} – ${settings.work_end})`);
  }
}

async function findConflict(db, { start, end, supervisorId, studentId, excludeId }) {
  const { rows } = await db.query(
    `select a.id, a.start_at, a.end_at, a.supervisor_id, a.student_id, s.full_name as student_name
     from appointments a join students s on s.id = a.student_id
     where a.status = 'scheduled'
       and a.id <> $5::uuid
       and tstzrange(a.start_at, a.end_at, '[)') && tstzrange($1::timestamptz, $2::timestamptz, '[)')
       and (a.supervisor_id = $3::uuid or a.student_id = $4::uuid)
     order by a.start_at limit 1`,
    [start.toISOString(), end.toISOString(), supervisorId, studentId, excludeId || NIL_UUID]
  );
  const row = rows[0];
  if (!row) return null;
  const range = `من ${fmtTimeAr(new Date(row.start_at))} إلى ${fmtTimeAr(new Date(row.end_at))}`;
  return row.student_id === studentId && row.supervisor_id !== supervisorId
    ? `لدى ${row.student_name} موعد آخر في نفس الوقت (${range})`
    : `لديك موعد آخر في نفس الوقت مع ${row.student_name} (${range})`;
}

const PAST_GRACE_MS = 2 * 60 * 1000;

// ---------------------------------------------------------------- إنشاء موعد
const createSchema = z
  .object({
    student_id: z.string({ required_error: 'اختر الطالب' }).uuid('اختر الطالب'),
    kind: z.enum(['recitation', 'exam'], { errorMap: () => ({ message: 'اختر نوع الموعد' }) }),
    recitation_type: z.enum(['new', 'review']).optional().nullable(),
    surah: optText('السورة', 100),
    portion: optText('المقطع', 200),
    start_at: z.string({ required_error: 'حدد وقت الموعد' }).refine((v) => !Number.isNaN(Date.parse(v)), 'وقت الموعد غير صالح'),
    duration_min: z.coerce.number().int('مدة غير صالحة').min(5, 'أقل مدة 5 دقائق').max(240, 'أطول مدة 4 ساعات').optional(),
    notes: optText('الملاحظات', 1000),
    // تسجيل تسميع/امتحان سابق مباشرة كمكتمل
    status: z.enum(['scheduled', 'completed']).default('scheduled'),
    pages: z.coerce.number().min(0, 'عدد الصفحات غير صالح').max(604, 'عدد الصفحات غير صالح').optional(),
    grade: z.coerce.number().min(0, 'العلامة بين 0 و 100').max(100, 'العلامة بين 0 و 100').optional(),
  })
  .strict();

function validateKindFields(kind, b) {
  if (kind === 'exam' && !b.surah) throw badRequest('اختر السورة التي سيُمتحن فيها الطالب');
}

router.post('/', requireSupervisor, async (req, res) => {
  const b = parse(createSchema, req.body);
  validateKindFields(b.kind, b);
  const settings = await getSettings();

  const { rows } = await query(
    `select id, full_name, status from students where id = $1 and supervisor_id = $2`,
    [b.student_id, req.user.supervisor_id]
  );
  const student = rows[0];
  if (!student) throw notFound('الطالب غير موجود ضمن طلابك');
  if (student.status !== 'active') throw conflict('لا يمكن حجز موعد لطالب مفصول');

  const duration = b.duration_min ?? (b.kind === 'exam' ? settings.exam_minutes : settings.recitation_minutes);
  const start = new Date(b.start_at);
  const end = new Date(start.getTime() + duration * 60_000);
  const recordPast = b.status === 'completed';

  if (recordPast) {
    if (start.getTime() > Date.now()) throw badRequest('لا يمكن تسجيل نتيجة لموعد لم يحن وقته بعد');
    if (b.kind === 'exam' && b.grade === undefined) throw badRequest('أدخل علامة الامتحان');
    if (b.kind === 'recitation' && !(b.pages > 0)) throw badRequest('أدخل عدد الصفحات المسمّعة');
  } else {
    if (start.getTime() < Date.now() - PAST_GRACE_MS) {
      throw badRequest('لا يمكن حجز موعد في وقت مضى. لتسجيل تسميع سابق استخدم خيار "تسجيل تسميع سابق".');
    }
    assertWorkingHours(start, end, settings);
  }

  const id = await tx(async (c) => {
    if (!recordPast) {
      const msg = await findConflict(c, { start, end, supervisorId: req.user.supervisor_id, studentId: student.id });
      if (msg) throw conflict(msg, 'TIME_CONFLICT');
    }
    const r = await c.query(
      `insert into appointments (student_id, supervisor_id, kind, recitation_type, surah, portion, start_at, end_at,
                                 status, pages, grade, notes, completed_at, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning id`,
      [
        student.id,
        req.user.supervisor_id,
        b.kind,
        b.kind === 'recitation' ? b.recitation_type || 'new' : null,
        b.surah ?? null,
        b.portion ?? null,
        start.toISOString(),
        end.toISOString(),
        b.status,
        b.kind === 'recitation' && recordPast ? b.pages : null,
        recordPast ? b.grade ?? null : null,
        b.notes ?? null,
        recordPast ? new Date().toISOString() : null,
        req.user.id,
      ]
    );
    await logActivity(
      c,
      req.user,
      recordPast ? 'appointment.record' : 'appointment.create',
      'appointment',
      r.rows[0].id,
      student.full_name,
      { kind: b.kind, start_at: start.toISOString() }
    );
    return r.rows[0].id;
  });
  res.status(201).json({ appointment: await getAppointment(id) });
});

// ---------------------------------------------------------------- تعديل / إعادة جدولة
const updateSchema = z
  .object({
    kind: z.enum(['recitation', 'exam']).optional(),
    recitation_type: z.enum(['new', 'review']).optional().nullable(),
    surah: optText('السورة', 100),
    portion: optText('المقطع', 200),
    start_at: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'وقت الموعد غير صالح').optional(),
    duration_min: z.coerce.number().int('مدة غير صالحة').min(5, 'أقل مدة 5 دقائق').max(240, 'أطول مدة 4 ساعات').optional(),
    notes: optText('الملاحظات', 1000),
  })
  .strict();

router.put('/:id', requireSupervisor, async (req, res) => {
  const b = parse(updateSchema, req.body);
  const a = await loadOwned(req, req.params.id);
  if (a.status !== 'scheduled') throw conflict('يمكن تعديل المواعيد المحجوزة فقط');

  const settings = await getSettings();
  const kind = b.kind ?? a.kind;
  const surah = b.surah !== undefined ? b.surah : a.surah;
  validateKindFields(kind, { surah });

  const start = b.start_at ? new Date(b.start_at) : new Date(a.start_at);
  const oldDuration = Math.round((new Date(a.end_at) - new Date(a.start_at)) / 60_000);
  const duration = b.duration_min ?? oldDuration;
  const end = new Date(start.getTime() + duration * 60_000);
  const timeChanged = start.getTime() !== new Date(a.start_at).getTime() || duration !== oldDuration;

  if (timeChanged) {
    if (start.getTime() < Date.now() - PAST_GRACE_MS) throw badRequest('لا يمكن نقل الموعد إلى وقت مضى');
    assertWorkingHours(start, end, settings);
  }

  await tx(async (c) => {
    if (timeChanged) {
      const msg = await findConflict(c, {
        start,
        end,
        supervisorId: a.supervisor_id,
        studentId: a.student_id,
        excludeId: a.id,
      });
      if (msg) throw conflict(msg, 'TIME_CONFLICT');
    }
    await c.query(
      `update appointments set kind = $1, recitation_type = $2, surah = $3, portion = $4, start_at = $5, end_at = $6,
              notes = $7, reschedule_count = reschedule_count + $8 where id = $9`,
      [
        kind,
        kind === 'recitation' ? (b.recitation_type !== undefined ? b.recitation_type : a.recitation_type) || 'new' : null,
        surah ?? null,
        (b.portion !== undefined ? b.portion : a.portion) ?? null,
        start.toISOString(),
        end.toISOString(),
        (b.notes !== undefined ? b.notes : a.notes) ?? null,
        timeChanged ? 1 : 0,
        a.id,
      ]
    );
    await logActivity(c, req.user, timeChanged ? 'appointment.reschedule' : 'appointment.update', 'appointment', a.id, a.student_name, {
      from: a.start_at,
      to: start.toISOString(),
    });
  });
  res.json({ appointment: await getAppointment(a.id) });
});

// ---------------------------------------------------------------- النتيجة: تم / لم يلتزم / إلغاء
const resultSchema = z.object({
  pages: z.coerce.number({ invalid_type_error: 'عدد الصفحات غير صالح' }).min(0, 'عدد الصفحات غير صالح').max(604, 'عدد الصفحات غير صالح').optional(),
  grade: z.coerce.number({ invalid_type_error: 'العلامة غير صالحة' }).min(0, 'العلامة بين 0 و 100').max(100, 'العلامة بين 0 و 100').optional(),
  notes: optText('الملاحظات', 1000),
});

function assertStarted(a) {
  if (new Date(a.start_at).getTime() > Date.now()) {
    throw conflict('لم يحن وقت الموعد بعد، لا يمكن تسجيل نتيجته الآن');
  }
}

router.post('/:id/complete', requireSupervisor, async (req, res) => {
  const body = { ...req.body };
  // الحقول الفارغة القادمة من النموذج
  for (const k of ['pages', 'grade']) if (body[k] === '' || body[k] === null) delete body[k];
  const b = parse(resultSchema, body);
  const a = await loadOwned(req, req.params.id);
  if (a.status === 'cancelled') throw conflict('الموعد ملغي');
  assertStarted(a);

  if (a.kind === 'exam' && b.grade === undefined) throw badRequest('أدخل علامة الامتحان');
  if (a.kind === 'recitation' && !(b.pages > 0)) throw badRequest('أدخل عدد الصفحات المسمّعة');

  await tx(async (c) => {
    await c.query(
      `update appointments set status = 'completed', pages = $1, grade = $2, notes = coalesce($3, notes),
              completed_at = coalesce(completed_at, now()) where id = $4`,
      [a.kind === 'recitation' ? b.pages : null, b.grade ?? null, b.notes ?? null, a.id]
    );
    await logActivity(c, req.user, 'appointment.complete', 'appointment', a.id, a.student_name, {
      kind: a.kind,
      pages: b.pages,
      grade: b.grade,
    });
  });
  res.json({ appointment: await getAppointment(a.id) });
});

router.post('/:id/missed', requireSupervisor, async (req, res) => {
  const b = parse(z.object({ notes: optText('الملاحظات', 1000) }), req.body);
  const a = await loadOwned(req, req.params.id);
  if (a.status === 'cancelled') throw conflict('الموعد ملغي');
  assertStarted(a);
  await tx(async (c) => {
    await c.query(
      `update appointments set status = 'missed', pages = null, grade = null, completed_at = null,
              notes = coalesce($1, notes) where id = $2`,
      [b.notes ?? null, a.id]
    );
    await logActivity(c, req.user, 'appointment.missed', 'appointment', a.id, a.student_name, { kind: a.kind });
  });
  res.json({ appointment: await getAppointment(a.id) });
});

router.post('/:id/cancel', requireSupervisor, async (req, res) => {
  const a = await loadOwned(req, req.params.id);
  if (a.status !== 'scheduled') throw conflict('يمكن إلغاء المواعيد المحجوزة فقط');
  await tx(async (c) => {
    await c.query(`update appointments set status = 'cancelled' where id = $1`, [a.id]);
    await logActivity(c, req.user, 'appointment.cancel', 'appointment', a.id, a.student_name, { kind: a.kind });
  });
  res.json({ appointment: await getAppointment(a.id) });
});

router.delete('/:id', requireSupervisor, async (req, res) => {
  const a = await loadOwned(req, req.params.id);
  await tx(async (c) => {
    await logActivity(c, req.user, 'appointment.delete', 'appointment', a.id, a.student_name, {
      kind: a.kind,
      status: a.status,
      start_at: a.start_at,
    });
    await c.query('delete from appointments where id = $1', [a.id]);
  });
  res.json({ ok: true });
});

export default router;
