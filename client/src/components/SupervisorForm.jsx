import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../context/Toast.jsx';
import { Alert, Field, Modal } from './ui.jsx';
import { SUPERVISOR_TYPES } from '../lib/labels.js';

const EMPTY = {
  full_name: '',
  supervisor_type: '',
  phone: '',
  email: '',
  birth_date: '',
  address: '',
  national_id: '',
  qualification: '',
  join_date: '',
  notes: '',
};

/** إضافة/تعديل مشرف. عند الإضافة يُولَّد اسم المستخدم وكلمة المرور تلقائيًا ويُعاد في onSaved(result) */
export default function SupervisorForm({ open, onClose, onSaved, supervisor }) {
  const toast = useToast();
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = !!supervisor;

  useEffect(() => {
    if (!open) return;
    setError('');
    setBusy(false);
    setF(
      supervisor
        ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, supervisor[k] ?? '']))
        : EMPTY
    );
  }, [open, supervisor]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.supervisor_type) return setError('اختر نوع المشرف');
    setError('');
    setBusy(true);
    try {
      const res = editing ? await api.put(`/supervisors/${supervisor.id}`, f) : await api.post('/supervisors', f);
      if (editing) toast.success('تم حفظ التعديلات');
      onSaved?.(res);
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
      title={editing ? 'تعديل بيانات المشرف' : 'إضافة مشرف جديد'}
      persistent={busy}
      footer={
        <>
          <button className="btn" form="supervisor-form" disabled={busy} type="submit">
            {busy ? 'جارٍ الحفظ…' : editing ? 'حفظ' : 'إضافة وتوليد بيانات الدخول'}
          </button>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy} type="button">
            إلغاء
          </button>
        </>
      }
    >
      <form id="supervisor-form" onSubmit={submit}>
        {error && <Alert tone="danger">{error}</Alert>}
        {!editing && <Alert tone="info">سيتم توليد اسم المستخدم وكلمة المرور تلقائيًا بعد الحفظ.</Alert>}
        <div className="form-grid">
          <Field label="الاسم الكامل" required className="full">
            {(id) => <input id={id} className="input" value={f.full_name} onChange={set('full_name')} required maxLength={120} autoFocus />}
          </Field>
          <Field
            label="نوع المشرف"
            required
            hint="يحدد واجهته: مشرف (طلاب ذكور) / مشرفة (طالبات) / مشرف كيدز (أطفال)"
            className="full"
          >
            {(id) => (
              <select id={id} className="select" value={f.supervisor_type} onChange={set('supervisor_type')} required>
                <option value="">— اختر —</option>
                {SUPERVISOR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="رقم الهاتف">
            {(id) => <input id={id} className="input ltr" inputMode="tel" value={f.phone} onChange={set('phone')} maxLength={30} />}
          </Field>
          <Field label="البريد الإلكتروني">
            {(id) => <input id={id} className="input ltr" type="email" value={f.email} onChange={set('email')} maxLength={150} />}
          </Field>
          <Field label="تاريخ الميلاد">
            {(id) => <input id={id} className="input" type="date" value={f.birth_date} onChange={set('birth_date')} />}
          </Field>
          <Field label="رقم الهوية">
            {(id) => <input id={id} className="input ltr" value={f.national_id} onChange={set('national_id')} maxLength={30} />}
          </Field>
          <Field label="المؤهل العلمي / الإجازة">
            {(id) => <input id={id} className="input" value={f.qualification} onChange={set('qualification')} maxLength={200} />}
          </Field>
          <Field label="تاريخ الانضمام">
            {(id) => <input id={id} className="input" type="date" value={f.join_date} onChange={set('join_date')} />}
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
