import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../lib/hooks.js';
import { Alert, Avatar, Badge, CopyBox, Empty, Icon, Modal, PageHeader, Spinner, Tabs } from '../components/ui.jsx';
import SupervisorForm from '../components/SupervisorForm.jsx';
import { SUPERVISOR_TYPES, supervisorTypeLabel } from '../lib/labels.js';
import { norm } from '../lib/format.js';

export function CredentialsDialog({ open, onClose, creds, title = 'بيانات الدخول' }) {
  if (!creds) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <button className="btn" onClick={onClose} type="button">
          تم، أغلق
        </button>
      }
    >
      <Alert tone="success">تم الحفظ بنجاح. سلّم هذه البيانات للمشرف. تبقى ظاهرة لك دائمًا في صفحة المشرف ما لم يغيّر كلمة المرور بنفسه.</Alert>
      <div className="stack" style={{ gap: 10 }}>
        <CopyBox label="اسم المستخدم" value={creds.username} />
        <CopyBox label="كلمة المرور" value={creds.password} />
      </div>
    </Modal>
  );
}

export default function Supervisors() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useLoad(() => api.get('/supervisors'), []);
  const [tab, setTab] = useState('active');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [creds, setCreds] = useState(null);

  const all = data?.supervisors || [];
  const list = useMemo(
    () =>
      all.filter(
        (s) =>
          (tab === 'all' || s.status === tab) &&
          (!type || s.supervisor_type === type) &&
          (!q || norm(s.full_name).includes(norm(q)) || s.username.includes(q.trim()))
      ),
    [all, tab, type, q]
  );

  return (
    <>
      <PageHeader
        title="المشرفون"
        subtitle="إضافة المشرفين وإدارتهم وفصلهم"
        actions={
          <button className="btn" onClick={() => setFormOpen(true)} type="button">
            <Icon name="plus" /> إضافة مشرف
          </button>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'active', label: 'النشطون', count: all.filter((s) => s.status === 'active').length },
          { value: 'suspended', label: 'سجل المفصولين', count: all.filter((s) => s.status === 'suspended').length },
          { value: 'all', label: 'الكل', count: all.length },
        ]}
      />

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input className="input" placeholder="ابحث بالاسم أو اسم المستخدم…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">كل الأنواع</option>
          {SUPERVISOR_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : list.length === 0 ? (
        <div className="card">
          <Empty
            icon="users"
            title={all.length === 0 ? 'لم تُضف أي مشرف بعد' : 'لا توجد نتائج'}
            hint={all.length === 0 ? 'أضف أول مشرف وسيُولَّد له اسم مستخدم وكلمة مرور تلقائيًا.' : 'جرّب تغيير الفلتر أو البحث.'}
          >
            {all.length === 0 && (
              <button className="btn" onClick={() => setFormOpen(true)} type="button">
                <Icon name="plus" /> إضافة مشرف
              </button>
            )}
          </Empty>
        </div>
      ) : (
        <div className="grid grid-auto">
          {list.map((s) => (
            <div key={s.id} className="card sup-card" onClick={() => navigate(`/supervisors/${s.id}`)} role="link" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/supervisors/${s.id}`)}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <Avatar name={s.full_name} size={46} />
                <div style={{ minWidth: 0 }}>
                  <h3>{s.full_name}</h3>
                  <span className="muted small">{supervisorTypeLabel(s.supervisor_type)}</span>
                </div>
              </div>
              <div className="row">
                {s.status === 'suspended' ? <Badge tone="danger">مفصول</Badge> : <Badge tone="success">نشط</Badge>}
                <Badge tone="primary">{s.students_active} طالب نشط</Badge>
              </div>
              {s.phone && (
                <span className="muted small" dir="ltr" style={{ textAlign: 'right' }}>
                  {s.phone}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <SupervisorForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(res) => {
          setCreds({ username: res.username, password: res.password });
          reload();
        }}
      />
      <CredentialsDialog open={!!creds} creds={creds} onClose={() => setCreds(null)} title="تم إنشاء حساب المشرف" />
    </>
  );
}
