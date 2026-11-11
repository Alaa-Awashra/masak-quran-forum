import { query } from '../db.js';
import { getSettings } from './settings.js';

const round = (n, d = 2) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);

/** يتوافق جنس الطالب مع نوع المشرف؟ (الكيدز: الجنسان) */
export const genderAllowed = (type, gender) =>
  type === 'kids' || (type === 'male' && gender === 'male') || (type === 'female' && gender === 'female');

const STATS_SQL = `
  select s.*,
         u.full_name as supervisor_name, sp.supervisor_type, sp.status as supervisor_status,
         coalesce(st.rec_completed, 0) as rec_completed,
         coalesce(st.rec_missed, 0)    as rec_missed,
         coalesce(st.rec_upcoming, 0)  as rec_upcoming,
         coalesce(st.rec_pending, 0)   as rec_pending,
         coalesce(st.pages_total, 0)   as pages_total,
         coalesce(st.pages_new, 0)     as pages_new,
         st.last_recitation_at, st.avg_grade,
         coalesce(st.exams_completed, 0) as exams_completed,
         coalesce(st.exams_missed, 0)    as exams_missed,
         st.avg_exam_grade,
         coalesce(st.missed_30d, 0)      as missed_30d,
         coalesce(w.c, 0)                as manual_warnings
  from students s
  left join supervisors sp on sp.id = s.supervisor_id
  left join users u on u.id = sp.user_id
  left join lateral (
    select
      count(*) filter (where a.kind = 'recitation' and a.status = 'completed') as rec_completed,
      count(*) filter (where a.kind = 'recitation' and a.status = 'missed') as rec_missed,
      count(*) filter (where a.kind = 'recitation' and a.status = 'scheduled' and a.end_at >= now()) as rec_upcoming,
      count(*) filter (where a.kind = 'recitation' and a.status = 'scheduled' and a.end_at < now()) as rec_pending,
      coalesce(sum(a.pages) filter (where a.kind = 'recitation' and a.status = 'completed'), 0) as pages_total,
      coalesce(sum(a.pages) filter (where a.kind = 'recitation' and a.status = 'completed' and a.recitation_type = 'new'), 0) as pages_new,
      max(a.start_at) filter (where a.kind = 'recitation' and a.status = 'completed') as last_recitation_at,
      avg(a.grade) filter (where a.kind = 'recitation' and a.status = 'completed' and a.grade is not null) as avg_grade,
      count(*) filter (where a.kind = 'exam' and a.status = 'completed') as exams_completed,
      count(*) filter (where a.kind = 'exam' and a.status = 'missed') as exams_missed,
      avg(a.grade) filter (where a.kind = 'exam' and a.status = 'completed') as avg_exam_grade,
      count(*) filter (where a.status = 'missed' and a.start_at >= now() - interval '30 days') as missed_30d
    from appointments a
    where a.student_id = s.id
  ) st on true
  left join lateral (
    select count(*) as c from student_warnings sw where sw.student_id = s.id and sw.active
  ) w on true`;

/** يحسب القيم المشتقة: الأجزاء، نسبة الالتزام، وحالة التحذير وأسبابه */
export function enrichStudent(r, settings) {
  const juz = settings.juz_pages || 20;
  const done = r.rec_completed + r.rec_missed;
  const reasons = [];

  if (r.status === 'active') {
    if (r.manual_warnings > 0) reasons.push('تحذير إداري');
    if (r.missed_30d >= settings.warning_missed_threshold) {
      reasons.push(`عدم التزام ${r.missed_30d} مرات خلال 30 يومًا`);
    }
    const ref = r.last_recitation_at ? new Date(r.last_recitation_at) : new Date(`${r.join_date}T00:00:00`);
    const days = Math.floor((Date.now() - ref.getTime()) / 86_400_000);
    if (r.supervisor_id && days >= settings.warning_inactive_days) {
      reasons.push(r.last_recitation_at ? `لم يسمّع منذ ${days} يومًا` : `لم يسمّع منذ انضمامه (${days} يومًا)`);
    }
  }

  return {
    ...r,
    avg_grade: round(r.avg_grade, 1),
    avg_exam_grade: round(r.avg_exam_grade, 1),
    total_parts: round(Number(r.initial_parts) + r.pages_new / juz, 2),
    rec_assigned: r.rec_completed + r.rec_missed + r.rec_upcoming + r.rec_pending,
    attendance_rate: done ? Math.round((100 * r.rec_completed) / done) : null,
    warning: reasons.length > 0,
    warning_reasons: reasons,
  };
}

/**
 * قائمة الطلاب مع الإحصائيات.
 * supervisorId: uuid | 'none' (بدون مشرف) | null (الكل)
 */
export async function listStudents({ supervisorId = null, studentId = null } = {}) {
  const settings = await getSettings();
  const params = [];
  const where = [];
  if (supervisorId === 'none') where.push('s.supervisor_id is null');
  else if (supervisorId) {
    params.push(supervisorId);
    where.push(`s.supervisor_id = $${params.length}`);
  }
  if (studentId) {
    params.push(studentId);
    where.push(`s.id = $${params.length}`);
  }
  const { rows } = await query(
    `${STATS_SQL} ${where.length ? `where ${where.join(' and ')}` : ''} order by s.full_name`,
    params
  );
  return rows.map((r) => enrichStudent(r, settings));
}

export async function getStudent(id) {
  const rows = await listStudents({ studentId: id });
  return rows[0] || null;
}
