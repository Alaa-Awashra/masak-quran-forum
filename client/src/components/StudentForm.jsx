import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { Alert, Field, Modal } from './ui.jsx';
import { genderLabel, supervisorTypeLabel } from '../lib/labels.js';

const EMPTY = {
  full_name: '',
  gender: '',
  birth_date: '',
  phone: '',
  guardian_name: '',
  guardian_phone: '',
  address: '',
  join_date: '',
  initial_parts: '0',
  notes: '',
  supervisor_id: '',
};

/** إضافة/تعديل طالب. للمسؤول: يختار المشرف عند الإضافة. للمشرف: الطالب يُضاف له تلقائيًا. */
export default function StudentForm({ open, onClose, onSaved, student, supervisors = [] }) {
  const { isAdmin, user, n } = useAuth();
  const toast = useToast();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = !!student;

  useEffect(() => {
    if (!open) return;
    setError('');
    setBusy(false);
    if (student) {
      setF({
        ...EMPTY,
        ...Object.fromEntries(Object.entries(student).filter(([k]) => k in EMPTY).map(([k, v]) => [k, v ?? ''])),
        initial_parts: String(student.initial_parts ?? 0),
        supervisor_id: student.supervisor_id || '',
      });
    } else {
      setF(EMPTY);
    }
  }, [open, student]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const supType = isAdmin
    ? supervisors.find((s) => s.id === f.supervisor_id)?.supervisor_type || student?.supervisor_type
    : user.supervisor_type;
  const genderFixed = supType === 'male' ? 'male' : supType === 'female' ? 'female' : null;
  const gender = genderFixed || f.gender;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!editing && isAdmin && !f.supervisor_id) return setError('اختر المشرف المسؤول عن الطالب');
    if (!gender) return setError('اختر الجنس');
    setBusy(true);
    const body = {
      full_name: f.full_name,
      gender,
      birth_date: f.birth_date,
      phone: f.phone,
      guardian_name: f.guardian_name,
      guardian_phone: f.guardian_phone,
      address: f.address,
      join_date: f.join_date,
      initial_parts: f.initial_parts === '' ? 0 : f.initial_parts,
      notes: f.notes,
    };
    try {
      let res;
      if (editing) res = await api.put(`/students/${student.id}`, body);
      else res = await api.post('/students', { ...body, ...(isAdmin ? { supervisor_id: f.supervisor_id } : {}) });
      toast.success(editing ? 'تم حفظ التعديلات' : 'تمت الإضافة بنجاح');
      onSaved?.(res.student);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `تعديل بيانات ${n.the}` : n.add}
      persistent={busy}
      footer={
        <>
          <button className="btn" form="student-form" disabled={busy} type="submit">
            {busy ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy} type="button">
            إلغاء
          </button>
        </>
      }
    >
      <form id="student-form" onSubmit={submit}>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="form-grid">
          {isAdmin && !editing && (
            <Field label="المشرف المسؤول" required className="full">
              {(id) => (
                <select id={id} className="select" value={f.supervisor_id} onChange={set('supervisor_id')} required>
                  <option value="">— اختر المشرف —</option>
                  {supervisors
                    .filter((s) => s.status === 'active')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({supervisorTypeLabel(s.supervisor_type)})
                      </option>
                    ))}
                </select>
              )}
            </Field>
          )}
          <Field label="الاسم الكامل" required className="full">
            {(id) => <input id={id} className="input" value={f.full_name} onChange={set('full_name')} required maxLength={150} autoFocus />}
          </Field>
          <Field label="الجنس" required>
            {(id) =>
              genderFixed ? (
                <input id={id} className="input" value={genderLabel(genderFixed)} disabled />
              ) : (
                <select id={id} className="select" value={f.gender} onChange={set('gender')} required>
                  <option value="">— اختر —</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              )
            }
          </Field>
          <Field label="تاريخ الميلاد">
            {(id) => <input id={id} className="input" type="date" value={f.birth_date} onChange={set('birth_date')} max={new Date().toISOString().slice(0, 10)} />}
          </Field>
          <Field label="رقم الهاتف">
            {(id) => <input id={id} className="input ltr" inputMode="tel" value={f.phone} onChange={set('phone')} maxLength={30} />}
          </Field>
          <Field label="اسم ولي الأمر">
            {(id) => <input id={id} className="input" value={f.guardian_name} onChange={set('guardian_name')} maxLength={150} />}
          </Field>
          <Field label="هاتف ولي الأمر">
            {(id) => <input id={id} className="input ltr" inputMode="tel" value={f.guardian_phone} onChange={set('guardian_phone')} maxLength={30} />}
          </Field>
          <Field label="تاريخ الانضمام">
            {(id) => <input id={id} className="input" type="date" value={f.join_date} onChange={set('join_date')} />}
          </Field>
          <Field label="المحفوظ عند الانضمام (بالأجزاء)" hint="مثال: 0.55 أو 1.5 — يُحسب الإجمالي لاحقًا من التسميعات">
            {(id) => <input id={id} className="input" type="number" min="0" max="30" step="0.01" value={f.initial_parts} onChange={set('initial_parts')} />}
          </Field>
          <Field label="العنوان" className="full">
            {(id) => <input id={id} className="input" value={f.address} onChange={set('address')} maxLength={300} />}
          </Field>
          <Field label="ملاحظات" className="full">
            {(id) => <textarea id={id} className="textarea" value={f.notes} onChange={set('notes')} maxLength={1000} />}
          </Field>
        </div>
      </form>
    </Modal>
  );
}
