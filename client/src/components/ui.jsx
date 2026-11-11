import { useEffect, useId, useRef, useState } from 'react';

// ---------------------------------------------------------------- الأيقونات
const ICONS = {
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  report: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
  sliders: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
  activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  book: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  menu: <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  printer: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  award: <><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>,
  key: <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />,
  pause: <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
  undo: <><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></>,
  chevron: <polyline points="15 18 9 12 15 6" />,
  repeat: <><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>,
  swap: <><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /></>,
};

export function Icon({ name, size = 18, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

// ---------------------------------------------------------------- عناصر بسيطة
export function Spinner({ label }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" />
      {label && <span>{label}</span>}
    </div>
  );
}

export function Empty({ icon = 'book', title, hint, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={30} />
      </div>
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
      {children}
    </div>
  );
}

export function Badge({ tone = 'muted', children, title }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Alert({ tone = 'info', children }) {
  return <div className={`alert alert-${tone}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'primary', onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`stat stat-${tone} ${onClick ? 'stat-click' : ''}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      {icon && (
        <span className="stat-icon">
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="stat-body">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {hint && <span className="stat-hint">{hint}</span>}
      </span>
    </Tag>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          className={`tab ${value === t.value ? 'active' : ''}`}
          onClick={() => onChange(t.value)}
          type="button"
        >
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, tone = 'primary' }) {
  const v = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="progress" aria-valuenow={v} role="progressbar">
      <span className={`progress-bar progress-${tone}`} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Avatar({ name, size = 40 }) {
  const initial = (name || '?').trim().charAt(0);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initial}
    </span>
  );
}

// ---------------------------------------------------------------- نماذج
export function Field({ label, hint, error, required, children, className = '' }) {
  const id = useId();
  return (
    <label className={`field ${className}`} htmlFor={id}>
      <span className="field-label">
        {label}
        {required && <b className="req"> *</b>}
      </span>
      {typeof children === 'function' ? children(id) : children}
      {hint && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

// ---------------------------------------------------------------- نافذة منبثقة
export function Modal({ open, onClose, title, children, footer, size = 'md', persistent = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && !persistent) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, persistent, onClose]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !persistent) onClose?.();
      }}
    >
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق" type="button">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * نافذة تأكيد للإجراءات الخطرة.
 * requireText: يجب كتابة هذا النص لتفعيل زر التأكيد (مثل اسم المشرف عند الحذف).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = 'تأكيد',
  tone = 'danger',
  requireText,
  disabled = false,
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTyped('');
      setError('');
      setBusy(false);
    }
  }, [open]);

  const ready = (!requireText || typed.trim() === requireText.trim()) && !disabled;

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      size="sm"
      persistent={busy}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy} type="button">
            تراجع
          </button>
          <button className={`btn btn-${tone}`} onClick={run} disabled={!ready || busy} type="button">
            {busy ? 'جارٍ التنفيذ…' : confirmText}
          </button>
        </>
      }
    >
      <div className="confirm-body">{children}</div>
      {requireText && (
        <Field label={`للتأكيد اكتب: ${requireText}`}>
          {(id) => <input id={id} className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
        </Field>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
    </Modal>
  );
}

// ---------------------------------------------------------------- نسخ نص
export function CopyBox({ label, value, secret = false, mono = true }) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="copybox">
      <span className="copybox-label">{label}</span>
      <div className="copybox-row">
        <code className={mono ? 'mono' : ''} dir="ltr">
          {shown ? value : '••••••••••'}
        </code>
        {secret && (
          <button className="icon-btn" type="button" onClick={() => setShown((s) => !s)} title={shown ? 'إخفاء' : 'إظهار'}>
            <Icon name="eye" size={16} />
          </button>
        )}
        <button className="icon-btn" type="button" onClick={copy} title="نسخ">
          <Icon name={copied ? 'check' : 'copy'} size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- مخطط أعمدة بسيط
export function BarChart({ data }) {
  // data: [{ label, a, b, c }] — a: تم، b: لم يلتزم، c: محجوز
  const max = Math.max(1, ...data.map((d) => d.a + d.b + d.c));
  return (
    <div className="chart" role="img" aria-label="مخطط المواعيد خلال آخر 14 يومًا">
      {data.map((d) => {
        const total = d.a + d.b + d.c;
        return (
          <div className="chart-col" key={d.key} title={`${d.full || d.label}: تم ${d.a} • لم يلتزم ${d.b} • محجوز ${d.c}`}>
            <div className="chart-bar-wrap">
              <div className="chart-bar" style={{ height: `${(total / max) * 100}%` }}>
                {d.c > 0 && <span className="seg seg-c" style={{ flex: d.c }} />}
                {d.b > 0 && <span className="seg seg-b" style={{ flex: d.b }} />}
                {d.a > 0 && <span className="seg seg-a" style={{ flex: d.a }} />}
              </div>
            </div>
            <span className="chart-num">{total || ''}</span>
            <span className="chart-label">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
