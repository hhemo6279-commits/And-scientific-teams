import { Router } from 'express';
import db from '../db.js';
import { notify, audit, listSessions, revokeSessionById } from '../auth.js';
import { levelInfo } from '../levels.js';
import { getPublicKey, subscribePush, unsubscribePush } from '../push.js';
import { getAllSettings, flagsMap } from '../settings.js';

const router = Router();

// إعدادات ظاهرة للطلاب (اسم المنصة + مفاتيح الميزات)
router.get('/settings', (req, res) => {
  const s = getAllSettings();
  res.json({
    site_name: s.site_name || 'منصة MK التعليمية',
    registration_open: s.registration_open !== '0',
    featureFlags: flagsMap(),
  });
});

// إدارة الجلسات النشطة
router.get('/sessions', (req, res) => {
  res.json({ sessions: listSessions(req.user.id) });
});

router.post('/sessions/:id/revoke', (req, res) => {
  const ok = revokeSessionById(req.user.id, req.params.id);
  if (!ok) return res.status(404).json({ error: 'الجلسة غير موجودة' });
  audit(req.user.id, 'إلغاء جلسة', `session #${req.params.id}`);
  res.json({ ok: true });
});

// ======= إشعارات الدفع (Push) =======
router.get('/push/key', (req, res) => {
  res.json({ key: getPublicKey() });
});

router.post('/push/subscribe', (req, res) => {
  subscribePush(req.user.id, req.body.subscription);
  res.json({ ok: true });
});

router.post('/push/unsubscribe', (req, res) => {
  unsubscribePush(req.user.id, req.body.endpoint);
  res.json({ ok: true });
});

// الملف الشخصي للطالب
router.get('/profile', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  const enrollments = db.prepare(`
    SELECT e.*, c.title AS course_title, s.name AS section_name, s.icon AS section_icon
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    JOIN sections s ON s.id = c.section_id
    WHERE e.user_id = ?
    ORDER BY e.enrolled_at DESC
  `).all(user.id);

  const certificates = db.prepare(`
    SELECT cert.*, c.title AS course_title FROM certificates cert
    JOIN courses c ON c.id = cert.course_id
    WHERE cert.user_id = ?
  `).all(user.id);

  const solved = db.prepare(`
    SELECT ch.title, ch.points FROM challenge_submissions cs
    JOIN challenges ch ON ch.id = cs.challenge_id
    WHERE cs.user_id = ? AND cs.solved = 1
  `).all(user.id);

  const badges = db.prepare(`
    SELECT b.*, ub.earned_at FROM user_badges ub
    JOIN badges b ON b.id = ub.badge_id
    WHERE ub.user_id = ? ORDER BY ub.earned_at DESC
  `).all(user.id);

  res.json({
    profile: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      points: user.points,
      created_at: user.created_at,
      level: levelInfo(user.points),
      section: user.section_id ? db.prepare('SELECT id, name, icon, color FROM sections WHERE id = ?').get(user.section_id) : null,
    },
    enrollments,
    certificates,
    solved,
    badges,
    stats: {
      coursesDone: enrollments.filter((e) => e.completed).length,
      certificates: certificates.length,
      challengesSolved: solved.length,
    },
  });
});

// الإشعارات
router.get('/notifications', (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0').get(req.user.id).n;
  res.json({ notifications: rows, unread });
});

router.post('/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.post('/notifications/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(req.user.id);
  res.json({ ok: true });
});

// ======= الرسائل الخاصة =======
// قائمة المحادثات مع عدد غير المقروء
router.get('/conversations', (req, res) => {
  const rows = db.prepare(`
    SELECT
      CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END AS other_id,
      u.name AS other_name,
      u.avatar AS other_avatar,
      (SELECT content FROM messages x
        WHERE (x.sender_id = m.sender_id AND x.recipient_id = m.recipient_id)
           OR (x.sender_id = m.recipient_id AND x.recipient_id = m.sender_id)
        ORDER BY x.id DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM messages x
        WHERE (x.sender_id = m.sender_id AND x.recipient_id = m.recipient_id)
           OR (x.sender_id = m.recipient_id AND x.recipient_id = m.sender_id)
        ORDER BY x.id DESC LIMIT 1) AS last_at,
      (SELECT COUNT(*) FROM messages x
        WHERE x.sender_id = m.recipient_id AND x.recipient_id = ? AND x.read = 0) AS unread
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END
    WHERE m.sender_id = ? OR m.recipient_id = ?
    GROUP BY other_id
    ORDER BY last_at DESC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
  const unreadTotal = db.prepare('SELECT COUNT(*) AS n FROM messages WHERE recipient_id = ? AND read = 0').get(req.user.id).n;
  res.json({ conversations: rows, unreadTotal });
});

// محادثة مع مستخدم معين
router.get('/conversations/:userId', (req, res) => {
  const other = db.prepare('SELECT id, name, avatar FROM users WHERE id = ?').get(req.params.userId);
  if (!other) return res.status(404).json({ error: 'المستخدم غير موجود' });
  const msgs = db.prepare(`
    SELECT * FROM messages
    WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
    ORDER BY id ASC LIMIT 200
  `).all(req.user.id, other.id, other.id, req.user.id);
  // تعليم الرسائل الواردة كمقروءة
  db.prepare('UPDATE messages SET read = 1 WHERE sender_id = ? AND recipient_id = ?').run(other.id, req.user.id);
  res.json({ other, messages: msgs });
});

// إرسال رسالة
router.post('/conversations/:userId', (req, res) => {
  const content = String((req.body || {}).content || '').trim();
  if (!content) return res.status(400).json({ error: 'الرسالة فارغة' });
  const other = db.prepare('SELECT id, role, active FROM users WHERE id = ?').get(req.params.userId);
  if (!other || !other.active) return res.status(404).json({ error: 'المستخدم غير موجود' });
  if (Number(other.id) === req.user.id) return res.status(400).json({ error: 'لا يمكنك مراسلة نفسك' });
  const info = db.prepare('INSERT INTO messages (sender_id, recipient_id, content) VALUES (?,?,?)').run(req.user.id, other.id, content);
  const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);
  notify(other.id, '💬 رسالة جديدة', `لديك رسالة جديدة من ${req.user.name}`);
  res.json({ message: msg });
});

// قائمة المستخدمين القابلين للمراسلة (لبدء محادثة)
router.get('/users', (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, avatar, role FROM users
    WHERE id != ? AND active = 1
    ORDER BY name LIMIT 50
  `).all(req.user.id);
  res.json({ users: rows });
});

