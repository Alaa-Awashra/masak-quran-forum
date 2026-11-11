export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (m, code) => new HttpError(400, m, code);
export const forbidden = (m = 'غير مسموح لك بهذا الإجراء') => new HttpError(403, m, 'FORBIDDEN');
export const notFound = (m = 'العنصر المطلوب غير موجود') => new HttpError(404, m, 'NOT_FOUND');
export const conflict = (m, code) => new HttpError(409, m, code);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

/** للاستخدام مع router.param('id', uuidParam) */
export function uuidParam(req, res, next, value) {
  if (!isUuid(value)) return next(notFound());
  next();
}
