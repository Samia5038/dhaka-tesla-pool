const KEY = 'tp_session';

export function loadSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession({ token, user }) {
  window.localStorage.setItem(KEY, JSON.stringify({ token, user }));
}

export function clearSession() {
  window.localStorage.removeItem(KEY);
}
