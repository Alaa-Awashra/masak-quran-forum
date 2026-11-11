import { Router } from 'express';
import { query } from '../db.js';
import { config } from '../config.js';
import { requireAdmin } from '../middleware/auth.js';
import { badRequest, notFound, isUuid } from '../utils/errors.js';
import { localDateStr, monthStart, rangeSql } from '../utils/tz.js';
import { listStudents } from '../services/students.js';
import { getSettings } from '../services/settings.js';
import { supervisorPerformance } from '../services/performance.js';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function period(req) {
  const from = DATE_RE.test(req.query.from || '') ? req.query.from : monthStart();
  const to = DATE_RE.test(req.query.to || '') ? req.query.to : localDateStr();
  if (from > to) throw badRequest('تاريخ البداية يجب أن يسبق تاريخ النهاية');
  return { from, to };
}

/** المشرف يرى تقريره فقط، والمسؤول يحدد المشرف */
function resolveSupervisorId(req, required = false) {
  if (req.user.role === 'supervisor') return req.user.supervisor_id;
  const id = req.query.supervisor_id;
  if (id && !isUuid(id)) throw badRequest('المشرف غير صالح');
  if (required && !id) throw badRequest('اختر المشرف');
  return id || null;
}

// ---------------------------------------------------------------- التقرير الشهري للمشرف (مثل التقرير الورقي)
router.get('/monthly', async (req, res) => {
  const { from, to } = period(req);
  const supervisorId = resolveSupervisorId(req, true);

  const { rows: sups } = await query(
    `select sp.id, sp.supervisor_type, u.full_name from supervisors sp join users u on u.id = sp.user_id where sp.id = $1`,
    [supervisorId]
  );
  if (!sups[0]) throw notFound('المشرف غير موجود');

  const { rows } = await query(
    `select s.id,
            coalesce(sum(a.pages) filter (where a.kind = 'recitation' and a.status = 'completed'), 0) as pages_period,
            count(a.id) filter (where a.kind = 'recitation' and a.status = 'completed') as rec_completed,
            count(a.id) filter (where a.kind = 'recitation' and a.status = 'missed') as rec_missed,
            avg(a.grade) filter (where a.kind = 'recitation' and a.status = 'completed' and a.grade is not null) as avg_grade
     from students s
     left join appointments a on a.student_id = s.id and ${rangeSql('a.start_at', 2, 3, 4)}
     where s.supervisor_id = $1 and s.status = 'active'
     group by s.id`,
    [supervisorId, from, to, config.timezone]
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const students = await listStudents({ supervisorId });

  const out = students
    .filter((s) => s.status === 'active')
    .map((s) => {
      const p = byId.get(s.id) || { pages_period: 0, rec_completed: 0, rec_missed: 0, avg_grade: null };
      const done = p.rec_completed + p.rec_missed;
      return {
        id: s.id,
        full_name: s.full_name,
        gender: s.gender,
        pages_period: p.pages_period,
        total_parts: s.total_parts,
        attendance_rate: done ? Math.round((100 * p.rec_completed) / done) : null,
        avg_grade: p.avg_grade === null ? null : Math.round(p.avg_grade * 10) / 10,
        last_recitation_at: s.last_recitation_at,
        rec_completed: p.rec_completed,
        rec_missed: p.rec_missed,
        status: p.rec_completed === 0 ? 'not_recited' : p.rec_missed > 0 ? 'partial' : 'committed',
      };
    });

  res.json({
    supervisor: sups[0],
    period: { from, to },
    totals: {
      students: out.length,
      pages: out.reduce((n, r) => n + r.pages_period, 0),
      not_recited: out.filter((r) => r.status === 'not_recited').length,
    },
    rows: out,
  });
});

// ---------------------------------------------------------------- الطلاب تحت التحذير
router.get('/warnings', async (req, res) => {
  const supervisorId = resolveSupervisorId(req);
  const students = await listStudents({ supervisorId });
  const rows = students
    .filter((s) => s.status === 'active' && s.warning)
    .map((s) => ({
      id: s.id,
      full_name: s.full_name,
      gender: s.gender,
      supervisor_name: s.supervisor_name,
      reasons: s.warning_reasons,
      last_recitation_at: s.last_recitation_at,
      missed_30d: s.missed_30d,
      attendance_rate: s.attendance_rate,
    }));
  res.json({ rows });
});

// ---------------------------------------------------------------- أداء المشرفين (للمسؤول)
router.get('/supervisors', requireAdmin, async (req, res) => {
  const { from, to } = period(req);
  res.json({ period: { from, to }, rows: await supervisorPerformance({ from, to }) });
});

// ---------------------------------------------------------------- امتحانات السور
router.get('/exams', async (req, res) => {
  const { from, to } = period(req);
  const supervisorId = resolveSupervisorId(req);
  const settings = await getSettings();
  const params = [from, to, config.timezone];
  let extra = '';
  if (supervisorId) {
    params.push(supervisorId);
    extra = ` and a.supervisor_id = $${params.length}`;
  }
  const { rows } = await query(
    `select a.id, a.surah, a.grade, a.status, a.start_at, s.id as student_id, s.full_name as student_name,
            u.full_name as supervisor_name
     from appointments a
     join students s on s.id = a.student_id
     left join supervisors sp on sp.id = a.supervisor_id
     left join users u on u.id = sp.user_id
     where a.kind = 'exam' and a.status in ('completed', 'missed') and ${rangeSql('a.start_at', 1, 2, 3)}${extra}
     order by a.start_at desc`,
    params
  );
  const graded = rows.filter((r) => r.status === 'completed' && r.grade !== null);
  res.json({
    period: { from, to },
    pass_grade: settings.exam_pass_grade,
    summary: {
      total: rows.length,
      passed: graded.filter((r) => r.grade >= settings.exam_pass_grade).length,
      failed: graded.filter((r) => r.grade < settings.exam_pass_grade).length,
      missed: rows.filter((r) => r.status === 'missed').length,
      average: graded.length ? Math.round((graded.reduce((n, r) => n + r.grade, 0) / graded.length) * 10) / 10 : null,
    },
    rows,
  });
});

export default router;
