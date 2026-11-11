import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { useLoad } from '../lib/hooks.js';
import { Alert, Avatar, Badge, Field, PageHeader, Spinner } from '../components/ui.jsx';
import { supervisorTypeLabel } from '../lib/labels.js';

export default function Profile() {
  const { isAdmin, refreshUser } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => api.get('/profile'), []);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (data?.profile) {
      const p = data.profile;
      setF({ full_name: p.full_name || '', phone: p.phone || '', email: p.email || '', birth_date: p.birth_date || '', address: p.address || '' });
    }
  }, [data]);

  if (loading && !data) return <Spinner />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!f) return null;
  const p = data.profile;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await api.put('/profile', f);
      toast.success('تم حفظ المعلومات');
      await refreshUser();
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pw.new_password !== pw.confirm) return setPwError('تأكيد كلمة المرور غير مطابق');
    setPwBusy(true);
    try {
      await api.put('/profile/password', { current_password: pw.current_password, new_password: pw.new_password });
      toast.success('تم تغيير كلمة المرور');
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="ملفي الشخصي" subtitle="عدّل معلوماتك وكلمة مرورك" />
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <form className="card" onSubmit={save}>
          <div className="row" style={{ marginBottom: 16 }}>
            <Avatar name={p.full_name} size={56} />
            <div>
              <h2>{p.full_name}</h2>
              <div className="row">
                <Badge tone="primary">{isAdmin ? 'المسؤول الإداري' : supervisorTypeLabel(p.supervisor_type)}</Badge>
                <span className="muted small" dir="ltr">@{p.username}</span>
              </div>
            </div>
          </div>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Field label="الاسم الكامل" required>{(id) => <input id={id} className="input" value={f.full_name} onChange={set('full_name')} required maxLength={120} />}</Field>
          <div className="form-grid">
            <Field label="رقم الهاتف">{(id) => <input id={id} className="input ltr" value={f.phone} onChange={set('phone')} inputMode="tel" maxLength={30} />}</Field>
            <Field label="البريد الإلكتروني">{(id) => <input id={id} className="input ltr" type="email" value={f.email} onChange={set('email')} maxLength={150} />}</Field>
            {!isAdmin && (
              <>
                <Field label="تاريخ الميلاد">{(id) => <input id={id} className="input" type="date" value={f.birth_date} onChange={set('birth_date')} />}</Field>
                <Field label="العنوان">{(id) => <input id={id} className="input" value={f.address} onChange={set('address')} maxLength={300} />}</Field>
              </>
            )}
          </div>
          <button className="btn" disabled={busy} type="submit">{busy ? 'جارٍ الحفظ…' : 'حفظ المعلومات'}</button>
        </form>

        <form className="card" onSubmit={changePassword}>
          <h2 style={{ marginBottom: 14 }}>تغيير كلمة المرور</h2>
          {pwError && <Alert tone="danger">{pwError}</Alert>}
          <Field label="كلمة المرور الحالية" required>{(id) => <input id={id} className="input ltr" type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required />}</Field>
          <Field label="كلمة المرور الجديدة" required hint="8 أحرف على الأقل">{(id) => <input id={id} className="input ltr" type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} minLength={8} required />}</Field>
          <Field label="تأكيد كلمة المرور الجديدة" required>{(id) => <input id={id} className="input ltr" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />}</Field>
          <button className="btn" disabled={pwBusy} type="submit">{pwBusy ? 'جارٍ التغيير…' : 'تغيير كلمة المرور'}</button>
          {!isAdmin && <p className="muted small" style={{ marginTop: 12 }}>بعد تغيير كلمة المرور لن تظهر للمسؤول الإداري، ويمكنه توليد كلمة جديدة إن نسيتها.</p>}
        </form>
      </div>
    </>
  );
}
