import { Router } from 'express';
import db from '../db.js';

const router = Router();

// واجهات عامة (بدون تسجيل دخول) للصفحة الرئيسية التعريفية
router.get('/sections', (req, res) => {
  const sections = db.prepare('SELECT id, name, icon, color, description FROM sections WHERE active = 1').all();
  res.json({ sections });
});

// التحقق العام من الشهادة برمزها (دورات + مسارات الأكاديمية)
router.get('/certificate/:code', (req, res) => {
  const code = String(req.params.code || '').trim();
  if (!code) return res.status(404).json({ valid: false, error: 'شهادة غير موجودة' });
  const cert = db.prepare(`
    SELECT cert.*, u.name AS user_name, c.title AS course_title, s.name AS section_name
    FROM certificates cert
    JOIN users u ON u.id = cert.user_id
    JOIN courses c ON c.id = cert.course_id
    JOIN sections s ON s.id = c.section_id
    WHERE cert.code = ?
  `).get(code);
  if (cert) {
    return res.json({ valid: true, certificate: { ...cert, type: 'course' } });
  }
  const acad = db.prepare(`
    SELECT ac.*, u.name AS user_name, t.title AS course_title
    FROM academy_certificates ac
    JOIN users u ON u.id = ac.user_id
    JOIN academy_tracks t ON t.id = ac.track_id
    WHERE ac.code = ?
  `).get(code);
  if (!acad) return res.status(404).json({ valid: false, error: 'شهادة غير موجودة' });
  res.json({ valid: true, certificate: { ...acad, section_name: '🛡️ الأكاديمية الوطنية', type: 'academy' } });
});

router.get('/home', (req, res) => {
  const sections = db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM courses c WHERE c.section_id = s.id AND c.active = 1) AS course_count
    FROM sections s WHERE s.active = 1
  `).all();
  const stats = {
    students: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'student'").get().n,
    courses: db.prepare('SELECT COUNT(*) AS n FROM courses').get().n,
    sections: sections.length,
    challenges: db.prepare('SELECT COUNT(*) AS n FROM challenges').get().n,
    liveRooms: db.prepare("SELECT COUNT(*) AS n FROM live_rooms WHERE status != 'ended'").get().n,
  };
  const latestCourses = db.prepare(`
    SELECT c.title, s.name AS section_name FROM courses c JOIN sections s ON s.id = c.section_id
    WHERE c.active = 1 ORDER BY c.id DESC LIMIT 6
  `).all();
  res.json({ sections, stats, latestCourses });
});

// إدارة قاعات البث (للواجهة العامة + الأدمن)
export default router;
