import { kvGet, kvSet } from './local';

const KEYS = {
  passkey: 'auth_passkey',
  qa: 'auth_qa',
  code: 'auth_code',
  throttle: 'auth_throttle',
};

const MAX_FAILS = 5;
const LOCK_MS = 30_000;

const bufToB64Url = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const b64UrlToBuf = (b64) => {
  let s = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};

// Normalisasi kunci publik paskey menjadi DER SPKI (yang dibutuhkan
// crypto.subtle.importKey). Chrome mengembalikan SPKI langsung, Safari
// mengembalikan raw uncompressed EC point (0x04 || X || Y, 65 byte).
const normalizeToSpki = (buf) => {
  const arr = new Uint8Array(buf);
  if (arr.length === 65 && arr[0] === 0x04) {
    const spki = new Uint8Array(91);
    const header = new Uint8Array([
      0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
      0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
    ]);
    spki.set(header, 0);
    spki.set(arr, 26);
    return spki.buffer;
  }
  return buf;
};

const randomBytes = (len) => {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return arr;
};

async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufToB64Url(digest);
}

async function sha256Buf(data) {
  return crypto.subtle.digest('SHA-256', data);
}

const concatBuf = (a, b) => {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(new Uint8Array(a), 0);
  out.set(new Uint8Array(b), a.byteLength);
  return out.buffer;
};

export function isSecureContextSupported() {
  return typeof window !== 'undefined' && window.isSecureContext;
}

export function isWebAuthnSupported() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined' && isSecureContextSupported();
}

// ── Throttle / lockout ──────────────────────────────────────────────
async function getThrottle() {
  const t = await kvGet(KEYS.throttle);
  const now = Date.now();
  if (t && t.lockedUntil && t.lockedUntil > now) return { ...t, lockedUntil: t.lockedUntil, locked: true };
  return { fails: t ? t.fails : 0, lockedUntil: 0, locked: false, now };
}

export async function throttleState() {
  const s = await getThrottle();
  if (s.locked) return { locked: true, remainingMs: Math.max(0, s.lockedUntil - s.now) };
  return { locked: false, fails: s.fails, remainingMs: 0 };
}

export async function recordFail() {
  const t = await getThrottle();
  const fails = (t.locked ? 0 : t.fails) + 1;
  const lockedUntil = fails >= MAX_FAILS ? Date.now() + LOCK_MS : 0;
  await kvSet(KEYS.throttle, { fails, lockedUntil });
  return { fails, lockedUntil };
}

export async function resetThrottle() {
  await kvSet(KEYS.throttle, { fails: 0, lockedUntil: 0 });
}

// Tanda tangan ECDSA dari WebAuthn berformat DER (ASN.1), sedangkan
// crypto.subtle.verify membutuhkan raw r||s. Konversikan ke sini.
const derSigToRaw = (sigBuf) => {
  const sig = new Uint8Array(sigBuf);
  if (sig.length === 64) return sig;
  if (sig[0] !== 0x30) throw new Error('Format tanda tangan tidak dikenali.');

  let p = 2;
  const readInt = () => {
    p++; // lewati byte tag INTEGER (0x02)
    let len = sig[p++];
    if (len & 0x80) {
      const nl = len & 0x7f;
      len = 0;
      for (let i = 0; i < nl; i++) len = len * 256 + sig[p++];
    }
    const v = sig.slice(p, p + len);
    p += len;
    let start = 0;
    while (start < v.length && v[start] === 0) start++;
    const vv = v.slice(start);
    const out = new Uint8Array(32);
    const n = Math.min(32, vv.length);
    out.set(vv.slice(vv.length - n), 32 - n);
    return out;
  };

  const raw = new Uint8Array(64);
  raw.set(readInt(), 0);
  raw.set(readInt(), 32);
  return raw;
};

// ── Hashing ─────────────────────────────────────────────────────────
export function makeSalt(len = 16) {
  const arr = randomBytes(len);
  return Array.from(arr).map((b) => String.fromCharCode(b)).join('');
}

