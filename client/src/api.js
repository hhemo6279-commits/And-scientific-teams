const TOKEN_KEY = 'mk_token';
const USER_KEY = 'mk_user';
const REFRESH_KEY = 'mk_refresh';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setAuth(token, user, refreshToken) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(REFRESH_KEY, refreshToken || '');
}

function setTokens(token, refreshToken) {
  localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// تجديد الجلسة تلقائياً (مرة واحدة في نفس الوقت لضغط الطلبات)
let refreshing = null;
export async function refreshSession() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) throw new Error('no-refresh');
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      clearAuth();
      throw new Error(data.error || 'انتهت الجلسة');
    }
    setTokens(data.token, data.refreshToken);
    if (data.user) setUser(data.user);
    return data.token;
  })();
  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

function httpError(res, data) {
  const err = new Error(data.error || `خطأ (${res.status})`);
  err.status = res.status;
  return err;
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  const hadToken = !!token;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch('/api' + path, { ...options, headers });

  // عند انتهاء صلاحية توكن الوصول: جرّب تجديد الجلسة ثم أعد المحاولة مرة واحدة
  if (hadToken && res.status === 401 && !options._retried) {
    try {
      await refreshSession();
      const retry = await fetch('/api' + path, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${getToken()}` },
        _retried: true,
      });
      const retryData = await retry.json().catch(() => ({}));
      if (!retry.ok) throw httpError(retry, retryData);
      return retryData;
    } catch (e) {
      if (e.message === 'no-refresh' || !getToken()) {
        throw httpError(res, { error: 'انتهت الجلسة، سجّل الدخول مجدداً' });
      }
      throw e;
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(res, data);
  return data;
}

// تسجيل خروج كامل: إبطال الجلسة على الخادم ثم مسح البيانات المحلية
export async function logout() {
  const refresh = getRefreshToken();
  try {
    if (refresh) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
    }
  } catch {}
  clearAuth();
}