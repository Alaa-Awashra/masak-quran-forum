import { query } from '../db.js';
import { config } from '../config.js';
import { rangeSql } from '../utils/tz.js';

/** أداء كل مشرف خلال فترة [from, to] (تواريخ محلية YYYY-MM-DD) */
export async function supervisorPerformance({ from, to, supervisorId = null }) {
  const params = [from, to, config.timezone];
  let extra = '';
  if (supervisorId) {
    params.push(supervisorId);
    extra = `where sp.id = $${params.length}`;
  }
  const { rows } = await query(
    `select sp.id, u.full_name, sp.supervisor_type, sp.status,
            (select count(*) from students s where s.supervisor_id = sp.id and s.status = 'active') as students,
            count(a.id) filter (where a.kind = 'recitation' and a.status = 'completed') as rec_completed,
            count(a.id) filter (where a.kind = 'recitation' and a.status = 'missed') as rec_missed,
            coalesce(sum(a.pages) filter (where a.kind = 'recitation' and a.status = 'completed'), 0) as pages,
            count(a.id) filter (where a.kind = 'exam' and a.status = 'completed') as exams,
            avg(a.grade) filter (where a.kind = 'exam' and a.status = 'completed') as avg_exam_grade,
            count(a.id) filter (where a.status = 'scheduled' and a.end_at < now()) as pending
     from supervisors sp
     join users u on u.id = sp.user_id
     left join appointments a on a.supervisor_id = sp.id and ${rangeSql('a.start_at', 1, 2, 3)}
     ${extra}
     group by sp.id, u.full_name
     order by u.full_name`,
    params
  );
  return rows.map((r) => {
    const done = r.rec_completed + r.rec_missed;
    return {
      ...r,
      avg_exam_grade: r.avg_exam_grade === null ? null : Math.round(r.avg_exam_grade * 10) / 10,
      commitment_rate: done ? Math.round((100 * r.rec_completed) / done) : null,
    };
  });
}
