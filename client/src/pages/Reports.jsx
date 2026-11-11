import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useLoad } from '../lib/hooks.js';
import { Alert, Badge, Empty, Field, Icon, PageHeader, ProgressBar, Spinner, StatCard, Tabs } from '../components/ui.jsx';
import { BRAND } from '../lib/brand.js';
import { downloadCsv } from '../lib/csv.js';
import { fmtIso, fmtNum, lastMonthRange, localISODate, monthStartISO } from '../lib/format.js';
import { supervisorTypeLabel } from '../lib/labels.js';

function PeriodPicker({ from, to, setFrom, setTo }) {
  return (
    <div className="toolbar no-print">
      <Field label="من" className="" >{(id) => <input id={id} className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
      <Field label="إلى">{(id) => <input id={id} className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setFrom(monthStartISO()); setTo(localISODate()); }}>هذا الشهر</button>
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => { const r = lastMonthRange(); setFrom(r.from); setTo(r.to); }}>الشهر الماضي</button>
    </div>
  );
}

// ------------------------------------------------------------ التقرير الشهري (مثل التقرير الورقي)
function Monthly({ from, to, supervisors }) {
  const { isAdmin } = useAuth();
  const [sup, setSup] = useState('');
  useEffect(() => {
    if (isAdmin && !sup && supervisors.length) setSup(supervisors[0].id);
  }, [isAdmin, sup, supervisors]);

  const { data, loading, error } = useLoad(
    () => (isAdmin && !sup ? Promise.resolve(null) : api.get(`/reports/monthly${qs({ from, to, supervisor_id: isAdmin ? sup : '' })}`)),
    [from, to, sup, isAdmin]
  );

  const exportCsv = () =>
    data &&
    downloadCsv(
      `monthly-${data.supervisor.full_name}.csv`,
      ['الطالب', 'صفحات الفترة', 'إجمالي الأجزاء', 'نسبة الحضور %', 'متوسط الدرجة', 'آخر تسميع', 'الحالة'],
      data.rows.map((r) => [r.full_name, r.pages_period, r.total_parts, r.attendance_rate ?? '', r.avg_grade ?? '', r.last_recitation_at ? fmtIso(r.last_recitation_at) : '', statusText(r)])
    );

  return (
    <>
      {isAdmin && (
        <div className="toolbar no-print">
          <select className="select" value={sup} onChange={(e) => setSup(e.target.value)}>
            {supervisors.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        </div>
      )}
      {isAdmin && supervisors.length === 0 ? (
        <Empty icon="users" title="لا يوجد مشرفون بعد" />
      ) : loading && !data ? (
        <Spinner />
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : data ? (
        <>
          <div className="row no-print" style={{ marginBottom: 12 }}>
            <button className="btn" type="button" onClick={() => window.print()}><Icon name="printer" /> طباعة / PDF</button>
            <button className="btn btn-ghost" type="button" onClick={exportCsv}><Icon name="download" /> تصدير Excel</button>
          </div>
          <div className="report-sheet">
            <div className="r-brand">{BRAND.name}</div>
            <div className="r-title">تقرير المشرف: {data.supervisor.full_name}</div>
            <div className="r-period">الفترة: {fmtIso(data.period.from)} إلى {fmtIso(data.period.to)}</div>
            <div className="r-summary">
              <span>عدد الطلاب: {data.totals.students}</span>
              <span>إجمالي صفحات الفترة: {fmtNum(data.totals.pages, 1)}</span>
              <span>لم يسمّعوا في الفترة: {data.totals.not_recited}</span>
            </div>
            {data.rows.length === 0 ? (
              <p className="center muted">لا يوجد طلاب نشطون لهذا المشرف.</p>
            ) : (
              <div className="table-wrap">
                <table className="r-table">
                  <thead>
                    <tr>
                      <th>الطالب</th><th>صفحات الفترة</th><th>إجمالي الأجزاء</th><th>الحضور</th><th>متوسط الدرجة</th><th>آخر تسميع</th><th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.id} className={r.status === 'not_recited' ? 'r-bad' : r.status === 'partial' ? 'r-partial' : ''}>
                        <td className="name">{r.full_name}</td>
                        <td>{fmtNum(r.pages_period, 1)}</td>
                        <td>{fmtNum(r.total_parts)}</td>
                        <td>{r.attendance_rate === null ? '—' : `${r.attendance_rate}%`}</td>
                        <td>{r.avg_grade ?? '—'}</td>
                        <td>{r.last_recitation_at ? fmtIso(r.last_recitation_at) : '—'}</td>
                        <td>{statusText(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}

const statusText = (r) => (r.status === 'not_recited' ? 'لم يسمّع هذه الفترة' : r.status === 'partial' ? 'التزام جزئي' : 'ملتزم');

// ------------------------------------------------------------ الطلاب تحت التحذير
function Warnings({ supervisors }) {
  const { isAdmin, n } = useAuth();
  const [sup, setSup] = useState('');
  const { data, loading, error } = useLoad(() => api.get(`/reports/warnings${qs({ supervisor_id: sup })}`), [sup]);
  return (
    <>
      {isAdmin && (
        <div className="toolbar">
          <select className="select" value={sup} onChange={(e) => setSup(e.target.value)}>
            <option value="">كل المشرفين</option>
            {supervisors.map((s) => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
          </select>
        </div>
      )}
      {loading && !data ? <Spinner /> : error ? <Alert tone="danger">{error}</Alert> : (
        <div className="card card-flush">
          {data.rows.length === 0 ? (
            <Empty icon="check" title={`لا يوجد ${n.many} تحت التحذير`} />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>الاسم</th>{isAdmin && <th>المشرف</th>}<th>الأسباب</th><th>عدم التزام (30 يوم)</th><th>آخر تسميع</th></tr></thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id}>
                      <td><Link to={`/students/${r.id}`}><b>{r.full_name}</b></Link></td>
                      {isAdmin && <td>{r.supervisor_name || '—'}</td>}
                      <td>{r.reasons.map((x) => (<Badge key={x} tone="warn">{x}</Badge>))}</td>
                      <td className="num">{r.missed_30d}</td>
                      <td className="num">{r.last_recitation_at ? fmtIso(r.last_recitation_at) : 'لم يسمّع'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------ امتحانات السور
function Exams({ from, to, supervisors }) {
  const { isAdmin } = useAuth();
  const [sup, setSup] = useState('');
  const { data, loading, error } = useLoad(() => api.get(`/reports/exams${qs({ from, to, supervisor_id: sup })}`), [from, to, sup]);
  return (
    <>
      {isAdmin && (
        <div className="toolbar">
          <select className="select" value={sup} onChange={(e) => setSup(e.target.value)}>
            <option value="">كل المشرفين</option>
            {supervisors.map((s) => (<option key={s.id} value={s.id}>{s.full_name}</option>))}
          </select>
        </div>
      )}
      {loading && !data ? <Spinner /> : error ? <Alert tone="danger">{error}</Alert> : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <StatCard label="إجمالي الامتحانات" value={data.summary.total} icon="award" />
            <StatCard label={`ناجح (≥ ${data.pass_grade})`} value={data.summary.passed} icon="check" tone="success" />
            <StatCard label="راسب" value={data.summary.failed} icon="x" tone="danger" />
            <StatCard label="متوسط العلامات" value={data.summary.average ?? '—'} icon="report" tone="info" />
          </div>
          <div className="card card-flush">
            {data.rows.length === 0 ? <Empty icon="award" title="لا توجد امتحانات في هذه الفترة" /> : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>الطالب</th>{isAdmin && <th>المشرف</th>}<th>السورة</th><th>العلامة</th><th>النتيجة</th><th>التاريخ</th></tr></thead>
                  <tbody>
                    {data.rows.map((r) => {
                      const ok = r.grade !== null && r.grade >= data.pass_grade;
                      return (
                        <tr key={r.id}>
                          <td><Link to={`/students/${r.student_id}`}><b>{r.student_name}</b></Link></td>
                          {isAdmin && <td>{r.supervisor_name || '—'}</td>}
                          <td>{r.surah || '—'}</td>
                          <td className="num">{r.status === 'completed' ? fmtNum(r.grade, 1) : '—'}</td>
                          <td>{r.status === 'missed' ? <Badge tone="danger">لم يحضر</Badge> : <Badge tone={ok ? 'success' : 'danger'}>{ok ? 'ناجح' : 'راسب'}</Badge>}</td>
                          <td className="num">{fmtIso(r.start_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------ أداء المشرفين (للمسؤول)
function SupervisorsReport({ from, to }) {
  const { data, loading, error } = useLoad(() => api.get(`/reports/supervisors${qs({ from, to })}`), [from, to]);
  const rows = data?.rows || [];
  const exportCsv = () =>
    downloadCsv('supervisors-performance.csv', ['المشرف', 'النوع', 'الطلاب', 'تسميعات', 'لم يلتزم', 'الالتزام %', 'صفحات', 'امتحانات', 'متوسط الامتحانات'],
      rows.map((r) => [r.full_name, supervisorTypeLabel(r.supervisor_type), r.students, r.rec_completed, r.rec_missed, r.commitment_rate ?? '', r.pages, r.exams, r.avg_exam_grade ?? '']));
  return loading && !data ? <Spinner /> : error ? <Alert tone="danger">{error}</Alert> : (
    <>
      <div className="row no-print" style={{ marginBottom: 12 }}>
        <button className="btn btn-ghost" type="button" onClick={exportCsv}><Icon name="download" /> تصدير Excel</button>
        <button className="btn btn-ghost" type="button" onClick={() => window.print()}><Icon name="printer" /> طباعة</button>
      </div>
      <div className="card card-flush">
        {rows.length === 0 ? <Empty icon="users" title="لا يوجد مشرفون" /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>المشرف</th><th>الطلاب</th><th>تسميعات</th><th>لم يلتزم</th><th>الالتزام</th><th>صفحات</th><th>امتحانات</th><th>بانتظار التحديث</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link to={`/supervisors/${r.id}`}><b>{r.full_name}</b></Link> {r.status === 'suspended' && <Badge tone="danger">مفصول</Badge>}<div className="muted small">{supervisorTypeLabel(r.supervisor_type)}</div></td>
                    <td className="num">{r.students}</td>
                    <td className="num">{r.rec_completed}</td>
                    <td className="num">{r.rec_missed}</td>
                    <td style={{ minWidth: 120 }}>{r.commitment_rate === null ? '—' : (<><span className="small">{r.commitment_rate}%</span><ProgressBar value={r.commitment_rate} tone={r.commitment_rate >= 75 ? 'success' : r.commitment_rate >= 50 ? 'warn' : 'danger'} /></>)}</td>
                    <td className="num">{fmtNum(r.pages, 1)}</td>
                    <td className="num">{r.exams}{r.avg_exam_grade !== null ? ` (متوسط ${r.avg_exam_grade})` : ''}</td>
                    <td className="num">{r.pending || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function Reports() {
  const { isAdmin, n } = useAuth();
  const [params, setParams] = useSearchParams();
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(localISODate());
  const { data: sups } = useLoad(() => (isAdmin ? api.get('/supervisors') : Promise.resolve({ supervisors: [] })), [isAdmin]);
  const supervisors = useMemo(() => sups?.supervisors || [], [sups]);

  const tab = params.get('tab') || 'monthly';
  const tabs = [
    { value: 'monthly', label: 'التقرير الشهري' },
    { value: 'warnings', label: `${n.many} تحت التحذير` },
    { value: 'exams', label: 'امتحانات السور' },
    ...(isAdmin ? [{ value: 'supervisors', label: 'أداء المشرفين' }] : []),
  ];

  return (
    <>
      <PageHeader title="التقارير" subtitle="تقارير جاهزة للطباعة والتصدير" />
      <div className="no-print">
        <Tabs value={tab} onChange={(v) => setParams({ tab: v })} tabs={tabs} />
      </div>
      {tab !== 'warnings' && <PeriodPicker from={from} to={to} setFrom={setFrom} setTo={setTo} />}
      {tab === 'monthly' && <Monthly from={from} to={to} supervisors={supervisors} />}
      {tab === 'warnings' && <Warnings supervisors={supervisors} />}
      {tab === 'exams' && <Exams from={from} to={to} supervisors={supervisors} />}
      {tab === 'supervisors' && isAdmin && <SupervisorsReport from={from} to={to} />}
    </>
  );
}
