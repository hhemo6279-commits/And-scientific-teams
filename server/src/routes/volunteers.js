import { Router } from 'express';
import db from '../db.js';
import { notify } from '../auth.js';
import { isFeatureEnabled } from '../settings.js';

const router = Router();

const TYPE_LABELS = {
  campaign: 'حملة',
  initiative: 'مبادرة',
  activity: 'نشاط',
  relief: 'إغاثة',
};

function withStatus(p) {
  const now = Date.now();
  let status = 'upcoming';
  const start = p.starts_at ? new Date(p.starts_at.replace(' ', 'T') + 'Z').getTime() : null;
  const end = p.ends_at ? new Date(p.ends_at.replace(' ', 'T') + 'Z').getTime() : null;
  if (start && now >= start) status = 'open';
  if (end && now >= end) status = 'ended';
  return { ...p, status };
}

// قائمة البرامج التطوعية + تطوعاتي
router.get('/', (req, res) => {
  if (!isFeatureEnabled('volunteers')) return res.json({ programs: [], disabled: true });
  const programs = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM volunteer_applications va
       WHERE va.program_id = p.id AND va.status IN ('pending','approved','attended','completed')) AS applicants_count
    FROM volunteer_programs p WHERE p.active = 1 ORDER BY p.starts_at IS NULL, p.starts_at ASC
  `).all();
  const myRows = db.prepare(`
    SELECT va.program_id, va.status, va.hours_logged FROM volunteer_applications va
    WHERE va.user_id = ? AND va.program_id IN (${programs.length ? programs.map(() => '?').join(',') : 'NULL'})
  `).all(req.user.id, ...programs.map((p) => p.id));
  const myMap = Object.fromEntries(myRows.map((r) => [r.program_id, r]));
  res.json({
    programs: programs.map((p) => ({ ...withStatus(p), type_label: TYPE_LABELS[p.type] || p.type, my_application: myMap[p.id] || null })),
  });
});

// تفاصيل برنامج
router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM volunteer_programs WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'البرنامج غير موجود' });
  const my = db.prepare('SELECT * FROM volunteer_applications WHERE program_id = ? AND user_id = ?').get(p.id, req.user.id);
  const applicants = db.prepare('SELECT COUNT(*) AS n FROM volunteer_applications WHERE program_id = ? AND status IN (?,?,?,?)').get(p.id, 'pending', 'approved', 'attended', 'completed').n;
  res.json({ program: withStatus(p), my_application: my, applicants_count: applicants });
});

// تقديم للعمل التطوعي
router.post('/:id/apply', (req, res) => {
  const p = db.prepare('SELECT * FROM volunteer_programs WHERE id = ? AND active = 1').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'البرنامج غير موجود' });
  if (p.starts_at && new Date(p.starts_at.replace(' ', 'T') + 'Z') < new Date()) {
    return res.status(400).json({ error: 'انطلق البرنامج بالفعل، لا يمكن التقديم الآن' });
  }
  const spots = db.prepare('SELECT COUNT(*) AS n FROM volunteer_applications WHERE program_id = ? AND status IN (?,?,?,?)').get(p.id, 'pending', 'approved', 'attended', 'completed').n;
  if (spots >= p.spots) return res.status(400).json({ error: 'المقاعد ممتلئة في هذا البرنامج' });
  const { skills, hours_committed } = req.body || {};
  try {
    db.prepare(`
      INSERT INTO volunteer_applications (program_id, user_id, skills, hours_committed)
      VALUES (?,?,?,?)
    `).run(p.id, req.user.id, skills || '', Math.max(1, Number(hours_committed) || 1));
  } catch {
    return res.status(400).json({ error: 'تقدمت لهذا البرنامج مسبقاً' });
  }
  notify(req.user.id, '🤝 طلب تطوع', `أُرسل طلب مشاركتك في «${p.title}» للمراجعة.`);
  res.json({ ok: true });
});

// سحب الطلب
router.delete('/:id/apply', (req, res) => {
  const app = db.prepare('SELECT * FROM volunteer_applications WHERE program_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!app) return res.status(404).json({ error: 'لا يوجد طلب' });
  if (['attended', 'completed'].includes(app.status)) return res.status(400).json({ error: 'لا يمكن سحب طلب بدأ تنفيذه' });
  db.prepare("UPDATE volunteer_applications SET status = 'withdrawn' WHERE id = ?").run(app.id);
  res.json({ ok: true });
});

// سجل التطوع وساعاتي
router.get('/mine/applications', (req, res) => {
  const rows = db.prepare(`
    SELECT va.*, p.title, p.type, p.location, p.starts_at
    FROM volunteer_applications va JOIN volunteer_programs p ON p.id = va.program_id
    WHERE va.user_id = ? ORDER BY va.id DESC LIMIT 100
  `).all(req.user.id);
  const totals = rows.filter((r) => ['attended', 'completed'].includes(r.status));
  res.json({
    applications: rows.map((r) => ({ ...r, type_label: TYPE_LABELS[r.type] || r.type })),
    total_hours: totals.reduce((s, r) => s + (r.hours_logged || 0), 0),
    activities_done: totals.length,
  });
});

export default router;