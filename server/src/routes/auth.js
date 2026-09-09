import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { issueSession, revokeSession, revokeAllSessions, audit, requireAuth, signToken } from '../auth.js';
import { generateTotpSecret, verifyTotp, otpauthUri, generateRecoveryCodes, sha256 } from '../security.js';
import { isRegistrationOpen, checkPasswordPolicy, getSetting } from '../settings.js';

const router = Router();
const SECRET = process.env.JWT_SECRET || 'mk-platform-secret-change-me';

// بيانات الجهاز/IP لتسجيلها في الجلسة
function deviceMeta(req) {
  return {
    device: (req.headers['user-agent'] || 'غير معروف').slice(0, 200),
    ip: (req.headers['x-forwarded-for'] || req.ip || '').toString().slice(0, 60),
  };
}

router.post('/register', (req, res) => {
  if (!isRegistrationOpen()) return res.status(403).json({ error: 'التسجيل مغلق حالياً، تواصل مع الإدارة' });
  const { name, email, password, section_id } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'البيانات ناقصة' });
  const pwCheck = checkPasswordPolicy(password);
  if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.errors[0] });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(400).json({ error: 'البريد مستخدم مسبقاً' });
  if (section_id) {
    const sec = db.prepare('SELECT id FROM sections WHERE id = ?').get(section_id);
    if (!sec) return res.status(400).json({ error: 'القسم غير موجود' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare("INSERT INTO users (name, email, password_hash, role, section_id) VALUES (?,?,?,'student',?)")
    .run(name, email, hash, section_id || null);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  audit(user.id, 'تسجيل حساب جديد');
  res.json(issueSession(user, deviceMeta(req)));
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  const failedDetails = String(email || '').toLowerCase() + ' | ' + deviceMeta(req).ip;
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    audit(user?.id || null, 'محاولة تسجيل دخول فاشلة', failedDetails);
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  }
  if (!user.active) return res.status(403).json({ error: 'الحساب معطّل، تواصل مع الإدارة' });
  audit(user.id, 'تسجيل دخول');
  // سياسة MFA: الادمن مطالب بتفعيل المصادقة الثنائية (إذا كانت السياسة مفعلة)
  if (getSetting('mfa_required_for_admins') === '1' && user.role !== 'student' && !user.mfa_enabled) {
    return res.status(403).json({ error: 'سياسة المنصة تفرض المصادقة الثنائية على الأدمن. فعّلها من إعدادات الملف الشخصي عبر حساب ادمن مفعّل أولاً.' });
  }
  if (user.mfa_enabled) {
    // الخطوة الأولى فقط: نطلب رمز المصادقة الثنائية
    const mfaToken = jwt.sign({ id: user.id, purpose: 'mfa' }, SECRET, { expiresIn: '10m' });
    return res.json({ requiresMfa: true, mfaToken, user: { id: user.id, name: user.name, email: user.email } });
  }
  res.json(issueSession(user, deviceMeta(req)));
});

// تأكيد رمز المصادقة الثنائية بعد الخطوة الأولى
router.post('/mfa/login', (req, res) => {
  const { mfaToken, code } = req.body || {};
  if (!mfaToken || !code) return res.status(400).json({ error: 'بيانات ناقصة' });
  let payload;
  try {
    payload = jwt.verify(mfaToken, SECRET);
  } catch {
    return res.status(401).json({ error: 'انتهت مهلة التأكيد، أعد تسجيل الدخول' });
  }
  if (payload.purpose !== 'mfa') return res.status(401).json({ error: 'رمز غير صالح' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
  if (!user || !user.active) return res.status(403).json({ error: 'الحساب معطّل' });
  if (!user.mfa_enabled) return res.status(400).json({ error: 'المصادقة الثنائية غير مفعلة' });

  const c = String(code).replace(/\s+/g, '').toUpperCase();
  let valid = verifyTotp(user.mfa_secret, c);
  if (!valid && user.mfa_recovery) {
    // كود استرداد: تحقق ثم ألغيه وأعد للحساب
    const codes = JSON.parse(user.mfa_recovery);
    const idx = codes.indexOf(sha256(c));
    if (idx !== -1) {
      codes.splice(idx, 1);
      db.prepare('UPDATE users SET mfa_recovery = ? WHERE id = ?').run(JSON.stringify(codes), user.id);
      valid = true;
    }
  }
  if (!valid) return res.status(401).json({ error: 'رمز خاطئ' });
  audit(user.id, 'تسجيل دخول مع مصادقة ثنائية');
  res.json(issueSession(user, deviceMeta(req)));
});

// ======= إعداد المصادقة الثنائية (مطلوب تسجيل الدخول) =======
router.post('/mfa/setup', requireAuth, (req, res) => {
  const secret = generateTotpSecret();
  db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ?').run(secret, req.user.id);
  res.json({ secret, uri: otpauthUri(req.user.email, secret) });
});

// تفعيل المصادقة الثنائية بعد التأكد من الرمز
router.post('/mfa/enable', requireAuth, (req, res) => {
  const { code } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.mfa_secret) return res.status(400).json({ error: 'ابدأ بإعداد المصادقة أولاً' });
  if (!verifyTotp(user.mfa_secret, code)) return res.status(401).json({ error: 'رمز خاطئ' });
  const { plain, hashed } = generateRecoveryCodes();
  db.prepare('UPDATE users SET mfa_enabled = 1, mfa_recovery = ? WHERE id = ?').run(hashed, user.id);
  audit(user.id, 'تفعيل المصادقة الثنائية');
  res.json({ ok: true, recoveryCodes: plain });
});

// إلغاء المصادقة الثنائية
router.post('/mfa/disable', requireAuth, (req, res) => {
  const { code } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.mfa_enabled) return res.status(400).json({ error: 'المصادقة الثنائية غير مفعلة' });
  if (!verifyTotp(user.mfa_secret, code)) return res.status(401).json({ error: 'رمز خاطئ' });
  db.prepare('UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_recovery = NULL WHERE id = ?').run(user.id);
  audit(user.id, 'إلغاء المصادقة الثنائية');
  res.json({ ok: true });
});

