import { useEffect, useMemo, useState } from 'react';
import { api, qs } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { Alert, Badge, ConfirmDialog, Field, Modal } from './ui.jsx';
import { SURAHS } from '../lib/surahs.js';
import { APPT_STATUS, KIND_LABEL, RECITATION_TYPE_LABEL } from '../lib/labels.js';
import { fmtDate, fmtTime, fmtWeekday, localHM, localISODate, toISO } from '../lib/format.js';

const durationOf = (a) => Math.round((new Date(a.end_at) - new Date(a.start_at)) / 60000);

export function apptTitle(a) {
  return `${a.student_name} — ${KIND_LABEL[a.kind]}${a.kind === 'exam' && a.surah ? ` (${a.surah})` : ''}`;
}

// =====================================================================
// نموذج الحجز / التعديل / إعادة الجدولة / تسجيل تسميع سابق
//   appointment: موعد موجود للتعديل
//   initial: { student_id, kind, date, time } قيم أولية للحجز الجديد
// =====================================================================
export function AppointmentForm({ open, onClose, onSaved, students = [], appointment, initial = {}, allowPast = true }) {
  const { settings, n } = useAuth();
  const toast = useToast();
  const editing = !!appointment;

  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dayAppts, setDayAppts] = useState([]);

  const activeStudents = useMemo(() => students.filter((s) => s.status === 'active'), [students]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setBusy(false);
    if (appointment) {
      const s = new Date(appointment.start_at);
      setF({
        student_id: appointment.student_id,
        kind: appointment.kind,
        recitation_type: appointment.recitation_type || 'new',
        surah: appointment.surah || '',
        portion: appointment.portion || '',
        date: localISODate(s),
        time: localHM(s),
        duration: String(durationOf(appointment)),
        notes: appointment.notes || '',
        past: false,
        pages: '',
        grade: '',
      });
    } else {
      const kind = initial.kind || 'recitation';
      setF({
        student_id: initial.student_id || '',
        kind,
        recitation_type: 'new',
        surah: '',
        portion: '',
        date: initial.date || localISODate(),
        time: initial.time || '16:00',
        duration: String(kind === 'exam' ? settings.exam_minutes : settings.recitation_minutes),
        notes: '',
        past: !!initial.past,
        pages: '',
        grade: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const setKind = (kind) =>
    setF((x) => ({ ...x, kind, duration: String(kind === 'exam' ? settings.exam_minutes : settings.recitation_minutes) }));

  // مواعيد اليوم المختار — لتجنب التعارض بصريًا قبل الإرسال
  useEffect(() => {
    if (!open || !f.date) return undefined;
    let alive = true;
    const from = new Date(`${f.date}T00:00:00`).toISOString();
    const to = new Date(`${f.date}T23:59:59`).toISOString();
    api
      .get(`/appointments${qs({ from, to })}`)
      .then((d) => alive && setDayAppts(d.appointments.filter((a) => a.status === 'scheduled' && a.id !== appointment?.id)))
      .catch(() => alive && setDayAppts([]));
    return () => {
      alive = false;
    };
  }, [open, f.date, appointment?.id]);

  const start = f.date && f.time ? new Date(`${f.date}T${f.time}:00`) : null;
  const dur = Number(f.duration) || 0;
  const end = start && dur ? new Date(start.getTime() + dur * 60000) : null;
  const overlapIds = new Set(
    start && end ? dayAppts.filter((a) => new Date(a.start_at) < end && new Date(a.end_at) > start).map((a) => a.id) : []
  );
  const studentBusy = dayAppts.some((a) => overlapIds.has(a.id) && a.student_id === f.student_id);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.student_id) return setError(`اختر ${n.the}`);
    if (f.kind === 'exam' && !f.surah) return setError('اختر السورة التي سيُمتحن فيها');
    if (!start) return setError('حدد التاريخ والوقت');
    setBusy(true);
    try {
      let res;
      if (editing) {
        res = await api.put(`/appointments/${appointment.id}`, {
          kind: f.kind,
          recitation_type: f.kind === 'recitation' ? f.recitation_type : null,
          surah: f.surah,
          portion: f.portion,
          start_at: start.toISOString(),
          duration_min: dur,
          notes: f.notes,
        });
        toast.success('تم تعديل الموعد');
      } else {
        const body = {
          student_id: f.student_id,
          kind: f.kind,
          surah: f.surah,
          portion: f.portion,
          start_at: toISO(f.date, f.time),
          duration_min: dur,
          notes: f.notes,
          ...(f.kind === 'recitation' ? { recitation_type: f.recitation_type } : {}),
        };
        if (f.past) {
          body.status = 'completed';
          if (f.kind === 'recitation') body.pages = f.pages;
          if (f.grade !== '') body.grade = f.grade;
          if (f.kind === 'recitation' && f.pages === '') throw new Error('أدخل عدد الصفحات المسمّعة');
          if (f.kind === 'exam' && f.grade === '') throw new Error('أدخل علامة الامتحان');
        }
        res = await api.post('/appointments', body);
        toast.success(f.past ? 'تم تسجيل الموعد السابق' : 'تم حجز الموعد');
      }
      onSaved?.(res.appointment);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const title = editing ? 'تعديل / إعادة جدولة الموعد' : f.past ? 'تسجيل موعد سابق' : 'حجز موعد جديد';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      persistent={busy}
      footer={
        <>
          <button className="btn" form="appt-form" disabled={busy} type="submit">
            {busy ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديل' : f.past ? 'تسجيل' : 'حجز الموعد'}
          </button>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy} type="button">
            إلغاء
          </button>
        </>
      }
    >
      <form id="appt-form" onSubmit={submit}>
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label={n.the} required>
          {(id) => (
            <select id={id} className="select" value={f.student_id || ''} onChange={set('student_id')} disabled={editing} required>
              <option value="">— اختر —</option>
              {(editing ? students : activeStudents).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="field">
          <span className="field-label">نوع الموعد</span>
          <div className="seg-control" style={{ alignSelf: 'flex-start' }}>
            {Object.entries(KIND_LABEL).map(([k, label]) => (
              <button key={k} type="button" className={f.kind === k ? 'active' : ''} onClick={() => setKind(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          {f.kind === 'recitation' && (
            <Field label="نوع التسميع">
              {(id) => (
                <select id={id} className="select" value={f.recitation_type} onChange={set('recitation_type')}>
                  {Object.entries(RECITATION_TYPE_LABEL).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="السورة" required={f.kind === 'exam'}>
            {(id) => (
              <select id={id} className="select" value={f.surah} onChange={set('surah')}>
                <option value="">{f.kind === 'exam' ? '— اختر السورة —' : '— غير محددة —'}</option>
                {SURAHS.map((s, i) => (
                  <option key={s} value={s}>
                    {i + 1}. {s}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="المقطع / الصفحات (اختياري)" className={f.kind === 'exam' ? '' : ''}>
            {(id) => <input id={id} className="input" value={f.portion} onChange={set('portion')} maxLength={200} placeholder="مثال: من الآية 1 إلى 20" />}
          </Field>

          <Field label="التاريخ" required>
            {(id) => (
              <input
                id={id}
                className="input"
                type="date"
                value={f.date || ''}
                onChange={set('date')}
                min={f.past || editing ? undefined : localISODate()}
                max={f.past ? localISODate() : undefined}
                required
              />
            )}
          </Field>
          <Field label="الوقت" required hint={`ساعات الدوام: ${settings.work_start} – ${settings.work_end}`}>
            {(id) => <input id={id} className="input" type="time" step="300" value={f.time || ''} onChange={set('time')} required />}
          </Field>
          <Field label="المدة (دقيقة)" required>
            {(id) => <input id={id} className="input" type="number" min="5" max="240" step="5" value={f.duration || ''} onChange={set('duration')} required />}
          </Field>
        </div>

        {f.past && (
          <div className="form-grid">
            {f.kind === 'recitation' && (
              <Field label="عدد الصفحات المسمّعة" required>
                {(id) => <input id={id} className="input" type="number" min="0.5" max="604" step="0.5" value={f.pages} onChange={set('pages')} />}
              </Field>
            )}
            <Field label={f.kind === 'exam' ? 'علامة الامتحان (من 100)' : 'التقييم (من 100) — اختياري'} required={f.kind === 'exam'}>
              {(id) => <input id={id} className="input" type="number" min="0" max="100" step="0.5" value={f.grade} onChange={set('grade')} />}
            </Field>
          </div>
        )}

        <Field label="ملاحظات">
          {(id) => <textarea id={id} className="textarea" value={f.notes} onChange={set('notes')} maxLength={1000} style={{ minHeight: 60 }} />}
        </Field>

        {!f.past && f.date && (
          <div className="day-list">
            <b>مواعيدك يوم {fmtWeekday(`${f.date}T12:00:00`)} {fmtDate(f.date)}:</b>
            {dayAppts.length === 0 ? (
              <div className="muted">لا توجد مواعيد محجوزة — اليوم فارغ.</div>
            ) : (
              <ul className="list-plain" style={{ marginTop: 4 }}>
                {dayAppts.map((a) => (
                  <li key={a.id} className={overlapIds.has(a.id) ? 'conflict' : ''} style={{ padding: '3px 0' }}>
                    <span>
                      {fmtTime(a.start_at)} – {fmtTime(a.end_at)} • {a.student_name} ({KIND_LABEL[a.kind]})
                    </span>
                    {overlapIds.has(a.id) && <span>⚠ تعارض</span>}
                  </li>
                ))}
              </ul>
            )}
            {overlapIds.size > 0 && (
              <div className="conflict" style={{ marginTop: 6 }}>
                {studentBusy ? `لدى ${n.the} موعد آخر في هذا الوقت.` : 'الوقت المختار يتعارض مع موعد آخر لك.'}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

// =====================================================================
// تفاصيل الموعد + الإجراءات (تم / لم يلتزم / إعادة جدولة / إلغاء / حذف)
// =====================================================================
export function AppointmentDetail({ appointment: a, onClose, onChanged, onEdit, canManage }) {
  const toast = useToast();
  const { settings } = useAuth();
  const [mode, setMode] = useState('view'); // view | complete
  const [pages, setPages] = useState('');
  const [grade, setGrade] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // 'cancel' | 'delete'

  useEffect(() => {
    if (!a) return;
    setMode('view');
    setPages(a.pages ?? '');
    setGrade(a.grade ?? '');
    setNotes(a.notes ?? '');
    setError('');
    setBusy(false);
    setConfirm(null);
  }, [a]);

  if (!a) return null;
  const started = new Date(a.start_at).getTime() <= Date.now();
  const overdue = a.status === 'scheduled' && new Date(a.end_at).getTime() < Date.now();
  const st = APPT_STATUS[a.status];

  const act = async (fn, okMsg) => {
    setBusy(true);
    setError('');
    try {
      const res = await fn();
      toast.success(okMsg);
      onChanged?.(res?.appointment);
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const complete = (e) => {
    e.preventDefault();
    if (a.kind === 'recitation' && !(Number(pages) > 0)) return setError('أدخل عدد الصفحات المسمّعة');
    if (a.kind === 'exam' && grade === '') return setError('أدخل علامة الامتحان');
    act(
      () =>
        api.post(`/appointments/${a.id}/complete`, {
          ...(a.kind === 'recitation' ? { pages } : {}),
          ...(grade !== '' ? { grade } : {}),
          notes,
        }),
      a.kind === 'exam' ? 'تم تسجيل علامة الامتحان' : 'تم تسجيل التسميع'
    );
  };

  const passed = a.kind === 'exam' && a.status === 'completed' && a.grade !== null ? a.grade >= settings.exam_pass_grade : null;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={apptTitle(a)}
        persistent={busy}
        footer={
          canManage && mode === 'view' ? (
            <>
              {a.status === 'scheduled' && started && (
                <>
                  <button className="btn btn-success" onClick={() => setMode('complete')} type="button">
                    ✓ تم {a.kind === 'exam' ? '(إدخال العلامة)' : '(إدخال الصفحات)'}
                  </button>
                  <button
                    className="btn btn-warn"
                    disabled={busy}
                    type="button"
                    onClick={() => act(() => api.post(`/appointments/${a.id}/missed`, {}), 'تم تسجيل عدم الالتزام')}
                  >
                    لم يلتزم
                  </button>
                </>
              )}
              {(a.status === 'completed' || a.status === 'missed') && (
                <button className="btn btn-secondary" onClick={() => setMode('complete')} type="button">
                  {a.status === 'missed' ? 'تسجيل كمكتمل' : 'تعديل النتيجة'}
                </button>
              )}
              {a.status === 'scheduled' && (
                <>
                  <button className="btn btn-secondary" onClick={() => onEdit?.(a)} type="button">
                    تعديل / إعادة جدولة
                  </button>
                  <button className="btn btn-ghost" onClick={() => setConfirm('cancel')} type="button">
                    إلغاء الموعد
                  </button>
                </>
              )}
              <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setConfirm('delete')} type="button">
                حذف
              </button>
            </>
          ) : null
        }
      >
        {error && <Alert tone="danger">{error}</Alert>}

        {mode === 'view' ? (
          <>
            <dl className="kv">
              <dt>الحالة</dt>
              <dd>
                <Badge tone={st.tone}>{st.label}</Badge> {overdue && <Badge tone="warn">بانتظار تسجيل النتيجة</Badge>}
              </dd>
              <dt>التاريخ</dt>
              <dd>
                {fmtWeekday(a.start_at)} {fmtDate(a.start_at)}
              </dd>
              <dt>الوقت</dt>
              <dd>
                {fmtTime(a.start_at)} – {fmtTime(a.end_at)} ({durationOf(a)} دقيقة)
              </dd>
              <dt>النوع</dt>
              <dd>
                {KIND_LABEL[a.kind]}
                {a.kind === 'recitation' && a.recitation_type ? ` — ${RECITATION_TYPE_LABEL[a.recitation_type]}` : ''}
              </dd>
              {a.surah && (
                <>
                  <dt>السورة</dt>
                  <dd>{a.surah}</dd>
                </>
              )}
              {a.portion && (
                <>
                  <dt>المقطع</dt>
                  <dd>{a.portion}</dd>
                </>
              )}
              {a.supervisor_name && (
                <>
                  <dt>المشرف</dt>
                  <dd>{a.supervisor_name}</dd>
                </>
              )}
              {a.status === 'completed' && a.kind === 'recitation' && (
                <>
                  <dt>الصفحات</dt>
                  <dd>{a.pages}</dd>
                </>
              )}
              {a.status === 'completed' && a.grade !== null && (
                <>
                  <dt>{a.kind === 'exam' ? 'العلامة' : 'التقييم'}</dt>
                  <dd>
                    {a.grade} / 100 {passed !== null && <Badge tone={passed ? 'success' : 'danger'}>{passed ? 'ناجح' : 'راسب'}</Badge>}
                  </dd>
                </>
              )}
              {a.reschedule_count > 0 && (
                <>
                  <dt>إعادة الجدولة</dt>
                  <dd>{a.reschedule_count} مرة</dd>
                </>
              )}
              {a.notes && (
                <>
                  <dt>ملاحظات</dt>
                  <dd>{a.notes}</dd>
                </>
              )}
            </dl>
            {canManage && a.status === 'scheduled' && !started && (
              <Alert tone="info">يمكنك تسجيل نتيجة الموعد (تم / لم يلتزم) بعد حلول وقته.</Alert>
            )}
          </>
        ) : (
          <form onSubmit={complete}>
            <div className="form-grid">
              {a.kind === 'recitation' && (
                <Field label="عدد الصفحات المسمّعة" required>
                  {(id) => <input id={id} className="input" type="number" min="0.5" max="604" step="0.5" value={pages} onChange={(e) => setPages(e.target.value)} autoFocus />}
                </Field>
              )}
              <Field label={a.kind === 'exam' ? 'علامة الامتحان (من 100)' : 'التقييم (من 100) — اختياري'} required={a.kind === 'exam'}>
                {(id) => <input id={id} className="input" type="number" min="0" max="100" step="0.5" value={grade} onChange={(e) => setGrade(e.target.value)} autoFocus={a.kind === 'exam'} />}
              </Field>
              <Field label="ملاحظات" className="full">
                {(id) => <textarea id={id} className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 60 }} />}
              </Field>
            </div>
            <div className="row">
              <button className="btn btn-success" disabled={busy} type="submit">
                {busy ? 'جارٍ الحفظ…' : 'حفظ النتيجة'}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setMode('view')} disabled={busy}>
                رجوع
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        title="إلغاء الموعد"
        tone="warn"
        confirmText="نعم، إلغاء الموعد"
        onConfirm={() => api.post(`/appointments/${a.id}/cancel`).then(() => { toast.success('تم إلغاء الموعد'); onChanged?.(); onClose(); })}
      >
        هل تريد إلغاء موعد <b>{a.student_name}</b> ({fmtDate(a.start_at)} • {fmtTime(a.start_at)})؟
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title="حذف الموعد نهائيًا"
        confirmText="حذف نهائي"
        onConfirm={() => api.del(`/appointments/${a.id}`).then(() => { toast.success('تم حذف الموعد'); onChanged?.(); onClose(); })}
      >
        سيُحذف الموعد من السجل نهائيًا
        {a.status === 'completed' ? ' وسيُخصم من عدّاد الطالب وإحصائياته' : ''}. لا يمكن التراجع عن هذا الإجراء.
      </ConfirmDialog>
    </>
  );
}
