import { Router } from 'express';
import db from '../db.js';
import { getSubAdminSections, audit } from '../auth.js';

const router = Router();

router.get('/', (req, res) => {
  const sections = db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM courses c WHERE c.section_id = s.id AND c.active = 1) AS course_count
    FROM sections s WHERE s.active = 1
  `).all();
  res.json({ sections });
});

router.get('/:id/courses', (req, res) => {
  const section = db.prepare('SELECT * FROM sections WHERE id = ?').get(req.params.id);
  if (!section) return res.status(404).json({ error: 'القسم غير موجود' });
  const courses = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count
    FROM courses c WHERE c.section_id = ? AND c.active = 1
  `).all(section.id);
  res.json({ section, courses });
});

// لوحة التحكم: الأقسام التي يملكها الادمن الفرعي
router.get('/mine', (req, res) => {
  const ids = getSubAdminSections(req.user.id);
  if (ids.length === 0) return res.json({ sections: [] });
  const sections = db.prepare(`SELECT * FROM sections WHERE id IN (${ids.map(() => '?').join(',')}) AND active = 1`).all(...ids);
  res.json({ sections });
});

export default router;
