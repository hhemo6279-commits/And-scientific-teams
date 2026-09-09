import { Router } from 'express';
import db from '../db.js';
import { notify } from '../auth.js';
import { isFeatureEnabled } from '../settings.js';

const router = Router();

const TYPE_LABELS = {
  conference: 'مؤتمر',
  workshop: 'ورشة عمل',
  seminar: 'ندوة',
  training: 'تدريب',
  competition: 'مسابقة',
  activity: 'نشاط',
};

function withStatus(o) {
  const now = Date.now();
  const start = o.starts_at ? new Date(o.starts_at.replace(' ', 'T') + 'Z').getTime() : null;
  const end = o.ends_at ? new Date(o.ends_at.replace(' ', 'T') + 'Z').getTime() : null;
  let status = 'upcoming';
  if (start && now >= start) status = 'live';
  if (end && now >= end) status = 'ended';
  return { ...o, status };
}

// قائمة الفعاليات المتاحة + تسجيلاتي
router.get('/', (req, res) => {
  if (!isFeatureEnabled('events')) return res.json({ events: [], disabled: true });
  const events = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) AS registered_count
    FROM events e WHERE e.active = 1 ORDER BY e.starts_at IS NULL, e.starts_at ASC
  `).all();
  const myRows = db.prepare(`
    SELECT er.event_id, er.attended, er.created_at FROM event_registrations er
    WHERE er.user_id = ? AND er.event_id IN (${events.length ? events.map(() => '?').join(',') : 'NULL'})
  `).all(req.user.id, ...events.map((e) => e.id));
  const myMap = Object.fromEntries(myRows.map((r) => [r.event_id, r]));
  res.json({
    events: events.map((e) => ({ ...withStatus(e), type_label: TYPE_LABELS[e.type] || e.type, my_registration: myMap[e.id] || null })),
  });
});

// تفاصيل فعالية
router.get('/:id', (req, res) => {
  const ev = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) AS registered_count
    FROM events e WHERE e.id = ?
  `).get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'الفعالية غير موجودة' });
  const my = db.prepare('SELECT * FROM event_registrations WHERE event_id = ? AND user_id = ?').get(ev.id, req.user.id);
  res.json({ event: { ...withStatus(ev), type_label: TYPE_LABELS[ev.type] || ev.type }, my_registration: my });
});

// تسجيل في فعالية
router.post('/:id/register', (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND active = 1').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'الفعالية غير موجودة' });
  if (ev.starts_at && new Date(ev.starts_at.replace(' ', 'T') + 'Z') < new Date()) {
    return res.status(400).json({ error: 'انتهت الفعالية، لا يمكن التسجيل الآن' });
  }
  const registered = db.prepare('SELECT COUNT(*) AS n FROM event_registrations WHERE event_id = ?').get(ev.id).n;
  if (registered >= ev.capacity) return res.status(400).json({ error: 'المقاعد ممتلئة في هذه الفعالية' });
  try {
    db.prepare('INSERT INTO event_registrations (event_id, user_id) VALUES (?,?)').run(ev.id, req.user.id);
  } catch {
    return res.status(400).json({ error: 'أنت مسجل في هذه الفعالية مسبقاً' });
  }
  notify(req.user.id, '🎟️ تأكيد التسجيل', `سُجّلت في الفعالية: ${ev.title}`);
  res.json({ ok: true });
});

// إلغاء التسجيل
router.delete('/:id/register', (req, res) => {
  db.prepare('DELETE FROM event_registrations WHERE event_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// فعالياتي (التسجيلات)
router.get('/mine/registrations', (req, res) => {
  const rows = db.prepare(`
    SELECT er.*, e.title, e.type, e.location, e.starts_at, e.ends_at
    FROM event_registrations er JOIN events e ON e.id = er.event_id
    WHERE er.user_id = ? ORDER BY e.starts_at IS NULL, e.starts_at ASC
  `).all(req.user.id);
  res.json({ registrations: rows.map((r) => ({ ...r, type_label: TYPE_LABELS[r.type] || r.type })) });
});

export default router;