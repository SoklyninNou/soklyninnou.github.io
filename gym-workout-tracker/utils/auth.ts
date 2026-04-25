const USER_KEY = 'gym_auth_user';
const SESSION_KEY = 'gym_auth_session';

function ok(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function randomSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hasAccount(): boolean {
  if (!ok()) return false;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return false;
    const u = JSON.parse(raw);
    // Clear legacy plaintext accounts from before hashing was added
    if (!u.passwordHash || !u.salt) {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function createUser(username: string, password: string): Promise<void> {
  if (!ok()) return;
  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  localStorage.setItem(USER_KEY, JSON.stringify({ username, passwordHash, salt }));
}

export async function login(username: string, password: string): Promise<boolean> {
  if (!ok()) return false;
  try {
    const raw = localStorage.getItem(USER_KEY);
    const u = raw ? JSON.parse(raw) : null;
    if (!u?.passwordHash || !u?.salt) return false;
    if (u.username !== username) return false;
    const hash = await hashPassword(password, u.salt);
    if (hash === u.passwordHash) {
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
