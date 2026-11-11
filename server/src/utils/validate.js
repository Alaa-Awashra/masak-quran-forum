import { z } from 'zod';
import { HttpError } from './errors.js';

const FIELD_LABELS = {
  username: 'اسم المستخدم',
  password: 'كلمة المرور',
  full_name: 'الاسم',
  phone: 'رقم الهاتف',
  email: 'البريد الإلكتروني',
  birth_date: 'تاريخ الميلاد',
  join_date: 'تاريخ الانضمام',
  supervisor_type: 'نوع المشرف',
  gender: 'الجنس',
  start_at: 'وقت الموعد',
  duration_min: 'مدة الموعد',
  grade: 'العلامة',
  pages: 'عدد الصفحات',
  initial_parts: 'المحفوظ عند الانضمام',
};

const hasArabic = (s) => /[؀-ۿ]/.test(s);

/** يتحقق من البيانات ويرمي HttpError(400) برسالة عربية واضحة */
export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const key = issue.path[0];
  const label = FIELD_LABELS[key] || String(key ?? 'البيانات');
  const message = hasArabic(issue.message) ? issue.message : `قيمة غير صالحة في الحقل: ${label}`;
  throw new HttpError(400, message, 'VALIDATION');
}

const emptyToNull = (v) => {
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return v;
};

export const reqText = (label, max = 200) =>
  z
    .string({ required_error: `${label} مطلوب`, invalid_type_error: `${label} غير صالح` })
    .trim()
    .min(1, `${label} مطلوب`)
    .max(max, `${label} طويل جدًا`);

export const optText = (label = 'النص', max = 500) =>
  z.preprocess(emptyToNull, z.string().max(max, `${label} طويل جدًا`).nullable().optional());

export const optDate = z.preprocess(
  emptyToNull,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ غير صالح')
    .refine((s) => !Number.isNaN(Date.parse(s)), 'تاريخ غير صالح')
    .nullable()
    .optional()
);

export const optEmail = z.preprocess(
  emptyToNull,
  z.string().email('البريد الإلكتروني غير صالح').max(150).nullable().optional()
);

export const optPhone = z.preprocess(
  emptyToNull,
  z
    .string()
    .max(30, 'رقم الهاتف طويل جدًا')
    .regex(/^[0-9+\-\s()]*$/, 'رقم الهاتف غير صالح')
    .nullable()
    .optional()
);

export const uuid = (label = 'المعرّف') => z.string({ required_error: `${label} مطلوب` }).uuid(`${label} غير صالح`);

export { z };
