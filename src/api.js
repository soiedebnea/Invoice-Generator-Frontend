const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
};

const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: import.meta.env.VITE_CURRENCY || 'USD' });
export const money = (n) => fmt.format(n || 0);
export const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');