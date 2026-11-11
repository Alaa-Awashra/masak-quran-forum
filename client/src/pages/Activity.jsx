import { useEffect, useState } from 'react';
import { api, qs } from '../api.js';
import { Alert, Empty, PageHeader, Spinner } from '../components/ui.jsx';
import { ACTION_LABEL, actionTone } from '../lib/labels.js';
import { fmtDateTime } from '../lib/format.js';

const FILTERS = [
  { value: '', label: 'كل الأنشطة' },
  { value: 'supervisor', label: 'المشرفون' },
  { value: 'student', label: 'الطلاب' },
  { value: 'appointment', label: 'المواعيد' },
  { value: 'settings', label: 'الإعدادات' },
];

export default function ActivityPage() {
  const [type, setType] = useState('');
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (reset, before) => {
    setLoading(true);
    setError('');
    try {
      const d = await api.get(`/activity${qs({ limit: 40, entity_type: type, before })}`);
      setItems((x) => (reset ? d.items : [...x, ...d.items]));
      setNext(d.next);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <>
      <PageHeader title="سجل النشاط" subtitle="كل ما جرى في النظام: من فعل ماذا ومتى" />
      <div className="toolbar">
        <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
          {FILTERS.map((f) => (<option key={f.value} value={f.value}>{f.label}</option>))}
        </select>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="card">
        {loading && items.length === 0 ? <Spinner /> : items.length === 0 ? (
          <Empty icon="activity" title="لا توجد أنشطة" />
        ) : (
          <ul className="timeline">
            {items.map((a) => (
              <li key={a.id} className={`t-${actionTone(a.action)}`}>
                <div><b>{a.actor_name || 'النظام'}</b> {ACTION_LABEL[a.action] || a.action} {a.entity_name && <b>{a.entity_name}</b>}{a.details?.reason ? <span className="muted"> — {a.details.reason}</span> : null}</div>
                <div className="muted small">{fmtDateTime(a.created_at)}</div>
              </li>
            ))}
          </ul>
        )}
        {next && (
          <div className="center" style={{ marginTop: 14 }}>
            <button className="btn btn-ghost" disabled={loading} onClick={() => load(false, next)} type="button">{loading ? 'جارٍ التحميل…' : 'عرض المزيد'}</button>
          </div>
        )}
      </div>
    </>
  );
}
