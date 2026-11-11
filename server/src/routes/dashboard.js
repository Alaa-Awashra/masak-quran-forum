import { Router } from 'express';
import { query } from '../db.js';
import { config } from '../config.js';
import { listStudents } from '../services/students.js';
import { localDateStr, monthStart, rangeSql } from '../utils/tz.js';
import { supervisorPerformance } from '../services/performance.js';

const router = Router();

router.get('/', async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const supId = isAdmin ? null : req.user.supervisor_id;
  const tz = config.timezone;
  const today = localDateStr();
  const from = monthStart();

  const students = await listStudents({ supervisorId: supId });
  const active = students.filter((s) => s.status === 'active');
  const warned = active.filter((s) => s.warning);

  const scope = (alias, params) => {
    if (!supId) return '';
    params.push(supId);
    return ` and ${alias}.supervisor_id = $${params.length}`;
  };

  // إحصائيات الشهر
  const mp = [from, today, tz];
  const monthScope = scope('a', mp);
  const { rows: monthRows } = await query(
    `select
       count(*) filter (where kind = 'recitation' and status = 'completed') as rec_completed,
       count(*) filter (where status = 'missed') as missed,
       count(*) filter (where kind = 'exam' and status = 'completed') as exams_completed,
       avg(grade) filter (where kind = 'exam' and status = 'completed') as avg_exam_grade,
       coalesce(sum(pages) filter (where kind = 'recitation' and status = 'completed'), 0) as pages
     from appointments a where ${rangeSql('a.start_at', 1, 2, 3)}${monthScope}`,
    mp
  );
  const m = monthRows[0];
  const monthDone = m.rec_completed + m.missed;

  // اليوم / القادم / بانتظار التحديث
  const ap = [today, tz];
  const apScope = scope('a', ap);
  const { rows: apRows } = await query(
    `select
       count(*) filter (where status <> 'cancelled' and (a.start_at at time zone $2)::date = $1::date) as today_total,
       count(*) filter (where status = 'scheduled' and end_at >= now() and (a.start_at at time zone $2)::date = $1::date) as today_remaining,
       count(*) filter (where status = 'scheduled' and end_at >= now() and start_at < now() + interval '7 days') as next7,
       count(*) filter (where status = 'scheduled' and end_at < now()) as pending
     from appointments a where true${apScope}`,
    ap
  );

  // مخطط آخر 14 يومًا
  const dp = [today, tz];
  const dScope = scope('a', dp);
  const { rows: daily } = await query(
    `select to_char(d::date, 'YYYY-MM-DD') as day,
            count(a.id) filter (where a.status = 'completed') as completed,
            count(a.id) filter (where a.status = 'missed') as missed,
            count(a.id) filter (where a.status = 'scheduled') as scheduled
     from generate_series($1::date - 13, $1::date, interval '1 day') d
     left join appointments a
       on (a.start_at at time zone $2)::date = d::date
      and a.start_at >= (($1::date - 14)::timestamp at time zone $2::text)
      and a.start_at < (($1::date + 1)::timestamp at time zone $2::text)
      and a.status <> 'cancelled'${dScope}
     group by d order by d`,
    dp
  );

  // المواعيد القادمة
  const up = [];
  const upScope = scope('a', up);
  const { rows: upcoming } = await query(
    `select a.id, a.kind, a.start_at, a.end_at, s.full_name as student_name, u.full_name as supervisor_name
     from appointments a
     join students s on s.id = a.student_id
     left join supervisors sp on sp.id = a.supervisor_id
     left join users u on u.id = sp.user_id
     where a.status = 'scheduled' and a.end_at >= now()${upScope}
     order by a.start_at limit 8`,
    up
  );

  // مواعيد فائتة بانتظار تحديث النتيجة
  const pp = [];
  const ppScope = scope('a', pp);
  const { rows: pending } = await query(
    `select a.id, a.kind, a.start_at, s.full_name as student_name
     from appointments a join students s on s.id = a.student_id
     where a.status = 'scheduled' and a.end_at < now()${ppScope}
     order by a.start_at desc limit 8`,
    pp
  );

  const base = {
    role: req.user.role,
    students: {
      total: students.length,
      active: active.length,
      suspended: students.length - active.length,
      warning: warned.length,
      unassigned: students.filter((s) => !s.supervisor_id).length,
      male: active.filter((s) => s.gender === 'male').length,
      female: active.filter((s) => s.gender === 'female').length,
    },
    appointments: apRows[0],
    month: {
      from,
      to: today,
      ...m,
      commitment_rate: monthDone ? Math.round((100 * m.rec_completed) / monthDone) : null,
      avg_exam_grade: m.avg_exam_grade === null ? null : Math.round(m.avg_exam_grade * 10) / 10,
    },
    daily,
    upcoming,
    pending,
    warning_students: warned
      .slice()
      .sort((a, b) => b.warning_reasons.length - a.warning_reasons.length)
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        full_name: s.full_name,
        gender: s.gender,
        supervisor_name: s.supervisor_name,
        reasons: s.warning_reasons,
      })),
  };

  if (!isAdmin) return res.json(base);

  const { rows: sc } = await query(
    `select count(*) filter (where status = 'active') as active,
            count(*) filter (where status = 'suspended') as suspended,
            count(*) filter (where status = 'active' and supervisor_type = 'male') as male,
            count(*) filter (where status = 'active' and supervisor_type = 'female') as female,
            count(*) filter (where status = 'active' and supervisor_type = 'kids') as kids
     from supervisors`
  );
  const { rows: recent } = await query(
    `select id, actor_name, action, entity_type, entity_name, details, created_at
     from activity_log order by id desc limit 8`
  );
  const performance = await supervisorPerformance({ from, to: today });

  res.json({
    ...base,
    supervisors: sc[0],
    recent_activity: recent,
    performance: performance.filter((p) => p.status === 'active'),
  });
});

export default router;
