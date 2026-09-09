import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { getSubAdminSections, awardXP } from '../auth.js';
import { isFeatureEnabled } from '../settings.js';

const router = Router();

// قائمة قاعات البث
router.get('/', (req, res) => {
  if (!isFeatureEnabled('live')) return res.json({ rooms: [], disabled: true });
  const rooms = db.prepare(`
    SELECT r.*, u.name AS host_name, c.title AS course_title
    FROM live_rooms r
    LEFT JOIN users u ON u.id = r.host_id
    LEFT JOIN courses c ON c.id = r.course_id
    ORDER BY r.id DESC
  `).all();
  res.json({ rooms });
});

// إنشاء قاعة بث
router.post('/', (req, res) => {
  const { course_id, title, scheduled_at } = req.body || {};
  if (!title) return res.status(400).json({ error: 'العنوان مطلوب' });
  const token = crypto.randomBytes(16).toString('hex');
  const info = db.prepare('INSERT INTO live_rooms (course_id, title, host_id, scheduled_at, token) VALUES (?,?,?,?,?)')
    .run(course_id || null, title, req.user.id, scheduled_at || null, token);
  res.json({ ok: true, id: info.lastInsertRowid, token });
});

// دخول قاعة (يولد رمز دخول مؤقت بصلاحية المضيف/مشاهد) ويسجل الحضور
router.post('/:id/join', (req, res) => {
  const room = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'القاعة غير موجودة' });
  const isHost = room.host_id === req.user.id || req.user.role === 'main_admin';
  const joinToken = crypto.randomBytes(24).toString('hex');
  // تسجيل الحضور والعد فقط عند الدخول الأول (لا يُضخَّم الرقم بإعادة الدخول)
  let newCount = room.participant_count;
  const existingAtt = db.prepare('SELECT id FROM live_attendance WHERE room_id = ? AND user_id = ?').get(room.id, req.user.id);
  if (!existingAtt) {
    db.prepare('INSERT INTO live_attendance (room_id, user_id) VALUES (?,?)').run(room.id, req.user.id);
    db.prepare('UPDATE live_rooms SET participant_count = participant_count + 1 WHERE id = ?').run(room.id);
    newCount = room.participant_count + 1;
    awardXP(req.user.id, 10, `حضرت الجلسة "${room.title}"`);
  }
  res.json({ joinToken, isHost, room: { ...room, participant_count: newCount } });
});

// إنهاء القاعة
router.post('/:id/end', (req, res) => {
  const room = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'غير موجود' });
  if (room.host_id !== req.user.id && req.user.role !== 'main_admin' && req.user.role !== 'sub_admin') return res.status(403).json({ error: 'غير مصرح' });
  db.prepare("UPDATE live_rooms SET status = 'ended' WHERE id = ?").run(room.id);
  res.json({ ok: true });
});

// تقرير الحضور (المضيف أو الأدمن)
router.get('/:id/attendance', (req, res) => {
  const room = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'القاعة غير موجودة' });
  if (room.host_id !== req.user.id && req.user.role !== 'main_admin' && req.user.role !== 'sub_admin') return res.status(403).json({ error: 'غير مصرح' });
  const attendees = db.prepare(`
    SELECT la.*, u.name AS user_name, u.email FROM live_attendance la
    JOIN users u ON u.id = la.user_id
    WHERE la.room_id = ? ORDER BY la.joined_at
  `).all(room.id);
  res.json({ room: { id: room.id, title: room.title }, attendees, count: attendees.length });
});

// حذف قاعة (الأدمن)
router.delete('/:id', (req, res) => {
  const room = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'غير موجود' });
  if (req.user.role !== 'main_admin' && req.user.role !== 'sub_admin') return res.status(403).json({ error: 'غير مصرح' });
  db.prepare('DELETE FROM live_rooms WHERE id = ?').run(room.id);
  res.json({ ok: true });
});

// تحديث حالة قاعة (الأدمن) - إلغاء جدولة/بدء
router.put('/:id', (req, res) => {
  const room = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'غير موجود' });
  if (req.user.role !== 'main_admin' && req.user.role !== 'sub_admin') return res.status(403).json({ error: 'غير مصرح' });
  const { status, title, scheduled_at } = req.body || {};
  db.prepare('UPDATE live_rooms SET status = ?, title = ?, scheduled_at = ? WHERE id = ?')
    .run(status || room.status, title || room.title, scheduled_at ?? room.scheduled_at, room.id);
  res.json({ ok: true });
});

// ======= تفاعل قاعة البث =======
// جلب رسائل الدردشة
router.get('/:id/chat', (req, res) => {
  const room = db.prepare('SELECT id FROM live_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'القاعة غير موجودة' });
  const rows = db.prepare(`
    SELECT c.id, c.message, c.created_at, u.name AS user_name, u.avatar
    FROM live_chat c JOIN users u ON u.id = c.user_id
    WHERE c.room_id = ? ORDER BY c.id DESC LIMIT 100
  `).all(room.id).reverse();
  res.json({ messages: rows });
});

// إرسال رسالة في الدردشة
router.post('/:id/chat', (req, res) => {
  const room = db.prepare('SELECT id FROM live_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'القاعة غير موجودة' });
  const message = String((req.body || {}).message || '').trim();
  if (!message) return res.status(400).json({ error: 'الرسالة فارغة' });
  const info = db.prepare('INSERT INTO live_chat (room_id, user_id, message) VALUES (?,?,?)').run(room.id, req.user.id, message);
  res.json({ ok: true, id: info.lastInsertRowid });
});

// ردود الفعل (مثل 👍 ❤️ 👏)
router.post('/:id/reactions', (req, res) => {
  const room = db.prepare('SELECT id FROM live_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'القاعة غير موجودة' });
  const emoji = String((req.body || {}).emoji || '👍');
  db.prepare('INSERT INTO live_reactions (room_id, user_id, emoji) VALUES (?,?,?)').run(room.id, req.user.id, emoji);
  res.json({ ok: true });
});

// عدّادات ردود الفعل الحية
router.get('/:id/reactions', (req, res) => {
  const room = db.prepare('SELECT id FROM live_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'القاعة غير موجودة' });
  const rows = db.prepare(`
    SELECT emoji, COUNT(*) AS n FROM live_reactions
    WHERE room_id = ? AND created_at >= datetime('now', '-5 minutes')
    GROUP BY emoji ORDER BY n DESC
  `).all(room.id);
  res.json({ reactions: rows });
});

// رفع اليد / إنزالها
router.post('/:id/hand', (req, res) => {
  const room = db.prepare('SELECT id FROM live_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'القاعة غير موجودة' });
  const active = (req.body || {}).active === false ? 0 : 1;
  db.prepare(`
    INSERT INTO live_hands (room_id, user_id, active) VALUES (?,?,?)
    ON CONFLICT(room_id, user_id) DO UPDATE SET active = excluded.active
  `).run(room.id, req.user.id, active);
  res.json({ ok: true });
});

// قائمة الأيدي المرفوعة (للمضيف)
router.get('/:id/hands', (req, res) => {
  const room = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'القاعة غير موجودة' });
  if (room.host_id !== req.user.id && req.user.role !== 'main_admin' && req.user.role !== 'sub_admin') return res.status(403).json({ error: 'غير مصرح' });
  const rows = db.prepare(`
    SELECT h.id, u.name AS user_name, u.avatar, h.created_at
    FROM live_hands h JOIN users u ON u.id = h.user_id
    WHERE h.room_id = ? AND h.active = 1 ORDER BY h.created_at
  `).all(room.id);
  res.json({ hands: rows });
});

export default router;