// قائمة الترتيب حسب النقاط
router.get('/leaderboard', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.avatar, u.points,
      (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.completed = 1) AS courses_done,
      (SELECT COUNT(*) FROM challenge_submissions cs WHERE cs.user_id = u.id AND cs.solved = 1) AS challenges_solved
    FROM users u
    WHERE u.role = 'student' AND u.active = 1
    ORDER BY u.points DESC, courses_done DESC
    LIMIT 100
  `).all();
  res.json({ leaderboard: rows.map((r, i) => ({ ...r, rank: i + 1, level: levelInfo(r.points) })) });
});

// الإعلانات للطلاب
router.get('/announcements', (req, res) => {
  const rows = db.prepare('SELECT a.*, u.name AS user_name FROM announcements a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 10').all();
  res.json({ announcements: rows });
});

// البحث في المنصة
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ courses: [], sections: [] });
  const like = `%${q}%`;
  const courses = db.prepare(`
    SELECT c.*, s.name AS section_name, s.icon AS section_icon
    FROM courses c JOIN sections s ON s.id = c.section_id
    WHERE c.active = 1 AND (c.title LIKE ? OR c.description LIKE ?)
    LIMIT 20
  `).all(like, like);
  const sections = db.prepare('SELECT * FROM sections WHERE active = 1 AND (name LIKE ? OR description LIKE ?) LIMIT 10').all(like, like);
  res.json({ courses, sections });
});

// ======= الجدول الزمني والتذكيرات =======
// جدول الطالب: الأحداث العامة + أحداث قسمه + أحداث دوره
router.get('/schedule', (req, res) => {
  const user = db.prepare('SELECT section_id FROM users WHERE id = ?').get(req.user.id);
  const enrolledCourses = db.prepare('SELECT course_id FROM enrollments WHERE user_id = ?').all(req.user.id).map((r) => r.course_id);
  const sectionId = user.section_id || 0;
  const items = db.prepare(`
    SELECT si.*, s.name AS section_name, c.title AS course_title
    FROM schedule_items si
    LEFT JOIN sections s ON s.id = si.section_id
    LEFT JOIN courses c ON c.id = si.course_id
    WHERE si.section_id IS NULL OR si.section_id = ?
      OR (si.course_id IS NOT NULL AND si.course_id IN (${enrolledCourses.length ? enrolledCourses.map(() => '?').join(',') : 'NULL'}))
    ORDER BY si.starts_at
  `).all(...[sectionId, ...enrolledCourses]);
  // حساب عدد الساعات المتبقية لكل حدث
  const now = Date.now();
  const withCountdown = items.map((it) => {
    const start = new Date(it.starts_at.replace(' ', 'T') + 'Z').getTime();
    return { ...it, hoursLeft: Math.round((start - now) / 3600000) };
  });
  res.json({ items: withCountdown });
});

// إشعار تذكير بحدث قادم (يسجل أنه تم التذكير)
router.post('/schedule/:id/remind', (req, res) => {
  const item = db.prepare('SELECT * FROM schedule_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'الحدث غير موجود' });
  try {
    db.prepare('INSERT INTO schedule_reminders (schedule_id, user_id) VALUES (?,?)').run(item.id, req.user.id);
    notify(req.user.id, '⏰ تذكير', `لا تنسَ: ${item.title}`);
    res.json({ ok: true });
  } catch {
    res.json({ ok: false, message: 'تم التذكير مسبقاً' });
  }
});

export default router;
