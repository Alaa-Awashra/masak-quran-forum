import { useCallback, useEffect, useRef, useState } from 'react';

/** تحميل بيانات من الـ API مع حالة التحميل والخطأ وإعادة التحميل */
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError('');
    try {
      const d = await fn();
      if (id === seq.current) setData(d);
    } catch (e) {
      if (id === seq.current) setError(e.message);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
