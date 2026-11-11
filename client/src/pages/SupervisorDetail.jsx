import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/Toast.jsx';
import { useLoad } from '../lib/hooks.js';
import { Alert, Avatar, Badge, ConfirmDialog, CopyBox, Empty, Field, Icon, PageHeader, Spinner, StatCard } from '../components/ui.jsx';
import SupervisorForm from '../components/SupervisorForm.jsx';
import StudentForm from '../components/StudentForm.jsx';
import { CredentialsDialog } from './Supervisors.jsx';
import { ACTION_LABEL, actionTone, genderLabel, supervisorTypeLabel } from '../lib/labels.js';
import { fmtDate, fmtDateTime, fmtNum, fmtIso, age } from '../lib/format.js';

export default function SupervisorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => api.get(`/supervisors/${id}`), [id]);
  const { data: allSups } = useLoad(() => api.get('/supervisors'), []);

  const [editOpen, setEditOpen] = useState(false);
  const [addStudent, setAddStudent] = useState(false);
  const [dialog, setDialog] = useState(null); // suspend | reinstate | delete | reset
  const [reason, setReason] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [newCreds, setNewCreds] = useState(null);

  if (loading && !data) return <Spinner />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  const { supervisor: s, credentials, students, month, history } = data;
  const suspended = s.status === 'suspended';
  const others = (allSups?.supervisors || []).filter((x) => x.id !== s.id && x.status === 'active');

  const close = () => setDialog(null);

  return (
    <>
      <PageHeader
        title={
          <span className="row" style={{ gap: 14 }}>
            <Avatar name={s.full_name} size={52} />
            <span>
              {s.full_name}
              <div className="row" style={{ marginTop: 4 }}>
                <Badge tone="primary">{supervisorTypeLabel(s.supervisor_type)}</Badge>
                {suspended ? <Badge tone="danger">مفصول</Badge> : <Badge tone="success">نشط</Badge>}
              </div>
            </span>
          </span>
        }
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setEditOpen(true)} type="button"><Icon name="edit" /> تعديل</button>
            {suspended ? (
              <button className="btn btn-success" onClick={() => setDialog('reinstate')} type="button"><Icon name="undo" /> إعادة تفعيل</button>
            ) : (
              <button className="btn btn-warn" onClick={() => { setReason(''); setDialog('suspend'); }} type="button"><Icon name="pause" /> فصل</button>
            )}
            <button className="btn btn-danger" onClick={() => { setTransferTo(''); setDialog('delete'); }} type="button"><Icon name="trash" /> حذف</button>
          </>
        }
      />

      <div className="breadcrumb small muted" style={{ marginTop: -12, marginBottom: 14 }}>
        <Link to="/supervisors">← كل المشرفين</Link>
      </div>

      {suspended && (
        <Alert tone="warn">
          هذا المشرف مفصول منذ {fmtDate(s.suspended_at)}
          {s.suspension_reason ? ` — السبب: ${s.suspension_reason}` : ''}. لا يستطيع الدخول للنظام، ويمكنك إعادة تفعيله في أي وقت.
        </Alert>
      )}

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <h2><Icon name="key" size={17} /> بيانات الدخول</h2>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <CopyBox label="اسم المستخدم" value={credentials.username} />
            {credentials.password_known ? (
              <CopyBox label="كلمة المرور" value={credentials.password} secret />
            ) : (
              <Alert tone="info">غيّر المشرف كلمة مروره بنفسه، لذا لم تعد معروفة لك. يمكنك توليد كلمة جديدة.</Alert>
            )}
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => setDialog('reset')}
            >
              <Icon name="repeat" size={15} /> توليد كلمة مرور جديدة
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2>المعلومات الشخصية</h2></div>
          <dl className="kv">
            <dt>الهاتف</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{s.phone || '—'}</dd>
            <dt>البريد</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{s.email || '—'}</dd>
            <dt>تاريخ الميلاد</dt><dd>{s.birth_date ? `${fmtIso(s.birth_date)} (${age(s.birth_date)} سنة)` : '—'}</dd>
            <dt>رقم الهوية</dt><dd>{s.national_id || '—'}</dd>
            <dt>المؤهل</dt><dd>{s.qualification || '—'}</dd>
            <dt>العنوان</dt><dd>{s.address || '—'}</dd>
            <dt>الانضمام</dt><dd>{fmtDate(s.join_date)}</dd>
            {s.notes && (<><dt>ملاحظات</dt><dd>{s.notes}</dd></>)}
          </dl>
        </div>

        <div className="card">
          <div className="card-head"><h2>أداء هذا الشهر</h2></div>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <StatCard label="تسميعات" value={month.rec_completed} tone="success" />
            <StatCard label="لم يلتزم" value={month.missed} tone="danger" />
            <StatCard label="صفحات" value={fmtNum(month.pages, 1)} />
            <StatCard label="امتحانات" value={month.exams} tone="warn" />
          </div>
          {month.pending > 0 && <Alert tone="warn">{month.pending} موعد بانتظار تسجيل النتيجة</Alert>}
        </div>
      </div>

      <div className="card card-flush" style={{ marginBottom: 16 }}>
        <div className="card-head" style={{ padding: '18px 20px 0' }}>
          <h2>طلاب المشرف ({students.length})</h2>
          {!suspended && (
            <button className="btn btn-sm" onClick={() => setAddStudent(true)} type="button"><Icon name="plus" size={15} /> إضافة طالب</button>
          )}
        </div>
        {students.length === 0 ? (
          <Empty icon="users" title="لا يوجد طلاب لدى هذا المشرف" />
        ) : (
          <div className="table-wrap">
            <table className="tbl tbl-click">
              <thead>
                <tr><th>الاسم</th><th>الجنس</th><th>إجمالي الأجزاء</th><th>التزام</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                {students.map((st) => (
                  <tr key={st.id} onClick={() => navigate(`/students/${st.id}`)}>
                    <td><b>{st.full_name}</b></td>
                    <td>{genderLabel(st.gender)}</td>
                    <td className="num">{fmtNum(st.total_parts)}</td>
                    <td className="num">{st.attendance_rate === null ? '—' : `${st.attendance_rate}%`}</td>
                    <td>
                      {st.status === 'suspended' ? <Badge tone="danger">مفصول</Badge> : st.warning ? <Badge tone="warn">تحت التحذير</Badge> : <Badge tone="success">منتظم</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head"><h2>سجل المشرف</h2></div>
        {history.length === 0 ? (
          <p className="muted">لا توجد أحداث مسجلة.</p>
        ) : (
          <ul className="timeline">
            {history.map((h) => (
              <li key={h.id} className={`t-${actionTone(h.action)}`}>
                <div className="small"><b>{h.actor_name || 'النظام'}</b> {ACTION_LABEL[h.action] || h.action}{h.details?.reason ? ` — السبب: ${h.details.reason}` : ''}</div>
                <div className="muted small">{fmtDateTime(h.created_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SupervisorForm open={editOpen} supervisor={s} onClose={() => setEditOpen(false)} onSaved={reload} />
      <StudentForm open={addStudent} onClose={() => setAddStudent(false)} onSaved={reload} supervisors={[{ ...s, status: s.status }]} student={null} />
      <CredentialsDialog open={!!newCreds} creds={newCreds} onClose={() => setNewCreds(null)} title="كلمة المرور الجديدة" />

      {/* فصل */}
      <ConfirmDialog
        open={dialog === 'suspend'}
        onClose={close}
        title="فصل المشرف"
        tone="warn"
        confirmText="فصل المشرف"
        onConfirm={async () => {
          await api.post(`/supervisors/${s.id}/suspend`, { reason });
          toast.success('تم فصل المشرف وحُفظ في السجل');
          close();
          reload();
        }}
      >
        <p>سيُمنع <b>{s.full_name}</b> من الدخول فورًا. تبقى بياناته وطلابه محفوظة ويمكنك إعادته لاحقًا من سجل المفصولين.</p>
        <Field label="سبب الفصل (اختياري)">
          {(fid) => <textarea id={fid} className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} style={{ minHeight: 60 }} />}
        </Field>
      </ConfirmDialog>

      {/* إعادة تفعيل */}
      <ConfirmDialog
        open={dialog === 'reinstate'}
        onClose={close}
        title="إعادة تفعيل المشرف"
        tone="success"
        confirmText="إعادة التفعيل"
        onConfirm={async () => {
          await api.post(`/supervisors/${s.id}/reinstate`);
          toast.success('تمت إعادة تفعيل المشرف');
          close();
          reload();
        }}
      >
        سيتمكن <b>{s.full_name}</b> من الدخول مجددًا بنفس بيانات دخوله.
      </ConfirmDialog>

      {/* توليد كلمة مرور */}
      <ConfirmDialog
        open={dialog === 'reset'}
        onClose={close}
        title="توليد كلمة مرور جديدة"
        tone="warn"
        confirmText="توليد"
        onConfirm={async () => {
          const r = await api.post(`/supervisors/${s.id}/reset-password`);
          close();
          setNewCreds({ username: r.username, password: r.password });
          reload();
        }}
      >
        ستُلغى كلمة المرور الحالية للمشرف وتُستبدل بكلمة جديدة تُعرض لك مرة واحدة هنا، وتبقى متاحة في صفحته.
      </ConfirmDialog>

      {/* حذف */}
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={close}
        title="حذف المشرف نهائيًا"
        confirmText="حذف نهائي"
        requireText={s.full_name}
        onConfirm={async () => {
          const r = await api.del(`/supervisors/${s.id}`, { transfer_to: transferTo || null });
          toast.success(
            r.transferred
              ? `تم الحذف ونقل ${r.transferred} طالب`
              : r.orphaned
                ? `تم الحذف — ${r.orphaned} طالب بلا مشرف بانتظار النقل`
                : 'تم حذف المشرف'
          );
          navigate('/supervisors');
        }}
      >
        <Alert tone="danger">
          <b>تحذير: لا يمكن التراجع.</b> سيُحذف حساب <b>{s.full_name}</b> وتُلغى مواعيده القادمة. إن أردت إيقافه مؤقتًا فاستخدم «فصل» بدل الحذف.
        </Alert>
        {students.length > 0 && (
          <Field label={`نقل طلابه (${students.length}) إلى مشرف آخر`} hint="إن لم تختر مشرفًا سيصبح الطلاب بلا مشرف حتى تنقلهم لاحقًا.">
            {(fid) => (
              <select id={fid} className="select" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                <option value="">— بدون نقل (طلاب بلا مشرف) —</option>
                {others.map((o) => (
                  <option key={o.id} value={o.id}>{o.full_name} ({supervisorTypeLabel(o.supervisor_type)})</option>
                ))}
              </select>
            )}
          </Field>
        )}
      </ConfirmDialog>
    </>
  );
}
