/**
 * The song list ships as an AES-256-GCM blob whose key is derived from the page
 * password. Nothing on the page knows the password or holds a hash of it — a
 * wrong password simply fails the GCM authentication tag, so there is no cheaper
 * check to attack than decrypting the payload itself.
 *
 * This is obfuscation with real cryptography behind it, not authentication: the
 * blob is public, so anyone who finds the page can guess at it offline for as
 * long as they like. PBKDF2 at 310k iterations makes each guess cost real time,
 * but a short password is still a short password.
 */

const PAYLOAD_URL = '/b-side/songs.enc.json';

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let envelopePromise = null;

/** Fetched once per page load and reused across unlock attempts. */
export function loadEnvelope() {
  if (!envelopePromise) {
    envelopePromise = fetch(PAYLOAD_URL, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`missing-payload:${res.status}`);
        return res.json();
      })
      .catch((err) => {
        envelopePromise = null;
        throw err;
      });
  }
  return envelopePromise;
}

export async function decryptPayload(envelope, password) {
  if (!globalThis.crypto?.subtle) throw new Error('insecure-context');

  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromBase64(envelope.kdf.salt),
      iterations: envelope.kdf.iterations,
      hash: envelope.kdf.hash,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );

  // Throws OperationError when the tag does not verify, i.e. wrong password.
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(envelope.cipher.iv), tagLength: envelope.cipher.tagLength },
    key,
    fromBase64(envelope.data),
  );

  return JSON.parse(new TextDecoder().decode(plaintext));
}
