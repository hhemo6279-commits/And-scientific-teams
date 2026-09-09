import { Router } from 'express';
import db from '../db.js';
import { notify } from '../auth.js';
import { isFeatureEnabled } from '../settings.js';

const router = Router();

// قائمة الحقائب المتاحة
router.get('/', (req, res) => {
  if (!isFeatureEnabled('bundles')) return res.json({ bundles: [], disabled: true });
  const bundles = db.prepare(`
    SELECT b.*, 
      (SELECT COUNT(*) FROM bundle_courses bc WHERE bc.bundle_id = b.id) AS courses_count,
      (SELECT COUNT(*) FROM bundle_enrollments be WHERE be.bundle_id = b.id) AS students_count
    FROM bundles b WHERE b.active = 1 ORDER BY b.id
  `).all();
  res.json({ bundles });
});

// تفاصيل حقيبة مع دوراتها
router.get('/:id', (req, res) => {
  const bundle = db.prepare('SELECT * FROM bundles WHERE id = ?').get(req.params.id);
  if (!bundle) return res.status(404).json({ error: 'الحقيبة غير موجودة' });
  const courses = db.prepare(`
    SELECT bc.order_no, c.*, s.name AS section_name FROM bundle_courses bc
    JOIN courses c ON c.id = bc.course_id
    JOIN sections s ON s.id = c.section_id
    WHERE bc.bundle_id = ? ORDER BY bc.order_no, c.id
  `).all(bundle.id);
  const enrolled = db.prepare('SELECT * FROM bundle_enrollments WHERE bundle_id = ? AND user_id = ?').get(bundle.id, req.user.id);
  const myCourses = db.prepare('SELECT course_id FROM enrollments WHERE user_id = ?').all(req.user.id).map((r) => r.course_id);
  res.json({
    bundle,
    courses: courses.map((c) => ({ ...c, isEnrolled: myCourses.includes(c.id) })),
    myProgress: enrolled || null,
    enrolled
  });
});

// التسجيل في حقيبة
router.post('/:id/enroll', (req, res) => {
  const bundle = db.prepare('SELECT * FROM bundles WHERE id = ?').get(req.params.id);
  if (!bundle) return res.status(404).json({ error: 'الحقيبة غير موجودة' });
  try {
    db.prepare('INSERT INTO bundle_enrollments (bundle_id, user_id) VALUES (?,?)').run(bundle.id, req.user.id);
    notify(req.user.id, '📦 تسجيل في حقيبة', `سجّلت في الحقيبة التدريبية: ${bundle.title}`);
    res.json({ ok: true });
  } catch {
    return res.status(400).json({ error: 'أنت مسجل بالفعل' });
  }
});

// تقدمي في الحقيبة
router.get('/:id/my-progress', (req, res) => {
  const bundle = db.prepare('SELECT * FROM bundles WHERE id = ?').get(req.params.id);
  if (!bundle) return res.status(404).json({ error: 'الحقيبة غير موجودة' });
  const be = db.prepare('SELECT * FROM bundle_enrollments WHERE bundle_id = ? AND user_id = ?').get(bundle.id, req.user.id);
  if (!be) return res.status(400).json({ error: 'سجّل في الحقيبة أولاً' });
  const courses = db.prepare('SELECT course_id FROM bundle_courses WHERE bundle_id = ?').all(bundle.id);
  const total = courses.length;
  if (total === 0) return res.json({ progress: 0, completed: 0, doneCount: 0, total: 0 });
  const done = db.prepare(`
    SELECT COUNT(*) AS n FROM enrollments e
    JOIN bundle_courses bc ON bc.course_id = e.course_id
    WHERE e.user_id = ? AND bc.bundle_id = ? AND e.completed = 1
  `).get(req.user.id, bundle.id).n;
  const progress = Math.round((done / total) * 100);
  const completed = progress === 100 ? 1 : 0;
  db.prepare('UPDATE bundle_enrollments SET progress = ?, completed = ? WHERE bundle_id = ? AND user_id = ?')
    .run(progress, completed, bundle.id, req.user.id);
  res.json({ progress, completed, doneCount: done, total });
});

// شهادة الحقيبة
router.post('/:id/certificate', (req, res) => {
  const bundle = db.prepare('SELECT * FROM bundles WHERE id = ?').get(req.params.id);
  if (!bundle) return res.status(404).json({ error: 'الحقيبة غير موجودة' });
  const be = db.prepare('SELECT * FROM bundle_enrollments WHERE bundle_id = ? AND user_id = ?').get(bundle.id, req.user.id);
  if (!be || !be.completed) return res.status(400).json({ error: 'أكمل جميع دورات الحقيبة أولاً' });
  const existing = db.prepare('SELECT * FROM bundle_certificates WHERE bundle_id = ? AND user_id = ?').get(bundle.id, req.user.id);
  if (existing) return res.json({ certificate: existing });
  const code = `BMK-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
  const info = db.prepare('INSERT INTO bundle_certificates (bundle_id, user_id, code) VALUES (?,?,?)').run(bundle.id, req.user.id, code);
  const cert = db.prepare('SELECT * FROM bundle_certificates WHERE id = ?').get(info.lastInsertRowid);
  notify(req.user.id, '🎓 شهادة حقيبة', `حصلت على شهادة الحقيبة: ${bundle.title} (${cert.code})`);
  res.json({ certificate: cert });
});

export default router;
