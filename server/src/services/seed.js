import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { query } from '../db.js';

/** ينشئ حساب المسؤول الإداري الوحيد إن لم يكن موجودًا */
export async function seedAdmin() {
  const { rows } = await query(`select id from users where role = 'admin' limit 1`);
  const { username, password, fullName, forceReset } = config.admin;

  if (!rows.length) {
    let pwd = password;
    if (!pwd) {
      if (config.isProd) throw new Error('ADMIN_PASSWORD مطلوب عند أول تشغيل في بيئة الإنتاج');
      pwd = 'admin12345';
      console.warn('⚠️  ADMIN_PASSWORD غير مضبوط — كلمة مرور المسؤول للتطوير: admin12345');
    }
    const hash = await bcrypt.hash(pwd, 10);
    await query(
      `insert into users (username, password_hash, role, full_name) values ($1, $2, 'admin', $3)`,
      [username, hash, fullName]
    );
    console.log(`✅ تم إنشاء حساب المسؤول (اسم المستخدم: ${username})`);
    return;
  }

  if (forceReset && password) {
    const hash = await bcrypt.hash(password, 10);
    await query(`update users set password_hash = $1, username = $2 where role = 'admin'`, [hash, username]);
    console.log('🔑 تمت إعادة ضبط كلمة مرور المسؤول (أزل ADMIN_FORCE_RESET بعد ذلك)');
  }
}
