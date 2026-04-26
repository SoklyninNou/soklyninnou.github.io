const PASS_KEY = 'gym_pass_v1';

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

export function hasPassword(): boolean {
  if (!ok()) return false;
  try {
    const raw = localStorage.getItem(PASS_KEY);
    if (!raw) return false;
    const p = JSON.parse(raw);
    return !!(p.hash && p.salt);
  } catch {
    return false;
  }
}

export async function setPassword(password: string): Promise<void> {
  if (!ok()) return;
  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  localStorage.setItem(PASS_KEY, JSON.stringify({ hash, salt }));
}

export async function verifyPassword(password: string): Promise<boolean> {
  if (!ok()) return false;
  try {
    const raw = localStorage.getItem(PASS_KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (!p?.hash || !p?.salt) return false;
    const hash = await hashPassword(password, p.salt);
    return hash === p.hash;
  } catch {
    return false;
  }
}
