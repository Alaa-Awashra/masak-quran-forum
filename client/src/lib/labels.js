export const SUPERVISOR_TYPES = [
  { value: 'male', label: 'مشرف (ذكور)' },
  { value: 'female', label: 'مشرفة (إناث)' },
  { value: 'kids', label: 'مشرف كيدز' },
];

export const supervisorTypeLabel = (t) => SUPERVISOR_TYPES.find((x) => x.value === t)?.label || '—';

/** مسميات الواجهة حسب نوع المشرف: ذكور / إناث / كيدز */
export function nouns(type) {
  switch (type) {
    case 'female':
      return { one: 'طالبة', many: 'الطالبات', mine: 'طالباتي', add: 'إضافة طالبة', the: 'الطالبة', supervisor: 'المشرفة' };
    case 'kids':
      return { one: 'طفل', many: 'الأطفال', mine: 'أطفالي', add: 'إضافة طفل', the: 'الطفل', supervisor: 'المشرف' };
    case 'male':
      return { one: 'طالب', many: 'الطلاب', mine: 'طلابي', add: 'إضافة طالب', the: 'الطالب', supervisor: 'المشرف' };
    default:
      return { one: 'طالب', many: 'الطلاب', mine: 'الطلاب', add: 'إضافة طالب', the: 'الطالب', supervisor: 'المشرف' };
  }
}

export const genderLabel = (g) => (g === 'female' ? 'أنثى' : 'ذكر');

export const KIND_LABEL = { recitation: 'تسميع', exam: 'امتحان سورة' };
export const RECITATION_TYPE_LABEL = { new: 'حفظ جديد', review: 'مراجعة' };
export const APPT_STATUS = {
  scheduled: { label: 'محجوز', tone: 'info' },
  completed: { label: 'تم', tone: 'success' },
  missed: { label: 'لم يلتزم', tone: 'danger' },
  cancelled: { label: 'ملغي', tone: 'muted' },
};

export const ACTION_LABEL = {
  'supervisor.create': 'أضاف المشرف',
  'supervisor.update': 'عدّل بيانات المشرف',
  'supervisor.suspend': 'فصل المشرف',
  'supervisor.reinstate': 'أعاد تفعيل المشرف',
  'supervisor.delete': 'حذف المشرف',
  'supervisor.reset_password': 'أعاد تعيين كلمة مرور المشرف',
  'student.create': 'أضاف الطالب',
  'student.update': 'عدّل بيانات الطالب',
  'student.suspend': 'فصل الطالب',
  'student.reinstate': 'أعاد تفعيل الطالب',
  'student.delete': 'حذف الطالب',
  'student.transfer': 'نقل الطالب',
  'student.warning': 'أضاف تحذيرًا على الطالب',
  'student.warning_resolved': 'أغلق تحذيرًا على الطالب',
  'appointment.create': 'حجز موعدًا للطالب',
  'appointment.record': 'سجّل موعدًا سابقًا للطالب',
  'appointment.reschedule': 'أعاد جدولة موعد الطالب',
  'appointment.update': 'عدّل موعد الطالب',
  'appointment.complete': 'سجّل إتمام موعد الطالب',
  'appointment.missed': 'سجّل عدم التزام الطالب',
  'appointment.cancel': 'ألغى موعد الطالب',
  'appointment.delete': 'حذف موعد الطالب',
  'profile.update': 'عدّل ملفه الشخصي',
  'profile.password': 'غيّر كلمة المرور',
  'settings.update': 'عدّل الإعدادات',
};

export const actionTone = (a) =>
  /delete|suspend$/.test(a) ? 'danger' : /create|record|reinstate/.test(a) ? 'success' : /missed|warning$/.test(a) ? 'warn' : 'info';
