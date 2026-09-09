import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import db from './db.js';
import { levelInfo } from './levels.js';
import { sendPush } from './push.js';
import { sha256 } from './security.js';
import { getSettingInt } from './settings.js';

const SECRET = process.env.JWT_SECRET || 'mk-platform-secret-change-me';
const REFRESH_DAYS = 30;

export function signToken(user, expiresMin) {
  const ttl = Math.max(5, expiresMin || getSettingInt('session_timeout_minutes', 120));
  return jwt.sign({ id: user.id, role: user.role, tv: user.token_version | 0 }, SECRET, { expiresIn: `${ttl}m` });
}

// إصدار جلسة كاملة: توكن وصول قصير + توكن تحديث مرحّل (يُخزَّن مجزأ)
export function issueSession(user, meta = {}) {
  const token = signToken(user);
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device, ip) VALUES (?,?,?,?,?)')
    .run(user.id, sha256(refreshToken), expiresAt, String(meta.device || '').slice(0, 200), String(meta.ip || '').slice(0, 60));
  return { token, refreshToken, user };
}

// قائمة جلسات المستخدم النشطة (للواجهة/الملف الشخصي)
export function listSessions(userId) {
  return db.prepare(`
    SELECT id, device, ip, created_at, expires_at FROM refresh_tokens
    WHERE user_id = ? AND revoked = 0 AND expires_at > datetime('now')
    ORDER BY id DESC
  `).all(userId);
}

// إلغاء جلسة محددة
export function revokeSessionById(userId, sessionId) {
  const info = db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ? AND user_id = ? AND revoked = 0').run(sessionId, userId);
  return info.changes > 0;
}

export function revokeSession(refreshToken) {
  if (!refreshToken) return;
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(sha256(refreshToken));
}

export function revokeAllSessions(userId) {
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(userId);
  db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(userId);
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'غير مصرح' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!user || !user.active) return res.status(401).json({ error: 'الحساب غير مفعل' });
    // إبطال الجلسات عند تغيير كلمة المرور أو تسجيل الخروج
    if ((payload.tv ?? 0) !== (user.token_version | 0)) {
      return res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول مجدداً' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'جلسة غير صالحة' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'لا تملك صلاحية لهذا الإجراء' });
    next();
  };
}

export function getSubAdminSections(userId) {
  return db.prepare('SELECT section_id FROM sub_admin_sections WHERE user_id = ?').all(userId).map((r) => r.section_id);
}

export function audit(userId, action, details = '') {
  db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?,?,?)').run(userId, action, details);
}

export function notify(userId, title, content = '') {
  db.prepare('INSERT INTO notifications (user_id, title, content) VALUES (?,?,?)').run(userId, title, content);
  sendPush(userId, title, content).catch(() => {});
}

export function awardBadge(userId, badgeKey, extra = '') {
  const badge = db.prepare('SELECT * FROM badges WHERE key = ?').get(badgeKey);
  if (!badge) return;
  const existing = db.prepare('SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?').get(userId, badge.id);
  if (existing) return;
  db.prepare('INSERT INTO user_badges (user_id, badge_id) VALUES (?,?)').run(userId, badge.id);
  notify(userId, `🏅 شارة جديدة: ${badge.name}`, badge.description || extra);
}

// إضافة نقاط خبرة (XP) مع إشعار عند ترقية المستوى
export function awardXP(userId, amount, activity = '') {
  if (!amount || amount <= 0) return;
  const before = db.prepare('SELECT points FROM users WHERE id = ?').get(userId);
  if (!before) return;
  const oldXP = before.points;
  db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(amount, userId);
  const newXP = oldXP + amount;
  const beforeLevel = levelInfo(oldXP).level;
  const afterLevel = levelInfo(newXP).level;
  if (afterLevel > beforeLevel) {
    const info = levelInfo(newXP);
    notify(userId, `⬆️ ترقيت إلى المستوى ${afterLevel}: ${info.icon} ${info.title}`, `وصلت إلى مستوى "${info.title}"! واصل التقدم`);
  } else if (activity) {
    notify(userId, `✨ +${amount} XP`, activity);
  }
}
