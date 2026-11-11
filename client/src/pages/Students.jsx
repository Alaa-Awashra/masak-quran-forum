import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useLoad } from '../lib/hooks.js';
import { Alert, Avatar, Badge, Empty, Icon, PageHeader, ProgressBar, Spinner, Tabs } from '../components/ui.jsx';
import StudentForm from '../components/StudentForm.jsx';
import { genderLabel } from '../lib/labels.js';
import { fmtIso, fmtNum, norm, relativeDays } from '../lib/format.js';
import { downloadCsv } from '../lib/csv.js';

export default function Students() {
  const { isAdmin, n } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useLoad(() => api.get('/students'), []);
  const { data: sups } = useLoad(() => (isAdmin ? api.get('/supervisors') : Promise.resolve({ supervisors: [] })), [isAdmin]);

  const [tab, setTab] = useState('active');
  const [q, setQ] = useState('');
  const [supFilter, setSupFilter] = useState('');
  const [gender, setGender] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const all = data?.students || [];
  const counts = useMemo(
    () => ({
      active: all.filter((s) => s.status === 'active').length,
      warning: all.filter((s) => s.status === 'active' && s.warning).length,
      suspended: all.filter((s) => s.status === 'suspended').length,
      none: all.filter((s) => !s.supervisor_id).length,
    }),
    [all]
  );

  const list = useMemo(
    () =>
      all.filter((s) => {
        if (tab === 'active' && s.status !== 'active') return false;
        if (tab === 'warning' && !(s.status === 'active' && s.warning)) return false;
        if (tab === 'suspended' && s.status !== 'suspended') return false;
        if (tab === 'none' && s.supervisor_id) return false;
        if (supFilter && s.supervisor_id !== supFilter) return false;
        if (gender && s.gender !== gender) return false;
        if (q && !norm(s.full_name).includes(norm(q)) && !(s.phone || '').includes(q.trim())) return false;
        return true;
      }),
    [all, tab, q, supFilter, gender]
  );

  const exportCsv = () =>
    downloadCsv(
      'students.csv',
      ['الاسم', 'الجنس', ...(isAdmin ? ['المشرف'] : []), 'إجمالي الأجزاء', 'نسبة الالتزام %', 'آخر تسميع', 'الحالة'],
      list.map((s) => [
        s.full_name,
        genderLabel(s.gender),
        ...(isAdmin ? [s.supervisor_name || 'بلا مشرف'] : []),
        s.total_parts,
        s.attendance_rate ?? '',
        s.last_recitation_at ? fmtIso(s.last_recitation_at) : '',
        s.status === 'suspended' ? 'مفصول' : s.warning ? 'تحت التحذير' : 'منتظم',
      ])
    );

  const tabs = [
    { value: 'active', label: 'النشطون', count: counts.active },
    { value: 'warning', label: 'تحت التحذير', count: counts.warning },
    { value: 'suspended', label: 'المفصولون', count: counts.suspended },
    ...(isAdmin && counts.none ? [{ value: 'none', label: 'بلا مشرف', count: counts.none }] : []),
    { value: 'all', label: 'الكل', count: all.length },
  ];

  return (
    <>
      <PageHeader
        title={isAdmin ? 'الطلاب' : n.many}
        subtitle={isAdmin ? 'جميع الطلاب في الملتقى' : `${n.many} التابعون لك`}
        actions={
          <>
            <button className="btn btn-ghost" onClick={exportCsv} disabled={!list.length} type="button"><Icon name="download" /> تصدير</button>
            <button className="btn" onClick={() => setFormOpen(true)} type="button"><Icon name="plus" /> {n.add}</button>
          </>
        }
      />

      <Tabs value={tab} onChange={setTab} tabs={tabs} />

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input className="input" placeholder={`ابحث باسم ${n.the} أو رقم الهاتف…`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {isAdmin && (
          <select className="select" value={supFilter} onChange={(e) => setSupFilter(e.target.value)}>
            <option value="">كل المشرفين</option>
            {(sups?.supervisors || []).map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        )}
        {(isAdmin || n.one === 'طفل') && (
          <select className="select" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">الجنسان</option>
            <option value="male">ذكور</option>
            <option value="female">إناث</option>
          </select>
        )}
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : (
        <div className="card card-flush">
          {list.length === 0 ? (
            <Empty
              icon="users"
              title={all.length === 0 ? `لا يوجد ${n.many} بعد` : 'لا توجد نتائج مطابقة'}
              hint={all.length === 0 ? (isAdmin ? 'أضف مشرفًا أولًا ثم أضف الطلاب.' : `ابدأ بـ${n.add}.`) : 'جرّب تغيير البحث أو الفلتر.'}
            />
          ) : (
            <div className="table-wrap">
              <table className="tbl tbl-click">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    {isAdmin && <th>المشرف</th>}
                    <th>إجمالي الأجزاء</th>
                    <th>الالتزام</th>
                    <th>آخر تسميع</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s) => (
                    <tr key={s.id} onClick={() => navigate(`/students/${s.id}`)}>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <Avatar name={s.full_name} size={34} />
                          <div>
                            <b>{s.full_name}</b>
                            <div className="muted small">{genderLabel(s.gender)}</div>
                          </div>
                        </div>
                      </td>
                      {isAdmin && <td>{s.supervisor_name || <Badge tone="warn">بلا مشرف</Badge>}</td>}
                      <td className="num">{fmtNum(s.total_parts)}</td>
                      <td style={{ minWidth: 110 }}>
                        {s.attendance_rate === null ? (
                          <span className="muted">—</span>
                        ) : (
                          <>
                            <span className="small">{s.attendance_rate}%</span>
                            <ProgressBar value={s.attendance_rate} tone={s.attendance_rate >= 75 ? 'success' : s.attendance_rate >= 50 ? 'warn' : 'danger'} />
                          </>
                        )}
                      </td>
                      <td className="small">
                        {s.last_recitation_at ? (
                          <>
                            {fmtIso(s.last_recitation_at)}
                            <div className="muted">{relativeDays(s.last_recitation_at)}</div>
                          </>
                        ) : (
                          <span className="muted">لم يسمّع بعد</span>
                        )}
                      </td>
                      <td>
                        {s.status === 'suspended' ? (
                          <Badge tone="danger">مفصول</Badge>
                        ) : s.warning ? (
                          <Badge tone="warn" title={s.warning_reasons.join(' • ')}>تحت التحذير</Badge>
                        ) : (
                          <Badge tone="success">منتظم</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <StudentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        supervisors={sups?.supervisors || []}
        onSaved={(st) => {
          reload();
          if (st?.id) navigate(`/students/${st.id}`);
        }}
      />
    </>
  );
}
