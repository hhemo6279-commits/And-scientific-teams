import { Router } from 'express';
import db from '../db.js';
import { notify } from '../auth.js';
import { isFeatureEnabled } from '../settings.js';

const router = Router();

const TYPE_LABELS = {
  room: 'قاعة',
  lab: 'مختبر',
  equipment: 'معدة',
  device: 'جهاز',
  training: 'مورد تدريبي',
};

function norm(dt) {
  if (!dt) return null;
  return String(dt).replace('T', ' ').slice(0, 19);
}

function conflicts(resourceId, from, until, excludeId = null) {
  let rows;
  if (excludeId) {
    rows = db.prepare(`
      SELECT id FROM resource_bookings
      WHERE resource_id = ? AND status IN ('pending','approved')
        AND booked_from IS NOT NULL AND booked_until IS NOT NULL
        AND date(booked_until) >= date(?) AND date(booked_from) <= date(?)
        AND time(booked_until) > time(?) AND time(booked_from) < time(?)
        AND id != ?
    `).all(resourceId, from, until, from, until, excludeId);
  } else {
    rows = db.prepare(`
      SELECT id FROM resource_bookings
      WHERE resource_id = ? AND status IN ('pending','approved')
        AND booked_from IS NOT NULL AND booked_until IS NOT NULL
        AND date(booked_until) >= date(?) AND date(booked_from) <= date(?)
        AND time(booked_until) > time(?) AND time(booked_from) < time(?)
    `).all(resourceId, from, until, from, until);
  }
  return rows.length > 0;
}

function withType(r) {
  return { ...r, type_label: TYPE_LABELS[r.type] || r.type };
}

// قائمة المرافق المتاحة
router.get('/', (req, res) => {
  if (!isFeatureEnabled('resources')) return res.json({ resources: [], disabled: true });
  const resources = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM resource_bookings rb
       WHERE rb.resource_id = r.id AND rb.status = 'approved' AND date(rb.booked_until) >= date('now')) AS active_bookings
    FROM resources r WHERE r.active = 1 ORDER BY r.id
  `).all();
  res.json({ resources: resources.map(withType) });
});

// تفاصيل مرافق + حجوزاتي عليه
router.get('/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM resources WHERE id = ? AND active = 1').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'المرافق غير موجود' });
  const my = db.prepare('SELECT * FROM resource_bookings WHERE resource_id = ? AND user_id = ? ORDER BY id DESC LIMIT 20').all(r.id, req.user.id);
  res.json({ resource: withType(r), my_bookings: my });
});

// حجز مرافق
router.post('/:id/book', (req, res) => {
  const r = db.prepare('SELECT * FROM resources WHERE id = ? AND active = 1').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'المرافق غير موجود' });
  const { from, until, purpose } = req.body || {};
  if (!from || !until) return res.status(400).json({ error: 'حدد وقت البداية والنهاية' });
  if (new Date(norm(until).replace(' ', 'T') + 'Z') <= new Date(norm(from).replace(' ', 'T') + 'Z')) {
    return res.status(400).json({ error: 'وقت النهاية يجب أن يكون بعد البداية' });
  }
  if (conflicts(r.id, norm(from), norm(until))) {
    return res.status(400).json({ error: 'هذه الفترة محجوزة مسبقاً — اختر فترة أخرى' });
  }
  const status = r.requires_approval ? 'pending' : 'approved';
  const info = db.prepare(`
    INSERT INTO resource_bookings (resource_id, user_id, purpose, booked_from, booked_until, status)
    VALUES (?,?,?,?,?,?)
  `).run(r.id, req.user.id, purpose || '', norm(from), norm(until), status);
  if (r.requires_approval) {
    notify(req.user.id, '📋 حجز بانتظار الموافقة', `تم إرسال طلب حجز «${r.name}» للمراجعة.`);
  } else {
    notify(req.user.id, '✅ تم تأكيد الحجز', `حجزت «${r.name}» بنجاح.`);
  }
  res.json({ ok: true, id: info.lastInsertRowid, status });
});

// إلغاء حجزي (قبل اكتماله)
router.delete('/bookings/:bid', (req, res) => {
  const b = db.prepare('SELECT * FROM resource_bookings WHERE id = ? AND user_id = ?').get(req.params.bid, req.user.id);
  if (!b) return res.status(404).json({ error: 'الحجز غير موجود' });
  if (b.status === 'completed') return res.status(400).json({ error: 'لا يمكن إلغاء حجز مكتمل' });
  db.prepare("UPDATE resource_bookings SET status = 'cancelled' WHERE id = ?").run(b.id);
  res.json({ ok: true });
});

// حجوزاتي
router.get('/mine/bookings', (req, res) => {
  const rows = db.prepare(`
    SELECT rb.*, r.name AS resource_name, r.type, r.location
    FROM resource_bookings rb JOIN resources r ON r.id = rb.resource_id
    WHERE rb.user_id = ? ORDER BY rb.id DESC LIMIT 50
  `).all(req.user.id);
  res.json({ bookings: rows.map(withType) });
});

export default router;