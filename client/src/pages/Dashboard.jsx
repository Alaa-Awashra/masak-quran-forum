import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useLoad } from '../lib/hooks.js';
import { Alert, Badge, BarChart, Empty, PageHeader, ProgressBar, Spinner, StatCard } from '../components/ui.jsx';
import { ACTION_LABEL, KIND_LABEL, actionTone, supervisorTypeLabel } from '../lib/labels.js';
import { fmtDate, fmtDateShort, fmtDateTime, fmtTime, fmtWeekday } from '../lib/format.js';

export default function Dashboard() {
  const { isAdmin, user, n } = useAuth();
  const navigate = useNavigate();
  const { data: d, loading, error, reload } = useLoad(() => api.get('/dashboard'), []);

  if (loading && !d) return <Spinner label="جارٍ تحميل اللوحة…" />;
  if (error && !d)
    return (
      <Alert tone="danger">
        {error} <button className="btn btn-sm btn-ghost" onClick={reload}>إعادة المحاولة</button>
      </Alert>
    );

  const chart = d.daily.map((x) => ({
    key: x.day,
    label: String(Number(x.day.slice(8))),
    full: fmtDateShort(x.day),
    a: x.completed,
    b: x.missed,
    c: x.scheduled,
  }));
  const rate = d.month.commitment_rate;

  return (
    <>
      <PageHeader
        title={`أهلًا ${user.full_name} 👋`}
        subtitle={isAdmin ? 'نظرة عامة على أداء الملتقى' : `ملخص ${n.many} ومواعيدك`}
        actions={
          !isAdmin && (
            <Link className="btn" to="/calendar">
              حجز موعد جديد
            </Link>
          )
        }
      />

      {d.appointments.pending > 0 && (
        <Alert tone="warn">
          لديك <b>{d.appointments.pending}</b> موعدًا فات وقته ولم تُسجَّل نتيجته بعد.{' '}
          <Link to="/calendar">افتح التقويم لتحديثها</Link>
        </Alert>
      )}

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label={isAdmin ? 'عدد الطلاب' : `عدد ${n.many}`} value={d.students.active} icon="users" hint={d.students.suspended ? `${d.students.suspended} مفصول` : undefined} onClick={() => navigate('/students')} />
        <StatCard label={`${n.many} تحت التحذير`} value={d.students.warning} icon="alert" tone={d.students.warning ? 'danger' : 'success'} onClick={() => navigate('/reports?tab=warnings')} />
        {isAdmin ? (
          <StatCard label="عدد المشرفين" value={d.supervisors.active} icon="award" tone="info" hint={`ذكور ${d.supervisors.male} • إناث ${d.supervisors.female} • كيدز ${d.supervisors.kids}${d.supervisors.suspended ? ` • مفصول ${d.supervisors.suspended}` : ''}`} onClick={() => navigate('/supervisors')} />
        ) : (
          <StatCard label="مواعيد اليوم" value={d.appointments.today_remaining} icon="clock" tone="info" hint={`من أصل ${d.appointments.today_total}`} onClick={() => navigate('/calendar')} />
        )}
        <StatCard label="نسبة الالتزام هذا الشهر" value={rate === null ? '—' : `${rate}%`} icon="check" tone={rate === null ? 'primary' : rate >= 75 ? 'success' : rate >= 50 ? 'warn' : 'danger'} hint={`${d.month.rec_completed} تسميع • ${d.month.missed} لم يلتزم`} />
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatCard label="صفحات هذا الشهر" value={d.month.pages} icon="book" />
        <StatCard label="امتحانات هذا الشهر" value={d.month.exams_completed} icon="award" tone="warn" hint={d.month.avg_exam_grade !== null ? `المتوسط ${d.month.avg_exam_grade}` : undefined} />
        <StatCard label="مواعيد اليوم" value={d.appointments.today_total} icon="calendar" tone="info" hint={`${d.appointments.today_remaining} متبقٍ`} />
        <StatCard label="مواعيد الأسبوع القادم" value={d.appointments.next7} icon="clock" />
      </div>

      <div className="grid grid-main" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <h2>المواعيد خلال آخر 14 يومًا</h2>
            <div className="legend">
              <span><i style={{ background: 'var(--success)' }} />تم</span>
              <span><i style={{ background: 'var(--danger)' }} />لم يلتزم</span>
              <span><i style={{ background: '#b9c4d6' }} />محجوز</span>
            </div>
          </div>
          <BarChart data={chart} />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>المواعيد القادمة</h2>
            <Link to="/calendar" className="small">عرض الكل</Link>
          </div>
          {d.upcoming.length === 0 ? (
            <Empty icon="calendar" title="لا توجد مواعيد قادمة" />
          ) : (
            <ul className="list-plain">
              {d.upcoming.map((a) => (
                <li key={a.id}>
                  <div>
                    <b>{a.student_name}</b>
                    <div className="muted small">
                      {KIND_LABEL[a.kind]}
                      {isAdmin && a.supervisor_name ? ` • ${a.supervisor_name}` : ''}
                    </div>
                  </div>
                  <div className="small nowrap" style={{ textAlign: 'left' }}>
                    {fmtWeekday(a.start_at)} {fmtDateShort(a.start_at)}
                    <div className="muted">{fmtTime(a.start_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <h2>{n.many} تحت التحذير</h2>
            <Link to="/reports?tab=warnings" className="small">التقرير الكامل</Link>
          </div>
          {d.warning_students.length === 0 ? (
            <Empty icon="check" title="لا يوجد أحد تحت التحذير 🎉" />
          ) : (
            <ul className="list-plain">
              {d.warning_students.map((s) => (
                <li key={s.id}>
                  <div>
                    <Link to={`/students/${s.id}`}><b>{s.full_name}</b></Link>
                    <div className="muted small">{s.reasons.join(' • ')}</div>
                  </div>
                  {isAdmin && s.supervisor_name && <Badge tone="muted">{s.supervisor_name}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>بانتظار تسجيل النتيجة</h2>
          </div>
          {d.pending.length === 0 ? (
            <Empty icon="check" title="كل المواعيد الفائتة مُحدَّثة" />
          ) : (
            <ul className="list-plain">
              {d.pending.map((a) => (
                <li key={a.id}>
                  <div>
                    <b>{a.student_name}</b>
                    <div className="muted small">{KIND_LABEL[a.kind]} • {fmtDate(a.start_at)} {fmtTime(a.start_at)}</div>
                  </div>
                  <Badge tone="warn">بانتظار التحديث</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="grid grid-main">
          <div className="card card-flush">
            <div className="card-head" style={{ padding: '18px 20px 0' }}>
              <h2>أداء المشرفين هذا الشهر</h2>
              <Link to="/reports?tab=supervisors" className="small">التقرير الكامل</Link>
            </div>
            {d.performance.length === 0 ? (
              <Empty icon="users" title="لم يُضف أي مشرف بعد" hint="ابدأ بإضافة مشرف من صفحة المشرفين." />
            ) : (
              <div className="table-wrap">
                <table className="tbl tbl-click">
                  <thead>
                    <tr>
                      <th>المشرف</th>
                      <th>الطلاب</th>
                      <th>تسميعات</th>
                      <th>لم يلتزم</th>
                      <th>الالتزام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.performance.map((p) => (
                      <tr key={p.id} onClick={() => navigate(`/supervisors/${p.id}`)}>
                        <td>
                          <b>{p.full_name}</b>
                          <div className="muted small">{supervisorTypeLabel(p.supervisor_type)}</div>
                        </td>
                        <td className="num">{p.students}</td>
                        <td className="num">{p.rec_completed}</td>
                        <td className="num">{p.rec_missed}</td>
                        <td style={{ minWidth: 120 }}>
                          {p.commitment_rate === null ? (
                            <span className="muted">—</span>
                          ) : (
                            <>
                              <span className="small">{p.commitment_rate}%</span>
                              <ProgressBar value={p.commitment_rate} tone={p.commitment_rate >= 75 ? 'success' : p.commitment_rate >= 50 ? 'warn' : 'danger'} />
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>آخر النشاطات</h2>
              <Link to="/activity" className="small">السجل الكامل</Link>
            </div>
            {d.recent_activity.length === 0 ? (
              <Empty icon="activity" title="لا يوجد نشاط بعد" />
            ) : (
              <ul className="timeline">
                {d.recent_activity.map((a) => (
                  <li key={a.id} className={`t-${actionTone(a.action)}`}>
                    <div className="small">
                      <b>{a.actor_name || 'النظام'}</b> {ACTION_LABEL[a.action] || a.action} {a.entity_name && <b>{a.entity_name}</b>}
                    </div>
                    <div className="muted small">{fmtDateTime(a.created_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
