import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { Alert, Field, PageHeader } from '../components/ui.jsx';

export default function Settings() {
  const { settings, reloadSettings } = useAuth();
  const toast = useToast();
  const [f, setF] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setF(settings), [settings]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.put('/settings', f);
      await reloadSettings();
      toast.success('تم حفظ الإعدادات');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const num = (k, props = {}) => (id) => <input id={id} className="input" type="number" value={f[k]} onChange={set(k)} required {...props} />;

  return (
    <>
      <PageHeader title="الإعدادات" subtitle="قواعد التحذير وساعات الدوام والمدد الافتراضية" />
      <form onSubmit={save} className="stack" style={{ maxWidth: 820 }}>
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="card">
          <h2 style={{ marginBottom: 4 }}>قواعد «تحت التحذير»</h2>
          <p className="muted small" style={{ marginBottom: 14 }}>يُحتسب الطالب تحت التحذير تلقائيًا عند تحقق أي شرط من الشرطين:</p>
          <div className="form-grid">
            <Field label="عدد مرات عدم الالتزام خلال 30 يومًا" hint="عند بلوغ هذا العدد يصبح الطالب تحت التحذير">{num('warning_missed_threshold', { min: 1, max: 30 })}</Field>
            <Field label="عدد أيام الانقطاع عن التسميع" hint="بدون أي تسميع مكتمل لهذه المدة">{num('warning_inactive_days', { min: 1, max: 365 })}</Field>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 14 }}>الحجز والمواعيد</h2>
          <div className="form-grid">
            <Field label="بداية الدوام" hint="لا يُسمح بحجز مواعيد قبل هذا الوقت">{(id) => <input id={id} className="input" type="time" value={f.work_start} onChange={set('work_start')} required />}</Field>
            <Field label="نهاية الدوام" hint="يجب أن ينتهي الموعد قبل هذا الوقت">{(id) => <input id={id} className="input" type="time" value={f.work_end} onChange={set('work_end')} required />}</Field>
            <Field label="مدة التسميع الافتراضية (دقيقة)">{num('recitation_minutes', { min: 5, max: 240, step: 5 })}</Field>
            <Field label="مدة الامتحان الافتراضية (دقيقة)">{num('exam_minutes', { min: 5, max: 240, step: 5 })}</Field>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 14 }}>الحفظ والامتحانات</h2>
          <div className="form-grid">
            <Field label="علامة النجاح في امتحان السورة (من 100)">{num('exam_pass_grade', { min: 0, max: 100, step: 0.5 })}</Field>
            <Field label="عدد صفحات الجزء الواحد" hint="يُستخدم لتحويل الصفحات المسمّعة إلى أجزاء (مصحف المدينة: 20)">{num('juz_pages', { min: 1, max: 100 })}</Field>
          </div>
        </div>

        <div><button className="btn" disabled={busy} type="submit">{busy ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}</button></div>
      </form>
    </>
  );
}
