let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(`/api${url}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw Object.assign(new Error('تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجددًا.'), { status: 0 });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/auth/login') && onUnauthorized) onUnauthorized();
    throw Object.assign(new Error(data?.error || 'حدث خطأ غير متوقع'), { status: res.status, code: data?.code });
  }
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),
  del: (url, body = {}) => request('DELETE', url, body),
};

export const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};