export const hashSecret = async (salt, secret) => sha256Hex(`${salt}::${secret}`);

// ── Setup state ─────────────────────────────────────────────────────
export async function getSetupState() {
  const [passkey, qa, code] = await Promise.all([
    kvGet(KEYS.passkey),
    kvGet(KEYS.qa),
    kvGet(KEYS.code),
  ]);
  return {
    hasPasskey: isWebAuthnSupported() && !!passkey,
    hasQA: !!qa,
    hasCode: !!code,
    done: !!passkey || !!qa || !!code,
  };
}

// ── Biometric (local WebAuthn / passkey, ES256) ─────────────────────
export async function registerPasskey() {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn tidak didukung (butuh HTTPS/localhost).');
  }
  const rpName = 'AI Project Manager';
  const rpId = window.location.hostname;
  const userLabel = 'Agent';

  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: rpName, id: rpId },
      user: {
        id: randomBytes(16),
        name: userLabel,
        displayName: userLabel,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        discoverableCredential: 'preferred',
        userVerification: 'required',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  });

  const publicKey = cred.response.getPublicKey();
  if (!publicKey) {
    throw new Error('Authenticator tidak mengembalikan kunci publik.');
  }

  const record = {
    credentialId: bufToB64Url(cred.rawId),
    publicKey: bufToB64Url(normalizeToSpki(publicKey)),
  };
  await kvSet(KEYS.passkey, record);
  return true;
}

export async function verifyPasskey() {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn tidak didukung di browser ini.');
  }
  const stored = await kvGet(KEYS.passkey);
  if (!stored) {
    throw new Error('Belum ada biometrik terdaftar.');
  }

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ id: b64UrlToBuf(stored.credentialId), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });

  const data = concatBuf(
    assertion.response.authenticatorData,
    await sha256Buf(assertion.response.clientDataJSON)
  );

  try {
    const spki = normalizeToSpki(b64UrlToBuf(stored.publicKey));
    const key = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derSigToRaw(assertion.response.signature), data);
    if (!ok) throw new Error('Verifikasi tanda tangan gagal.');
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotSupportedError') {
      throw new Error('Format biometrik tidak dikenali di perangkat ini. Daftar ulang biometrik.');
    }
    throw e;
  }
  return true;
}

// ── Security question ───────────────────────────────────────────────
export async function setQuestion(question, answer) {
  const salt = makeSalt();
  const answerHash = await hashSecret(salt, answer.trim().toLowerCase());
  await kvSet(KEYS.qa, { question: question.trim(), salt, answerHash });
  return true;
}

export async function verifyAnswer(answer) {
  const qa = await kvGet(KEYS.qa);
  if (!qa) return false;
  const hash = await hashSecret(qa.salt, (answer || '').trim().toLowerCase());
  return hash === qa.answerHash;
}

export async function getQuestion() {
  const qa = await kvGet(KEYS.qa);
  return qa ? qa.question : null;
}

// ── Access code ─────────────────────────────────────────────────────
export async function setCode(code) {
  const salt = makeSalt();
  const hash = await hashSecret(salt, String(code).trim());
  await kvSet(KEYS.code, { salt, hash });
  return true;
}

export async function verifyCode(code) {
  const rec = await kvGet(KEYS.code);
  if (!rec) return false;
  const hash = await hashSecret(rec.salt, String(code).trim());
  return hash === rec.hash;
}

export async function authCheck(method, input) {
  const state = await throttleState();
  if (state.locked) {
    return { ok: false, locked: true, remainingMs: state.remainingMs };
  }
  let ok = false;
  try {
    if (method === 'biometric') {
      await verifyPasskey();
      ok = true;
    } else if (method === 'qa') {
      ok = await verifyAnswer(input);
    } else if (method === 'code') {
      ok = await verifyCode(input);
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }

  if (ok) {
    await resetThrottle();
    return { ok: true };
  }
  const res = await recordFail();
  const locked = res.fails >= MAX_FAILS;
  return { ok: false, locked, remainingMs: locked ? LOCK_MS : 0, fails: res.fails, error: 'INVALID CREDENTIALS' };
}