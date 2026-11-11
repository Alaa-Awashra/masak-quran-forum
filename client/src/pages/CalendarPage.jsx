import { useCallback, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import arLocale from '@fullcalendar/core/locales/ar';
import { api, qs } from '../api.js';
import { useAuth } from '../context/Auth.jsx';
import { useToast } from '../context/Toast.jsx';
import { useLoad } from '../lib/hooks.js';
import { Alert, Icon, PageHeader } from '../components/ui.jsx';
import { AppointmentDetail, AppointmentForm, apptTitle } from '../components/Appointments.jsx';
import { localHM, localISODate } from '../lib/format.js';

export default function CalendarPage() {
  const { isAdmin, isSupervisor, settings, n } = useAuth();
  const toast = useToast();
  const calRef = useRef(null);
  const [range, setRange] = useState(null);
  const [supFilter, setSupFilter] = useState('');
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null); // { appointment?, initial? }

  const { data: students } = useLoad(() => (isSupervisor ? api.get('/students') : Promise.resolve({ students: [] })), [isSupervisor]);
  const { data: sups } = useLoad(() => (isAdmin ? api.get('/supervisors') : Promise.resolve({ supervisors: [] })), [isAdmin]);

  const { data, error, reload } = useLoad(
    async () => {
      if (!range) return { appointments: [] };
      return api.get(`/appointments${qs({ from: range.start, to: range.end, supervisor_id: supFilter, include_cancelled: 'false' })}`);
    },
    [range?.start, range?.end, supFilter]
  );

  const events = useMemo(
    () =>
      (data?.appointments || []).map((a) => {
        const overdue = a.status === 'scheduled' && new Date(a.end_at) < new Date();
        return {
          id: a.id,
          title: isAdmin && a.supervisor_name ? `${apptTitle(a)} • ${a.supervisor_name}` : apptTitle(a),
          start: a.start_at,
          end: a.end_at,
          editable: isSupervisor && a.status === 'scheduled',
          classNames: [`ev-${a.kind}`, a.status !== 'scheduled' ? `ev-${a.status}` : '', overdue ? 'ev-pending' : ''],
          extendedProps: { appt: a },
        };
      }),
    [data, isAdmin, isSupervisor]
  );

  const onDrop = useCallback(
    async (info) => {
      try {
        await api.put(`/appointments/${info.event.id}`, { start_at: info.event.start.toISOString() });
        toast.success('تمت إعادة جدولة الموعد');
        reload();
      } catch (e) {
        info.revert();
        toast.error(e.message);
      }
    },
    [reload, toast]
  );

  const openNew = (date, allDay) => {
    if (!isSupervisor) return;
    const isPast = !allDay && date < new Date(Date.now() - 120000);
    if (allDay && localISODate(date) < localISODate()) return toast.info('اختر يومًا قادمًا للحجز، أو استخدم «تسجيل تسميع سابق».');
    if (isPast) return toast.info('لا يمكن الحجز في وقت مضى. لتسجيل تسميع سابق استخدم الزر المخصص.');
    setForm({ initial: { date: localISODate(date), time: allDay ? '16:00' : localHM(date) } });
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 700;

  return (
    <>
      <PageHeader
        title="التقويم"
        subtitle={isAdmin ? 'جميع تسميعات وامتحانات المشرفين' : 'مواعيدك — اضغط على يوم أو ساعة لحجز موعد، واسحب الموعد لإعادة جدولته'}
        actions={
          isSupervisor && (
            <>
              <button className="btn" onClick={() => setForm({ initial: {} })} type="button"><Icon name="plus" /> حجز موعد</button>
              <button className="btn btn-ghost" onClick={() => setForm({ initial: { past: true } })} type="button"><Icon name="clock" /> تسجيل تسميع سابق</button>
            </>
          )
        }
      />

      {isAdmin && (
        <div className="toolbar">
          <select className="select" value={supFilter} onChange={(e) => setSupFilter(e.target.value)}>
            <option value="">كل المشرفين</option>
            {(sups?.supervisors || []).map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
          <span className="muted small">عرض فقط — الحجز والتعديل من صلاحيات المشرفين.</span>
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="card">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          locale={arLocale}
          direction="rtl"
          firstDay={6}
          initialView={isMobile ? 'listWeek' : 'timeGridWeek'}
          headerToolbar={{ start: 'prev,next today', center: 'title', end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
          buttonText={{ today: 'اليوم', month: 'شهر', week: 'أسبوع', day: 'يوم', list: 'قائمة' }}
          height="auto"
          contentHeight={isMobile ? undefined : 720}
          slotMinTime={`${settings.work_start}:00`}
          slotMaxTime={`${settings.work_end}:00`}
          slotDuration="00:30:00"
          scrollTime="08:00:00"
          allDaySlot={false}
          nowIndicator
          navLinks
          dayMaxEvents={4}
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
          events={events}
          editable={isSupervisor}
          eventDurationEditable={false}
          eventDrop={onDrop}
          datesSet={(arg) => setRange((r) => (r?.start === arg.start.toISOString() && r?.end === arg.end.toISOString() ? r : { start: arg.start.toISOString(), end: arg.end.toISOString() }))}
          dateClick={(info) => openNew(info.date, info.allDay || info.view.type === 'dayGridMonth')}
          eventClick={(info) => setDetail(info.event.extendedProps.appt)}
          noEventsContent="لا توجد مواعيد في هذه الفترة"
        />
        <div className="cal-legend">
          <span><i style={{ background: 'var(--primary)' }} />تسميع محجوز</span>
          <span><i style={{ background: '#b8860b' }} />امتحان سورة</span>
          <span><i style={{ background: 'var(--success)' }} />تم</span>
          <span><i style={{ background: 'var(--danger)' }} />لم يلتزم</span>
          <span><i style={{ background: 'transparent', border: '2px dashed var(--warn)' }} />بانتظار تسجيل النتيجة</span>
        </div>
      </div>

      <AppointmentForm
        open={!!form}
        onClose={() => setForm(null)}
        onSaved={reload}
        students={students?.students || []}
        appointment={form?.appointment || null}
        initial={form?.initial || {}}
      />
      <AppointmentDetail
        appointment={detail}
        canManage={isSupervisor}
        onClose={() => setDetail(null)}
        onChanged={reload}
        onEdit={(a) => { setDetail(null); setForm({ appointment: a }); }}
      />
    </>
  );
}
