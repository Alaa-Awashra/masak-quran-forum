import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);

  const remove = useCallback((id) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, message) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { id, type, message }]);
      setTimeout(() => remove(id), type === 'error' ? 6000 : 3500);
    },
    [remove]
  );

  const api = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} onClick={() => remove(t.id)}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
