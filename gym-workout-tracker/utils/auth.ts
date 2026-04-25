const USER_KEY = 'gym_auth_user';
const SESSION_KEY = 'gym_auth_session';

function ok(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function hasAccount(): boolean {
  if (!ok()) return false;
  return localStorage.getItem(USER_KEY) !== null;
}

export function createUser(username: string, password: string): void {
  if (!ok()) return;
  localStorage.setItem(USER_KEY, JSON.stringify({ username, password }));
}

export function login(username: string, password: string): boolean {
  if (!ok()) return false;
  try {
    const raw = localStorage.getItem(USER_KEY);
    const user = raw ? JSON.parse(raw) : null;
    if (user && user.username === username && user.password === password) {
      localStorage.setItem(SESSION_KEY, 'true');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isLoggedIn(): boolean {
  if (!ok()) return false;
  return localStorage.getItem(SESSION_KEY) === 'true';
}

export function logout(): void {
  if (!ok()) return;
  localStorage.removeItem(SESSION_KEY);
}
