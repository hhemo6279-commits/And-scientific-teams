import { Router } from 'express';
import db from '../db.js';
import { levelInfo } from '../levels.js';

const router = Router();

function isInstructorOf(userId, courseId) {
  return db.prepare('SELECT 1 FROM instructor_courses WHERE user_id = ? AND course_id = ?').get(userId, courseId);
}

// دورات المحاضر
router.get('/courses', (req, res) => {
  const courses = db.prepare(`
    SELECT ic.course_id AS id, c.title, c.level, s.name AS section_name,
      (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS students_count
    FROM instructor_courses ic
    JOIN courses c ON c.id = ic.course_id
    JOIN sections s ON s.id = c.section_id
    WHERE ic.user_id = ? ORDER BY c.id
  `).all(req.user.id);
  res.json({ courses });
});

// طلاب دورة المحاضر
router.get('/courses/:id/students', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  if (!isInstructorOf(req.user.id, course.id)) return res.status(403).json({ error: 'لست محاضراً لهذه الدورة' });
  const students = db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar, u.points, e.progress, e.completed, e.enrolled_at,
      g.score, g.max_score, g.note
    FROM enrollments e
    JOIN users u ON u.id = e.user_id
    LEFT JOIN grades g ON g.course_id = e.course_id AND g.user_id = e.user_id
    WHERE e.course_id = ? ORDER BY u.name
  `).all(course.id);
  res.json({ course: { id: course.id, title: course.title }, students });
});

// إدخال/تحديث درجة
router.put('/courses/:id/grades/:userId', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  if (!isInstructorOf(req.user.id, course.id)) return res.status(403).json({ error: 'لست محاضراً لهذه الدورة' });
  const { score, note } = req.body || {};
  if (score === undefined || Number(score) < 0) return res.status(400).json({ error: 'الدرجة غير صالحة' });
  db.prepare(`
    INSERT INTO grades (course_id, user_id, score, note, graded_by) VALUES (?,?,?,?,?)
    ON CONFLICT(course_id, user_id) DO UPDATE SET score = excluded.score, note = excluded.note, graded_by = excluded.graded_by, updated_at = datetime('now')
  `).run(course.id, req.params.userId, Number(score), note || '', req.user.id);
  res.json({ ok: true });
});

// إعلانات المحاضر لدوراته
router.post('/courses/:id/announce', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  if (!isInstructorOf(req.user.id, course.id)) return res.status(403).json({ error: 'لست محاضراً لهذه الدورة' });
  const { title, content } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'العنوان والمحتوى مطلوبان' });
  const students = db.prepare('SELECT user_id FROM enrollments WHERE course_id = ?').all(course.id);
  const insert = db.prepare('INSERT INTO notifications (user_id, title, content) VALUES (?,?,?)');
  for (const s of students) insert.run(s.user_id, `📢 ${title}`, content);
  db.prepare('INSERT INTO announcements (title, content) VALUES (?,?)').run(title, content);
  res.json({ ok: true, studentsNotified: students.length });
});

// ملخص لوحة المحاضر
router.get('/dashboard', (req, res) => {
  const courses = db.prepare('SELECT course_id FROM instructor_courses WHERE user_id = ?').all(req.user.id).map((r) => r.course_id);
  const myProfile = db.prepare('SELECT name, avatar, points FROM users WHERE id = ?').get(req.user.id);
  const level = levelInfo(myProfile.points || 0);
  const totalStudents = courses.length
    ? db.prepare(`SELECT COUNT(DISTINCT e.user_id) AS n FROM enrollments e WHERE e.course_id IN (${courses.map(() => '?').join(',')})`).get(...courses).n
    : 0;
  res.json({ profile: { ...myProfile, level }, coursesCount: courses.length, totalStudents });
});

export default router;
