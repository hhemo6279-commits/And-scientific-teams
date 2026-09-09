import crypto from 'node:crypto';

// ======= TOTP (Google Authenticator) بدون مكتبات خارجية =======

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  let out = Buffer.alloc(0);
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out = Buffer.concat([out, Buffer.from([(value >>> (bits - 8)) & 255])]);
      bits -= 8;
    }
  }
  return out;
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function totpAt(secret, time) {
  const counter = Math.floor(time / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hash = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const bin = ((hash[offset] & 0x7f) << 24)
    | ((hash[offset + 1] & 0xff) << 16)
    | ((hash[offset + 2] & 0xff) << 8)
    | (hash[offset + 3] & 0xff);
  return (bin % 1000000).toString().padStart(6, '0');
}

// التحقق مع نافذة زمنية (±window خطوات)
export function verifyTotp(secret, code, window = 1) {
  if (!secret || !code) return false;
  const c = String(code).replace(/\s+/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  const now = Math.floor(Date.now() / 1000);
  for (let i = -window; i <= window; i++) {
    if (totpAt(secret, now + i * 30) === c) return true;
  }
  return false;
}

// توليد رمز TOTP الحالي لسرّ معيّن (يُستخدم في الاختبارات والعروض)
export function currentTotp(secret) {
  return totpAt(secret, Math.floor(Date.now() / 1000));
}

export function otpauthUri(label, secret, issuer = 'MK') {
  const l = encodeURIComponent(label);
  const is = encodeURIComponent(issuer);
  return `otpauth://totp/${is}:${l}?secret=${secret}&issuer=${is}&algorithm=SHA1&digits=6&period=30`;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// توليد أكواد استرداد بصيغة XXXX-XXXX (تُخزَّن مجزأة بشفرة)
export function generateRecoveryCodes(count = 6) {
  const plain = [];
  const hashed = [];
  for (let i = 0; i < count; i++) {
    const h = crypto.randomBytes(4).toString('hex').toUpperCase();
    const code = `${h.slice(0, 4)}-${h.slice(4)}`;
    plain.push(code);
    hashed.push(sha256(code));
  }
  return { plain, hashed: JSON.stringify(hashed) };
}

// ======= الحد من معدل الطلبات (Rate Limiting) =======

// عدّادات إحصائية للمراقبة (قابل للقراءة من مركز الأمان)
const rateStats = {
  blocked: 0,
  blockedByKey: new Map(),
};

export function getRateStats() {
  return {
    blocked: rateStats.blocked,
    recent: [...rateStats.blockedByKey.entries()].slice(-20).map(([k, n]) => ({ key: k, n })),
  };
}

// كل حالة rateLimit تملك عدادها المعزول (لا تتداخل الحالات في نفس المفتاح)
export function rateLimit({ windowMs = 60000, max = 120, keyFn } = {}) {
  const buckets = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, arr] of buckets) {
      const live = arr.filter((t) => now - t < windowMs);
      if (live.length === 0) buckets.delete(k);
      else buckets.set(k, live);
    }
  }, 600000);
  if (typeof cleanup.unref === 'function') cleanup.unref();
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : (req.ip || 'unknown');
    const now = Date.now();
    const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      rateStats.blocked += 1;
      const short = key.length > 40 ? key.slice(0, 40) : key;
      rateStats.blockedByKey.set(short, (rateStats.blockedByKey.get(short) || 0) + 1);
      const retryAfter = Math.max(1, Math.ceil((arr[0] + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'طلبات كثيرة جداً، حاول بعد قليل' });
    }
    arr.push(now);
    buckets.set(key, arr);
    next();
  };
}