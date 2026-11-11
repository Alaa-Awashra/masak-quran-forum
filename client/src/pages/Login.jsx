import { useState } from 'react';
import { useAuth } from '../context/Auth.jsx';
import { Alert, Icon } from '../components/ui.jsx';
import { BRAND } from '../lib/brand.js';

// خلفية إسلامية: شبكة الأقواس البصلية (Ogee) المغربية الأندلسية، منحنيات ناعمة بلا نجوم
function Pattern() {
  return (
    <svg className="pattern" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id="ogee" width="80" height="120" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#f3dfa6" strokeWidth="1.2">
            <path d="M40 0C40 30 80 30 80 60C80 90 40 90 40 120M40 0C40 30 0 30 0 60C0 90 40 90 40 120" />
            <path d="M40 22C40 40 64 44 64 60C64 76 40 80 40 98C40 80 16 76 16 60C16 44 40 40 40 22Z" opacity="0.55" />
          </g>
          <g fill="#f3dfa6">
            <circle cx="40" cy="60" r="2.5" />
            <circle cx="0" cy="0" r="2.5" /><circle cx="80" cy="0" r="2.5" />
            <circle cx="0" cy="120" r="2.5" /><circle cx="80" cy="120" r="2.5" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ogee)" />
    </svg>
  );
}

// شمسة مزخرفة خلف الشعار: حلقات وبتلات لوتس كزخارف المصاحف
const PETALS = Array.from({ length: 16 }, (_, i) => i * 22.5);
function Shamsa() {
  return (
    <svg className="shamsa" viewBox="-150 -150 300 300" aria-hidden="true">
      <g fill="none" stroke="#f3dfa6">
        <circle r="78" strokeWidth="1.4" />
        <circle r="84" strokeWidth="0.8" />
        {PETALS.map((a) => (
          <path key={a} transform={`rotate(${a})`} strokeWidth="1.2" d="M0 -84C20 -98 16 -122 0 -134C-16 -122 -20 -98 0 -84Z" />
        ))}
        {PETALS.map((a) => (
          <path key={`i${a}`} transform={`rotate(${a + 11.25})`} strokeWidth="1" d="M0 -86C9 -94 8 -106 0 -112C-8 -106 -9 -94 0 -86Z" />
        ))}
      </g>
      <g fill="#f3dfa6">
        {PETALS.map((a) => (
          <circle key={a} transform={`rotate(${a})`} cy="-142" r="2.4" />
        ))}
      </g>
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-form-side">
        <form className="login-box" onSubmit={submit}>
          <img src={BRAND.logo} alt={BRAND.name} />
          <h1>{BRAND.name}</h1>
          <p className="sub">مرحبًا بك، سجّل دخولك للمتابعة</p>

          {error && <Alert tone="danger">{error}</Alert>}

          <label className="field">
            <span className="field-label">اسم المستخدم</span>
            <input
              className="input ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
            />
          </label>

          <label className="field">
            <span className="field-label">كلمة المرور</span>
            <div className="pass-wrap">
              <input
                className="input ltr"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button className="icon-btn" type="button" onClick={() => setShow((s) => !s)} aria-label="إظهار كلمة المرور">
                <Icon name="eye" size={17} />
              </button>
            </div>
          </label>

          <button className="btn btn-block" type="submit" disabled={busy || !username || !password} style={{ padding: '12px', marginTop: 6 }}>
            {busy ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
          </button>
          <p className="muted small center" style={{ marginTop: 18 }}>
            نسيت كلمة المرور؟ تواصل مع المسؤول الإداري.
          </p>
        </form>
      </div>

      <div className="login-art">
        <Pattern />
        <div className="art-card">
          <div className="art-emblem">
            <Shamsa />
            <img className="art-logo" src={BRAND.logo} alt="" />
          </div>
          <blockquote>
            {BRAND.hadith}{' '}
            <span className="sadaq">
              صدق رسول الله <span className="saw" aria-label="صلى الله عليه وسلم">ﷺ</span>
            </span>
          </blockquote>
          <p className="art-sub">منصّة متكاملة لمتابعة الحفظ والتسميع والاختبارات</p>
        </div>
      </div>
    </div>
  );
}
