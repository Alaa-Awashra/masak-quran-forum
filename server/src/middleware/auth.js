import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError, forbidden } from '../utils/errors.js';

export const COOKIE_NAME = 'mq_token';

export function signToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });
}

export const clearAuthCookie = (res) => res.clearCookie(COOKIE_NAME, { path: '/' });

const USER_SQL = `
  select u.id, u.username, u.role, u.full_name, u.phone, u.email,
         sp.id as supervisor_id, sp.supervisor_type, sp.status as supervisor_status
  from users u
  left join supervisors sp on sp.user_id = u.id
  where u.id = $1`;

export function shapeUser(r) {
  return {
    id: r.id,
    username: r.username,
    role: r.role,
    full_name: r.full_name,
    phone: r.phone,
    email: r.email,
    supervisor_id: r.supervisor_id || null,
    supervisor_type: r.supervisor_type || null,
  };
}

/** يتحقق من الجلسة ويحمّل المستخدم في كل طلب (لضمان أثر الفصل/الحذف فورًا) */
export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = req.cookies?.[COOKIE_NAME] || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) return next(new HttpError(401, 'يرجى تسجيل الدخول', 'UNAUTHENTICATED'));

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return next(new HttpError(401, 'انتهت الجلسة، يرجى تسجيل الدخول من جديد', 'UNAUTHENTICATED'));
  }

  const { rows } = await query(USER_SQL, [payload.sub]);
  const user = rows[0];
  if (!user) return next(new HttpError(401, 'الحساب غير موجود', 'UNAUTHENTICATED'));
  if (user.role === 'supervisor' && user.supervisor_status === 'suspended') {
    return next(new HttpError(403, 'تم إيقاف حسابك. تواصل مع الإدارة.', 'SUSPENDED'));
  }
  req.user = { ...shapeUser(user) };
  next();
}

export const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : next(forbidden('هذه الصفحة للمسؤول الإداري فقط'));

export const requireSupervisor = (req, res, next) =>
  req.user?.role === 'supervisor' ? next() : next(forbidden('هذا الإجراء للمشرفين فقط'));
