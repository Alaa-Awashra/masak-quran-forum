import { HttpError } from '../utils/errors.js';

export function notFoundApi(req, res) {
  res.status(404).json({ error: 'المسار غير موجود', code: 'NOT_FOUND' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }

  // أخطاء PostgreSQL المعروفة
  switch (err?.code) {
    case '23P01':
      return res
        .status(409)
        .json({ error: 'يتعارض هذا الموعد مع موعد آخر محجوز في نفس الوقت', code: 'TIME_CONFLICT' });
    case '23505':
      return res.status(409).json({ error: 'القيمة موجودة مسبقًا', code: 'DUPLICATE' });
    case '23503':
      return res.status(409).json({ error: 'العنصر مرتبط ببيانات أخرى', code: 'FK_VIOLATION' });
    case '22P02':
    case '22007':
    case '22008':
      return res.status(400).json({ error: 'قيمة غير صالحة', code: 'BAD_VALUE' });
    default:
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'صيغة البيانات المرسلة غير صحيحة', code: 'BAD_JSON' });
  }

  console.error('❌ خطأ غير متوقع:', err);
  res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم', code: 'INTERNAL' });
}