// ======= إدارة الجلسات =======
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(401).json({ error: 'لا توجد جلسة' });
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(sha256(refreshToken));
  if (!row || row.revoked) return res.status(401).json({ error: 'جلسة غير صالحة' });
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(row.id);
    return res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول مجدداً' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id);
  if (!user || !user.active) return res.status(401).json({ error: 'الحساب غير مفعل' });
  // تدوير التوكن: إلغاء القديم وإصدار جديد
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(row.id);
  audit(user.id, 'تجديد الجلسة');
  res.json(issueSession(user, deviceMeta(req)));
});

// تسجيل الخروج: إلغاء التوكن الحالي + إبطال كل توكنات الوصول القديمة
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.json({ ok: true });
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(sha256(refreshToken));
  if (row) {
    revokeAllSessions(row.user_id);
    audit(row.user_id, 'تسجيل خروج');
  }
  res.json({ ok: true });
});

// تغيير كلمة المرور (يبطّل كل الجلسات السابقة ويعيد إصدار جلسة جديدة)
router.post('/change-password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'البيانات ناقصة' });
  if (!bcrypt.compareSync(String(oldPassword), req.user.password_hash)) {
    return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }
  const pwCheck = checkPasswordPolicy(newPassword);
  if (!pwCheck.ok) return res.status(400).json({ error: pwCheck.errors[0] });
  if (oldPassword === newPassword) return res.status(400).json({ error: 'كلمة المرور الجديدة مطابقة للقديمة' });
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').run(hash, req.user.id);
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(req.user.id);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  audit(req.user.id, 'تغيير كلمة المرور');
  res.json({ ok: true, ...issueSession(fresh) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

// ما إذا كان الحساب يملك مصادقة ثنائية
router.get('/mfa/status', requireAuth, (req, res) => {
  res.json({ enabled: !!req.user.mfa_enabled });
});

// ======= تسجيل الدخول عبر Google (Google Identity Services) =======
async function verifyGoogleCredential(credential) {
  if (!credential) return null;
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) throw new Error('فشل التحقق من توكن Google');
  return res.json();
}

router.post('/google', async (req, res) => {
  const { credential, section_id } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'بيانات Google ناقصة' });
  try {
    const info = await verifyGoogleCredential(credential);
    if (!info || !info.email || info.email_verified !== 'true') {
      return res.status(401).json({ error: 'تعذر التحقق من حساب Google' });
    }
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && info.aud && info.aud !== clientId) {
      return res.status(401).json({ error: 'التطبيق غير مصرح له' });
    }
    const email = String(info.email).toLowerCase();
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
      || (info.sub ? db.prepare('SELECT * FROM users WHERE google_sub = ?').get(info.sub) : null);

    if (user) {
      if (!user.active) return res.status(403).json({ error: 'الحساب معطّل، تواصل مع الإدارة' });
      audit(user.id, 'تسجيل دخول عبر Google');
      if (user.mfa_enabled) {
        const mfaToken = jwt.sign({ id: user.id, purpose: 'mfa' }, SECRET, { expiresIn: '10m' });
        return res.json({ requiresMfa: true, mfaToken, user: { id: user.id, name: user.name, email: user.email } });
      }
      return res.json(issueSession(user, deviceMeta(req)));
    }

    // حساب جديد: إنشاء مستخدم من بيانات Google
    const randomPassword = crypto.randomBytes(24).toString('hex');
    const hash = bcrypt.hashSync(randomPassword, 10);
    const sectionId = section_id ? Number(section_id) : null;
    if (sectionId) {
      const sec = db.prepare('SELECT id FROM sections WHERE id = ?').get(sectionId);
      if (!sec) return res.status(400).json({ error: 'القسم غير موجود' });
    }
    const name = info.name || email.split('@')[0] || 'مستخدم Google';
    const inserted = db.prepare("INSERT INTO users (name, email, password_hash, role, section_id, google_sub, avatar) VALUES (?,?,?,'student',?,?,?)")
      .run(name, email, hash, sectionId, info.sub || null, info.picture || '👤');
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(inserted.lastInsertRowid);
    audit(user.id, 'تسجيل حساب جديد عبر Google');
    res.json({ ...issueSession(user, deviceMeta(req)), created: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'خطأ في تسجيل الدخول عبر Google' });
  }
});

export default router;