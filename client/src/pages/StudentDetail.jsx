import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { useLoad } from '../lib/hooks.js';
import { Alert, Avatar, Badge, ConfirmDialog, Empty, Field, Icon, PageHeader, ProgressBar, Spinner, StatCard, Tabs } from '../components/ui.jsx';
import StudentForm from '../components/StudentForm.jsx';
import { AppointmentDetail, AppointmentForm } from '../components/Appointments.jsx';
import { ACTION_LABEL, APPT_STATUS, KIND_LABEL, RECITATION_TYPE_LABEL, actionTone, genderLabel, supervisorTypeLabel } from '../lib/labels.js';
import { age, fmtDate, fmtDateTime, fmtIso, fmtNum, fmtTime, relativeDays } from '../lib/format.js';

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin, isSupervisor, settings, n } = useAuth();
  const { data, loading, error, reload } = useLoad(() => api.get(`/students/${id}`), [id]);
  const { data: sups } = useLoad(() => (isAdmin ? api.get('/supervisors') : Promise.resolve(null)), [isAdmin]);

  const [tab, setTab] = useState('exams');
  const [edit, setEdit] = useState(false);
  const [book, setBook] = useState(null); // { kind, past }
  const [detail, setDetail] = useState(null);
  const [editAppt, setEditAppt] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [text, setText] = useState('');
  const [target, setTarget] = useState('');

  if (loading && !data) return <Spinner />;
  if (error) return <Alert tone="danger">{error} <Link to="/students">العودة للقائمة</Link></Alert>;

  const { student: s, appointments, exams, warnings, history } = data;
  const suspended = s.status === 'suspended';
  const activeWarnings = warnings.filter((w) => w.active);
  const close = () => setDialog(null);
  const recs = appointments.filter((a) => a.kind === 'recitation');
  const upcoming = appointments.filter((a) => a.status === 'scheduled').sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  const canBook = isSupervisor && !suspended;
  const apptWithName = (a) => ({ ...a, student_id: s.id, student_name: s.full_name, supervisor_name: s.supervisor_name });

  const commitTone = s.attendance_rate === null ? 'primary' : s.attendance_rate >= 75 ? 'success' : s.attendance_rate >= 50 ? 'warn' : 'danger';

  return (
    <>
      <PageHeader
        title={
          <span className="row" style={{ gap: 14 }}>
            <Avatar name={s.full_name} size={52} />
            <span>
              {s.full_name}
              <span className="row" style={{ marginTop: 4, display: 'flex' }}>
                <Badge tone="muted">{genderLabel(s.gender)}</Badge>
                {suspended ? <Badge tone="danger">مفصول</Badge> : s.warning ? <Badge tone="warn">تحت التحذير</Badge> : <Badge tone="success">منتظم</Badge>}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            {canBook && (
              <>
                <button className="btn" onClick={() => setBook({ kind: 'recitation' })} type="button"><Icon name="book" /> حجز تسميع</button>
                <button className="btn btn-secondary" onClick={() => setBook({ kind: 'exam' })} type="button"><Icon name="award" /> حجز امتحان سورة</button>
                <button className="btn btn-ghost" onClick={() => setBook({ kind: 'recitation', past: true })} type="button"><Icon name="clock" /> تسجيل تسميع سابق</button>
              </>
            )}
            <button className="btn btn-ghost" onClick={() => setEdit(true)} type="button"><Icon name="edit" /> تعديل</button>
          </>
        }
      />

      <div className="small muted" style={{ marginTop: -12, marginBottom: 14 }}>
        <Link to="/students">← {isAdmin ? 'كل الطلاب' : n.many}</Link>
      </div>

      {suspended && (
        <Alert tone="warn">
          {n.the} مفصول منذ {fmtDate(s.suspended_at)}{s.suspension_reason ? ` — السبب: ${s.suspension_reason}` : ''}. لا يمكن حجز مواعيد له حتى تعيد تفعيله.
        </Alert>
      )}
      {s.warning && !suspended && (
        <Alert tone="danger"><b>أسباب التحذير:</b> {s.warning_reasons.join(' • ')}</Alert>
      )}
      {isAdmin && !s.supervisor_id && <Alert tone="warn">هذا الطالب بلا مشرف حاليًا. انقله إلى مشرف من زر «نقل».</Alert>}

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="إجمالي المحفوظ (أجزاء)" value={fmtNum(s.total_parts)} icon="book" hint={`عند الانضمام ${fmtNum(s.initial_parts)}`} />
        <StatCard label="تسميعات محددة" value={s.rec_assigned} icon="calendar" tone="info" hint={`${s.rec_upcoming} قادم${s.rec_pending ? ` • ${s.rec_pending} بانتظار التحديث` : ''}`} />
        <StatCard label="التزم فيها" value={s.rec_completed} icon="check" tone="success" hint={`${fmtNum(s.pages_total, 1)} صفحة`} />
        <StatCard label="لم يلتزم فيها" value={s.rec_missed} icon="x" tone={s.rec_missed ? 'danger' : 'primary'} hint={s.attendance_rate !== null ? `نسبة الالتزام ${s.attendance_rate}%` : undefined} />
      </div>

      <div className="grid grid-main" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <h2>الالتزام بالتسميع</h2>
            <span className="muted small">آخر تسميع: {s.last_recitation_at ? `${fmtIso(s.last_recitation_at)} (${relativeDays(s.last_recitation_at)})` : 'لم يسمّع بعد'}</span>
          </div>
          <ProgressBar value={s.attendance_rate ?? 0} tone={commitTone} />
          <p className="muted small" style={{ marginTop: 6 }}>
            {s.attendance_rate === null ? 'لا توجد تسميعات مسجّلة بعد.' : `التزم في ${s.rec_completed} من ${s.rec_completed + s.rec_missed} تسميعًا محسومًا.`}
            {s.avg_grade !== null && ` متوسط التقييم: ${s.avg_grade}.`}
          </p>
          <h3 style={{ margin: '18px 0 8px' }}>المواعيد القادمة</h3>
          {upcoming.length === 0 ? (
            <p className="muted small">لا توجد مواعيد محجوزة.</p>
          ) : (
            <ul className="list-plain">
              {upcoming.slice(0, 5).map((a) => (
                <li key={a.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(apptWithName(a))}>
                  <span>{KIND_LABEL[a.kind]}{a.surah ? ` — ${a.surah}` : ''}</span>
                  <span className="small muted">{fmtDate(a.start_at)} • {fmtTime(a.start_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2>البيانات</h2></div>
          <dl className="kv">
            <dt>{n.supervisor}</dt>
            <dd>
              {s.supervisor_name ? (
                <>
                  {isAdmin && s.supervisor_id ? <Link to={`/supervisors/${s.supervisor_id}`}>{s.supervisor_name}</Link> : s.supervisor_name}
                  <div className="muted small">{supervisorTypeLabel(s.supervisor_type)}</div>
                </>
              ) : '—'}
            </dd>
            <dt>تاريخ الميلاد</dt><dd>{s.birth_date ? `${fmtIso(s.birth_date)} (${age(s.birth_date)} سنة)` : '—'}</dd>
            <dt>الهاتف</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{s.phone || '—'}</dd>
            <dt>ولي الأمر</dt><dd>{s.guardian_name || '—'}{s.guardian_phone && <div dir="ltr" style={{ textAlign: 'right' }} className="muted small">{s.guardian_phone}</div>}</dd>
            <dt>العنوان</dt><dd>{s.address || '—'}</dd>
            <dt>الانضمام</dt><dd>{fmtDate(s.join_date)}</dd>
            {s.notes && (<><dt>ملاحظات</dt><dd>{s.notes}</dd></>)}
          </dl>
          <div className="row" style={{ marginTop: 16 }}>
            {isAdmin && <button className="btn btn-sm btn-ghost" onClick={() => { setTarget(''); setDialog('transfer'); }} type="button"><Icon name="swap" size={15} /> نقل</button>}
            <button className="btn btn-sm btn-ghost" onClick={() => { setText(''); setDialog('warning'); }} type="button"><Icon name="alert" size={15} /> تحذير</button>
            {suspended ? (
              <button className="btn btn-sm btn-success" onClick={() => setDialog('reinstate')} type="button"><Icon name="undo" size={15} /> إعادة تفعيل</button>
            ) : (
              <button className="btn btn-sm btn-warn" onClick={() => { setText(''); setDialog('suspend'); }} type="button"><Icon name="pause" size={15} /> فصل</button>
            )}
            <button className="btn btn-sm btn-danger" onClick={() => setDialog('delete')} type="button"><Icon name="trash" size={15} /> حذف</button>
          </div>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'exams', label: 'امتحانات السور', count: exams.length },
          { value: 'recitations', label: 'سجل التسميع', count: recs.length },
          { value: 'warnings', label: 'التحذيرات', count: activeWarnings.length },
          { value: 'history', label: 'السجل' },
        ]}
      />

      {tab === 'exams' && (
        <div className="card card-flush">
          {exams.length === 0 ? (
            <Empty icon="award" title="لا توجد امتحانات سور مسجلة" hint={canBook ? 'احجز امتحانًا من الزر أعلاه.' : undefined} />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>السورة</th><th>العلامة</th><th>النتيجة</th><th>تاريخ الامتحان</th></tr></thead>
                <tbody>
                  {exams.map((e) => {
                    const ok = e.grade !== null && e.grade >= settings.exam_pass_grade;
                    return (
                      <tr key={e.id}>
                        <td><b>{e.surah || '—'}</b></td>
                        <td className="num">{e.status === 'completed' ? `${fmtNum(e.grade, 1)} / 100` : '—'}</td>
                        <td>{e.status === 'missed' ? <Badge tone="danger">لم يحضر</Badge> : <Badge tone={ok ? 'success' : 'danger'}>{ok ? 'ناجح' : 'راسب'}</Badge>}</td>
                        <td className="num">{fmtIso(e.start_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'recitations' && (
        <div className="card card-flush">
          {recs.length === 0 ? (
            <Empty icon="book" title="لا يوجد سجل تسميع" />
          ) : (
            <div className="table-wrap">
              <table className="tbl tbl-click">
                <thead><tr><th>التاريخ</th><th>النوع</th><th>السورة / المقطع</th><th>الصفحات</th><th>التقييم</th><th>الحالة</th></tr></thead>
                <tbody>
                  {recs.map((a) => (
                    <tr key={a.id} onClick={() => setDetail(apptWithName(a))}>
                      <td className="num">{fmtIso(a.start_at)} <span className="muted small">{fmtTime(a.start_at)}</span></td>
                      <td>{RECITATION_TYPE_LABEL[a.recitation_type] || '—'}</td>
                      <td>{[a.surah, a.portion].filter(Boolean).join(' — ') || '—'}</td>
                      <td className="num">{a.pages ?? '—'}</td>
                      <td className="num">{a.grade ?? '—'}</td>
                      <td><Badge tone={APPT_STATUS[a.status].tone}>{APPT_STATUS[a.status].label}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'warnings' && (
        <div className="card">
          {warnings.length === 0 ? (
            <Empty icon="check" title="لا توجد تحذيرات" />
          ) : (
            <ul className="list-plain">
              {warnings.map((w) => (
                <li key={w.id}>
                  <div>
                    <b>{w.reason}</b>
                    <div className="muted small">{fmtDateTime(w.created_at)}{w.created_by_name ? ` • ${w.created_by_name}` : ''}</div>
                  </div>
                  {w.active ? (
                    <button className="btn btn-sm btn-ghost" type="button" onClick={async () => { try { await api.post(`/students/${s.id}/warnings/${w.id}/resolve`); toast.success('تم إغلاق التحذير'); reload(); } catch (e) { toast.error(e.message); } }}>إغلاق التحذير</button>
                  ) : (
                    <Badge tone="muted">مغلق</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          {history.length === 0 ? (
            <p className="muted">لا توجد أحداث.</p>
          ) : (
            <ul className="timeline">
              {history.map((h) => (
                <li key={h.id} className={`t-${actionTone(h.action)}`}>
                  <div className="small"><b>{h.actor_name || 'النظام'}</b> {ACTION_LABEL[h.action] || h.action}{h.details?.reason ? ` — ${h.details.reason}` : ''}</div>
                  <div className="muted small">{fmtDateTime(h.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <StudentForm open={edit} student={s} onClose={() => setEdit(false)} onSaved={reload} supervisors={sups?.supervisors || []} />

      <AppointmentForm
        open={!!book || !!editAppt}
        onClose={() => { setBook(null); setEditAppt(null); }}
        onSaved={reload}
        students={[s]}
        appointment={editAppt}
        initial={book ? { student_id: s.id, kind: book.kind, past: book.past } : {}}
      />
      <AppointmentDetail
        appointment={detail}
        canManage={isSupervisor}
        onClose={() => setDetail(null)}
        onChanged={reload}
        onEdit={(a) => { setDetail(null); setEditAppt(a); }}
      />

      <ConfirmDialog open={dialog === 'suspend'} onClose={close} tone="warn" title={`فصل ${n.the}`} confirmText="فصل"
        onConfirm={async () => { await api.post(`/students/${s.id}/suspend`, { reason: text }); toast.success('تم الفصل وحُفظ في السجل'); close(); reload(); }}>
        <p>سيُفصل <b>{s.full_name}</b> وتُلغى مواعيده القادمة. يمكنك إعادة تفعيله لاحقًا.</p>
        <Field label="السبب (اختياري)">{(fid) => <textarea id={fid} className="textarea" style={{ minHeight: 60 }} value={text} onChange={(e) => setText(e.target.value)} />}</Field>
      </ConfirmDialog>

      <ConfirmDialog open={dialog === 'reinstate'} onClose={close} tone="success" title={`إعادة تفعيل ${n.the}`} confirmText="إعادة التفعيل"
        onConfirm={async () => { await api.post(`/students/${s.id}/reinstate`); toast.success('تمت إعادة التفعيل'); close(); reload(); }}>
        سيعود <b>{s.full_name}</b> ضمن {n.many} النشطين.
      </ConfirmDialog>

      <ConfirmDialog open={dialog === 'delete'} onClose={close} title={`حذف ${n.the} نهائيًا`} confirmText="حذف نهائي" requireText={s.full_name}
        onConfirm={async () => { await api.del(`/students/${s.id}`); toast.success('تم الحذف'); navigate('/students'); }}>
        <Alert tone="danger"><b>تحذير: لا يمكن التراجع.</b> ستُحذف كل بيانات <b>{s.full_name}</b> بما فيها التسميعات والامتحانات والعلامات. إن أردت إيقافه مؤقتًا فاستخدم «فصل».</Alert>
      </ConfirmDialog>

      <ConfirmDialog open={dialog === 'warning'} onClose={close} tone="warn" title="إضافة تحذير" confirmText="إضافة التحذير" disabled={!text.trim()}
        onConfirm={async () => { await api.post(`/students/${s.id}/warnings`, { reason: text }); toast.success('تمت إضافة التحذير'); close(); reload(); }}>
        <Field label="سبب التحذير" required>{(fid) => <textarea id={fid} className="textarea" style={{ minHeight: 70 }} value={text} onChange={(e) => setText(e.target.value)} />}</Field>
      </ConfirmDialog>

      <ConfirmDialog open={dialog === 'transfer'} onClose={close} tone="primary" title={`نقل ${n.the} إلى مشرف آخر`} confirmText="نقل" disabled={!target}
        onConfirm={async () => { const r = await api.post(`/students/${s.id}/transfer`, { supervisor_id: target }); toast.success(r.cancelled_appointments ? `تم النقل وإلغاء ${r.cancelled_appointments} موعد قادم` : 'تم النقل'); close(); reload(); }}>
        <p>ستُلغى مواعيده القادمة مع المشرف الحالي. يجب أن يتوافق جنس الطالب مع نوع المشرف.</p>
        <Field label="المشرف الجديد" required>
          {(fid) => (
            <select id={fid} className="select" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">— اختر —</option>
              {(sups?.supervisors || []).filter((x) => x.status === 'active' && x.id !== s.supervisor_id).map((x) => (
                <option key={x.id} value={x.id}>{x.full_name} ({supervisorTypeLabel(x.supervisor_type)})</option>
              ))}
            </select>
          )}
        </Field>
      </ConfirmDialog>
    </>
  );
}
