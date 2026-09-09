import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from '../db.js';
import { getSubAdminSections, audit, notify, requireRole } from '../auth.js';
import { levelInfo } from '../levels.js';
import { generateQuiz, generateChallenge, generateCoursePlan } from '../ai.js';
import { getAllSettings, setSettings, getAllFlags, setFlags, passwordPolicy } from '../settings.js';
import { getRateStats } from '../security.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// ---- أدوات مساعدة ----
function canManageSection(user, sectionId) {
  if (user.role === 'main_admin') return true;
  if (user.role === 'sub_admin') return getSubAdminSections(user.id).includes(Number(sectionId));
  return false;
}

// ======= حماية الأمان: التصديرات والنسخ الاحتياطي للأدمن فقط =======
// كان يمكن لأي طالب مسجّل تنزيلها، الآن الأدمن فقط
router.use('/export', requireRole('main_admin', 'sub_admin'));
router.use('/backup', requireRole('main_admin', 'sub_admin'));

// توليد CSV مع BOM لدعم العربية في Excel
function toCSV(rows, headers) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(',')];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
  return '\uFEFF' + lines.join('\r\n');
}

function sendCSV(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

// تصدير الطلاب
router.get('/export/students', (req, res) => {
  const rows = db.prepare(`
    SELECT u.name, u.email, s.name AS section_name, u.points, u.active, u.created_at AS registered_at,
      (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS courses_count,
      (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.completed = 1) AS courses_done,
      (SELECT COUNT(*) FROM certificates c WHERE c.user_id = u.id) AS certificates_count
    FROM users u LEFT JOIN sections s ON s.id = u.section_id
    WHERE u.role = 'student'
    ORDER BY u.id
  `).all();
  sendCSV(res, 'students.csv', toCSV(rows, ['name', 'email', 'section_name', 'points', 'active', 'registered_at', 'courses_count', 'courses_done', 'certificates_count']));
});

// ======= المساعد الذكي =======
// توليد أسئلة اختبار من موضوع
router.post('/ai/quiz', (req, res) => {
  const { topic, count } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'أدخل موضوعاً أولاً' });
  const questions = generateQuiz(topic, Number(count) || 5);
  audit(req.user.id, 'توليد أسئلة', `موضوع: ${topic} (${questions.length} أسئلة)`);
  res.json({ questions });
});

// توليد اقتراح تحدي
router.post('/ai/challenge', (req, res) => {
  const { topic } = req.body || {};
  if (!topic) return res.status(400).json({ error: 'أدخل موضوعاً أولاً' });
  res.json({ challenge: generateChallenge(topic) });
});

// توليد مخطط دورة من العنوان
router.post('/ai/course-plan', (req, res) => {
  const { title, section_name } = req.body || {};
  if (!title) return res.status(400).json({ error: 'أدخل عنوان الدورة' });
  const plan = generateCoursePlan(title, section_name || '');
  audit(req.user.id, 'توليد مخطط دورة', title);
  res.json({ plan });
});

// تصدير حضور قاعة
router.get('/export/attendance/:roomId', (req, res) => {
  const room = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'القاعة غير موجودة' });
  const rows = db.prepare(`
    SELECT u.name, u.email, s.name AS section_name, la.joined_at FROM live_attendance la
    JOIN users u ON u.id = la.user_id
    LEFT JOIN sections s ON s.id = u.section_id
    WHERE la.room_id = ? ORDER BY la.joined_at
  `).all(room.id);
  sendCSV(res, `attendance-room-${room.id}.csv`, toCSV(rows, ['name', 'email', 'section_name', 'joined_at']));
});

// تصدير تقييمات الدورات
router.get('/export/reviews', (req, res) => {
  const rows = db.prepare(`
    SELECT c.title AS course_title, u.name AS student_name, r.rating, r.comment, r.created_at
    FROM reviews r
    JOIN courses c ON c.id = r.course_id
    JOIN users u ON u.id = r.user_id
    ORDER BY c.id, r.id
  `).all();
  sendCSV(res, 'reviews.csv', toCSV(rows, ['course_title', 'student_name', 'rating', 'comment', 'created_at']));
});

// تصدير التحديات المحلولة
router.get('/export/challenges', (req, res) => {
  const rows = db.prepare(`
    SELECT ch.title AS challenge_title, u.name AS student_name, ch.points, cs.solved
    FROM challenge_submissions cs
    JOIN challenges ch ON ch.id = cs.challenge_id
    JOIN users u ON u.id = cs.user_id
    WHERE cs.solved = 1
    ORDER BY ch.id
  `).all();
  sendCSV(res, 'challenges-solved.csv', toCSV(rows, ['challenge_title', 'student_name', 'points', 'solved']));
});

// تصدير أداء الطلاب في الاختبارات
router.get('/export/quiz-results', (req, res) => {
  const rows = db.prepare(`
    SELECT u.name AS student_name, l.title AS lesson_title, c.title AS course_title, qa.score, qa.total, qa.passed, qa.created_at
    FROM quiz_attempts qa
    JOIN users u ON u.id = qa.user_id
    JOIN lessons l ON l.id = qa.lesson_id
    JOIN courses c ON c.id = l.course_id
    ORDER BY qa.id DESC
  `).all();
  sendCSV(res, 'quiz-results.csv', toCSV(rows, ['student_name', 'lesson_title', 'course_title', 'score', 'total', 'passed', 'created_at']));
});

// ======= سجل الدرجات (تقييم يدوي) =======
router.get('/courses/:id/grades', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  const students = db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar, e.progress, e.completed,
      g.score, g.max_score, g.note, g.updated_at
    FROM enrollments e
    JOIN users u ON u.id = e.user_id
    LEFT JOIN grades g ON g.course_id = e.course_id AND g.user_id = e.user_id
    WHERE e.course_id = ? ORDER BY u.name
  `).all(course.id);
  res.json({ course: { id: course.id, title: course.title }, students });
});

router.put('/courses/:id/grades/:userId', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  const { score, note } = req.body || {};
  if (score === undefined || score === null || Number(score) < 0) return res.status(400).json({ error: 'الدرجة غير صالحة' });
  db.prepare(`
    INSERT INTO grades (course_id, user_id, score, note, graded_by) VALUES (?,?,?,?,?)
    ON CONFLICT(course_id, user_id) DO UPDATE SET score = excluded.score, note = excluded.note, graded_by = excluded.graded_by, updated_at = datetime('now')
  `).run(course.id, req.params.userId, Number(score), note || '', req.user.id);
  audit(req.user.id, 'تقييم طالب', `${req.params.userId} في ${course.title}: ${score}`);
  res.json({ ok: true });
});

// ======= الامتحان النهائي للدورات =======
// إعداد/تحديث الامتحان (العنوان، نسبة النجاح، المدة)
router.post('/courses/:id/exam', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  const { title, passing_score, duration_minutes } = req.body || {};
  db.prepare(`
    INSERT INTO exams (course_id, title, passing_score, duration_minutes) VALUES (?,?,?,?)
    ON CONFLICT(course_id) DO UPDATE SET title = excluded.title, passing_score = excluded.passing_score, duration_minutes = excluded.duration_minutes
  `).run(course.id, title || 'الامتحان النهائي', Number(passing_score) || 60, Number(duration_minutes) || 30);
  const exam = db.prepare('SELECT * FROM exams WHERE course_id = ?').get(course.id);
  audit(req.user.id, 'إعداد امتحان', `${course.title}`);
  res.json({ exam });
});

// عرض امتحان دورة مع أسئلته (لإدارة الاختبار)
router.get('/courses/:id/exam', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  const exam = db.prepare('SELECT * FROM exams WHERE course_id = ?').get(course.id);
  if (!exam) return res.json({ exam: null, questions: [] });
  const questions = db.prepare('SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY order_no').all(exam.id)
    .map((q) => ({ ...q, options: JSON.parse(q.options) }));
  res.json({ exam, questions });
});

// إضافة/تحديث سؤال امتحان
router.post('/exam/:examId/questions', (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.examId);
  if (!exam) return res.status(404).json({ error: 'الامتحان غير موجود' });
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(exam.course_id);
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  const { question, options, correct_index } = req.body || {};
  if (!question || !Array.isArray(options) || options.length < 2) return res.status(400).json({ error: 'بيانات السؤال غير مكتملة' });
  const order = (db.prepare('SELECT COUNT(*) AS n FROM exam_questions WHERE exam_id = ?').get(exam.id).n) + 1;
  const info = db.prepare('INSERT INTO exam_questions (exam_id, question, options, correct_index, order_no) VALUES (?,?,?,?,?)')
    .run(exam.id, question, JSON.stringify(options), Number(correct_index) || 0, order);
  res.json({ question: db.prepare('SELECT * FROM exam_questions WHERE id = ?').get(info.lastInsertRowid) });
});

// حذف سؤال امتحان
router.delete('/exam/questions/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM exam_questions WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'السؤال غير موجود' });
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(q.exam_id);
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(exam.course_id);
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  db.prepare('DELETE FROM exam_questions WHERE id = ?').run(q.id);
  res.json({ ok: true });
});

// توليد أسئلة الامتحان بالذكاء الاصطناعي من عنوان الدورة
router.post('/courses/:id/exam/generate', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  const exam = db.prepare('SELECT * FROM exams WHERE course_id = ?').get(course.id);
  if (!exam) return res.status(400).json({ error: 'أنشئ الامتحان أولاً' });
  const questions = generateQuiz(course.title, 5);
  const del = db.prepare('DELETE FROM exam_questions WHERE exam_id = ?');
  del.run(exam.id);
  const ins = db.prepare('INSERT INTO exam_questions (exam_id, question, options, correct_index, order_no) VALUES (?,?,?,?,?)');
  questions.forEach((q, i) => ins.run(exam.id, q.question, JSON.stringify(q.options), q.correct_index, i + 1));
  audit(req.user.id, 'توليد امتحان بالذكاء', course.title);
  res.json({ ok: true, count: questions.length });
});

// ======= الجدول الزمني =======
// عرض كل الأحداث
router.get('/schedule', (req, res) => {
  const items = db.prepare(`
    SELECT si.*, s.name AS section_name, c.title AS course_title, u.name AS created_by_name
    FROM schedule_items si
    LEFT JOIN sections s ON s.id = si.section_id
    LEFT JOIN courses c ON c.id = si.course_id
    LEFT JOIN users u ON u.id = si.created_by
    ORDER BY si.starts_at DESC
  `).all();
  res.json({ items });
});

// إضافة حدث
router.post('/schedule', (req, res) => {
  const { title, description, type, starts_at, ends_at, section_id, course_id } = req.body || {};
  if (!title || !starts_at) return res.status(400).json({ error: 'العنوان والوقت مطلوبان' });
  if (section_id && !canManageSection(req.user, section_id)) return res.status(403).json({ error: 'لا تملك صلاحية لهذا القسم' });
  const info = db.prepare('INSERT INTO schedule_items (title, description, type, starts_at, ends_at, section_id, course_id, created_by) VALUES (?,?,?,?,?,?,?,?)')
    .run(title, description || '', type || 'محاضرة', starts_at, ends_at || null, section_id || null, course_id || null, req.user.id);
  audit(req.user.id, 'إضافة حدث', title);
  res.json({ ok: true, id: info.lastInsertRowid });
});

// حذف حدث
router.delete('/schedule/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM schedule_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'الحدث غير موجود' });
  if (item.section_id && !canManageSection(req.user, item.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  db.prepare('DELETE FROM schedule_reminders WHERE schedule_id = ?').run(item.id);
  db.prepare('DELETE FROM schedule_items WHERE id = ?').run(item.id);
  res.json({ ok: true });
});

// ======= النسخ الاحتياطي والاستعادة =======
// إنشاء نسخة احتياطية
router.post('/backup', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(BACKUP_DIR, `backup-${stamp}.db`);
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    audit(req.user.id, 'نسخ احتياطي', path.basename(file));
    res.json({ ok: true, file: path.basename(file) });
  } catch (e) {
    console.error('backup error:', e);
    res.status(500).json({ error: 'فشل النسخ الاحتياطي: ' + e.message });
  }
});

// تحميل نسخة احتياطية
router.get('/backup/:file', (req, res) => {
  const name = path.basename(req.params.file);
  const file = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(file) || !name.startsWith('backup-')) return res.status(404).json({ error: 'الملف غير موجود' });
  res.download(file, name);
});

// قائمة النسخ الاحتياطية
router.get('/backups', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) { fs.mkdirSync(BACKUP_DIR, { recursive: true }); return res.json({ backups: [] }); }
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('backup-') && f.endsWith('.db'))
      .map((f) => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { name: f, size: Math.round(stat.size / 1024), createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.name.localeCompare(a.name));
    res.json({ backups });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// استعادة نسخة احتياطية (تستبدل قاعدة البيانات الحالية)
router.post('/backup/:file/restore', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'الاستعادة للأدمن الرئيسي فقط' });
  const name = path.basename(req.params.file);
  const file = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(file) || !name.startsWith('backup-')) return res.status(404).json({ error: 'الملف غير موجود' });
  try {
    // نسخ احتياطي للنسخة الحالية أولاً قبل الاستعادة
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const safety = path.join(BACKUP_DIR, `pre-restore-${Date.now()}.db`);
    db.exec(`VACUUM INTO '${safety.replace(/'/g, "''")}'`);
    fs.copyFileSync(file, DB_PATH);
    audit(req.user.id, 'استعادة نسخة', name);
    res.json({ ok: true, message: 'تمت الاستعادة بنجاح، سيعاد تشغيل الخادم قريباً' });
    setTimeout(() => process.exit(0), 800);
  } catch (e) {
    console.error('restore error:', e);
    res.status(500).json({ error: 'فشل الاستعادة: ' + e.message });
  }
});

// ======= لوحة المعلومات =======
router.get('/dashboard', (req, res) => {
  const isMain = req.user.role === 'main_admin';

  let stats;
  if (isMain) {
    stats = {
      students: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'student'").get().n,
      subAdmins: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'sub_admin'").get().n,
      courses: db.prepare('SELECT COUNT(*) AS n FROM courses').get().n,
      sections: db.prepare('SELECT COUNT(*) AS n FROM sections').get().n,
      challenges: db.prepare('SELECT COUNT(*) AS n FROM challenges').get().n,
      liveRooms: db.prepare('SELECT COUNT(*) AS n FROM live_rooms').get().n,
    };
  } else {
    const ids = getSubAdminSections(req.user.id);
    if (ids.length === 0) {
      stats = { students: 0, courses: 0, sections: 0, challenges: 0, liveRooms: 0, subAdmins: 0 };
    } else {
      const q = ids.map(() => '?').join(',');
      stats = {
        sections: db.prepare(`SELECT COUNT(*) AS n FROM sections WHERE id IN (${q})`).get(...ids).n,
        courses: db.prepare(`SELECT COUNT(*) AS n FROM courses WHERE section_id IN (${q})`).get(...ids).n,
        students: db.prepare(`SELECT COUNT(DISTINCT e.user_id) AS n FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE c.section_id IN (${q})`).get(...ids).n,
        challenges: db.prepare(`SELECT COUNT(*) AS n FROM challenges WHERE section_id IN (${q})`).get(...ids).n,
        liveRooms: db.prepare('SELECT COUNT(*) AS n FROM live_rooms').get().n,
        subAdmins: 0,
      };
    }
  }

  const recentAudit = db.prepare(`
    SELECT a.*, u.name AS user_name FROM audit_log a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC LIMIT 10
  `).all();

  const latestCourses = db.prepare(`
    SELECT c.*, s.name AS section_name FROM courses c
    JOIN sections s ON s.id = c.section_id
    ${isMain ? '' : `WHERE c.section_id IN (${getSubAdminSections(req.user.id).map(() => '?').join(',') || '0'})`}
    ORDER BY c.id DESC LIMIT 5
  `).all(...(isMain ? [] : getSubAdminSections(req.user.id)));

  // توزيع الطلاب على الأقسام (للمخطط الدائري)
  const sectionDist = isMain
    ? db.prepare(`
      SELECT s.name, COUNT(u.id) AS n FROM sections s
      LEFT JOIN users u ON u.section_id = s.id AND u.role = 'student'
      GROUP BY s.id ORDER BY n DESC
    `).all()
    : (() => {
      const ids = getSubAdminSections(req.user.id);
      return ids.length ? db.prepare(`
        SELECT s.name, COUNT(u.id) AS n FROM sections s
        LEFT JOIN users u ON u.section_id = s.id AND u.role = 'student'
        WHERE s.id IN (${ids.map(() => '?').join(',')})
        GROUP BY s.id ORDER BY n DESC
      `).all(...ids) : [];
    })();

  // التسجيلات الشهرية (آخر 6 أشهر)
  const monthlySignups = db.prepare(`
    SELECT strftime('%m', created_at) AS month, strftime('%Y', created_at) AS year, COUNT(*) AS n
    FROM users WHERE role = 'student'
    AND created_at >= datetime('now', '-6 months')
    GROUP BY year, month ORDER BY year, month
  `).all();

  // أفضل 5 طلاب بالنقاط
  const topStudents = db.prepare(`
    SELECT name, avatar, points FROM users
    WHERE role = 'student' AND active = 1
    ORDER BY points DESC LIMIT 5
  `).all().map((t) => ({ ...t, level: levelInfo(t.points) }));

  res.json({ stats, recentAudit, latestCourses, sectionDist, monthlySignups, topStudents, role: req.user.role });
});

// ======= الأقسام =======
// الرئيسي: عرض + إضافة + تعديل + حذف. الفرعي: عرض المخصصة له فقط.
router.get('/sections', (req, res) => {
  let sections;
  if (req.user.role === 'main_admin') {
    sections = db.prepare('SELECT * FROM sections ORDER BY id').all();
  } else {
    const ids = getSubAdminSections(req.user.id);
    sections = ids.length ? db.prepare(`SELECT * FROM sections WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id`).all(...ids) : [];
  }
  res.json({ sections });
});

router.post('/sections', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي يستطيع إضافة أقسام' });
  const { name, description, icon, color } = req.body || {};
  if (!name) return res.status(400).json({ error: 'اسم القسم مطلوب' });
  const info = db.prepare('INSERT INTO sections (name, description, icon, color) VALUES (?,?,?,?)').run(name, description || '', icon || '📁', color || '#555');
  audit(req.user.id, 'إضافة قسم', name);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/sections/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { name, description, icon, color, active } = req.body || {};
  db.prepare('UPDATE sections SET name = ?, description = ?, icon = ?, color = ?, active = ? WHERE id = ?')
    .run(name, description, icon, color, active ?? 1, req.params.id);
  audit(req.user.id, 'تعديل قسم', name);
  res.json({ ok: true });
});

router.delete('/sections/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  db.prepare('DELETE FROM sections WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM sub_admin_sections WHERE section_id = ?').run(req.params.id);
  audit(req.user.id, 'حذف قسم', String(req.params.id));
  res.json({ ok: true });
});

// ======= إدارة الأدمن الفرعي (الرئيسي فقط) =======
router.get('/subadmins', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const subs = db.prepare("SELECT * FROM users WHERE role = 'sub_admin'").all();
  const sections = db.prepare('SELECT * FROM sections').all();
  const links = db.prepare('SELECT * FROM sub_admin_sections').all();
  const byUser = {};
  for (const l of links) {
    if (!byUser[l.user_id]) byUser[l.user_id] = [];
    const sec = sections.find((s) => s.id === l.section_id);
    if (sec) byUser[l.user_id].push(sec);
  }
  res.json({ subAdmins: subs.map((s) => ({ ...s, password_hash: undefined, sections: byUser[s.id] || [] })), allSections: sections });
});

router.post('/subadmins', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { name, email, password, sectionIds } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'البيانات ناقصة' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(400).json({ error: 'البريد مستخدم' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,'sub_admin')").run(name, email, hash);
  const uid = info.lastInsertRowid;
  const set = new Set((sectionIds || []).map(Number));
  for (const sid of set) {
    if (db.prepare('SELECT id FROM sections WHERE id = ?').get(sid)) {
      db.prepare('INSERT INTO sub_admin_sections (user_id, section_id) VALUES (?,?)').run(uid, sid);
    }
  }
  audit(req.user.id, 'إضافة أدمن فرعي', `${name} (${email})`);
  res.json({ ok: true });
});

router.put('/subadmins/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { name, active, sectionIds } = req.body || {};
  const uid = req.params.id;
  db.prepare('UPDATE users SET name = ?, active = ? WHERE id = ? AND role = ?').run(name, active ?? 1, uid, 'sub_admin');
  if (Array.isArray(sectionIds)) {
    db.prepare('DELETE FROM sub_admin_sections WHERE user_id = ?').run(uid);
    const set = new Set(sectionIds.map(Number));
    for (const sid of set) {
      if (db.prepare('SELECT id FROM sections WHERE id = ?').get(sid)) {
        db.prepare('INSERT INTO sub_admin_sections (user_id, section_id) VALUES (?,?)').run(uid, sid);
      }
    }
  }
  audit(req.user.id, 'تعديل أدمن فرعي', String(uid));
  res.json({ ok: true });
});

router.delete('/subadmins/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  db.prepare('DELETE FROM sub_admin_sections WHERE user_id = ?').run(req.params.id);
  db.prepare('DELETE FROM users WHERE id = ? AND role = ?').run(req.params.id, 'sub_admin');
  audit(req.user.id, 'حذف أدمن فرعي', String(req.params.id));
  res.json({ ok: true });
});

// ======= إدارة المستخدمين (الرئيسي) =======
router.get('/users', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const users = db.prepare("SELECT id, name, email, role, active, created_at FROM users WHERE role = 'student'").all();
  res.json({ users });
});

router.put('/users/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { active } = req.body || {};
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ?? 1, req.params.id);
  audit(req.user.id, 'تعديل حالة طالب', String(req.params.id));
  res.json({ ok: true });
});

// ملف متابعة الطالب التفصيلي (الطالب + أدمن أقسامه)
router.get('/users/:id/tracking', (req, res) => {
  const student = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(req.params.id, 'student');
  if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
  // قيود الأدمن الفرعي: فقط طلاب أقسامه
  if (req.user.role !== 'main_admin') {
    const allowed = db.prepare(`
      SELECT 1 FROM users u JOIN enrollments e ON e.user_id = u.id
      JOIN courses c ON c.id = e.course_id
      WHERE u.id = ? AND c.section_id IN (${getSubAdminSections(req.user.id).map(() => '?').join(',') || '0'})
      LIMIT 1
    `).get(student.id, ...getSubAdminSections(req.user.id));
    if (!allowed) return res.status(403).json({ error: 'لا تملك صلاحية على هذا الطالب' });
  }

  const enrollments = db.prepare(`
    SELECT e.*, c.title AS course_title, s.name AS section_name, s.icon AS section_icon,
      (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS total_lessons
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    JOIN sections s ON s.id = c.section_id
    WHERE e.user_id = ? ORDER BY e.enrolled_at DESC
  `).all(student.id);

  const quizResults = db.prepare(`
    SELECT qa.score, qa.total, qa.passed, qa.created_at, l.title AS lesson_title, c.title AS course_title
    FROM quiz_attempts qa
    JOIN lessons l ON l.id = qa.lesson_id
    JOIN courses c ON c.id = l.course_id
    WHERE qa.user_id = ? ORDER BY qa.id DESC LIMIT 20
  `).all(student.id);

  const attendance = db.prepare(`
    SELECT la.joined_at, r.title AS room_title FROM live_attendance la
    JOIN live_rooms r ON r.id = la.room_id
    WHERE la.user_id = ? ORDER BY la.joined_at DESC LIMIT 20
  `).all(student.id);

  const solvedChallenges = db.prepare(`
    SELECT ch.title, ch.points, cs.solved FROM challenge_submissions cs
    JOIN challenges ch ON ch.id = cs.challenge_id
    WHERE cs.user_id = ? AND cs.solved = 1
  `).all(student.id);

  const reviews = db.prepare(`
    SELECT r.rating, r.comment, r.created_at, c.title AS course_title
    FROM reviews r JOIN courses c ON c.id = r.course_id
    WHERE r.user_id = ? ORDER BY r.id DESC
  `).all(student.id);

  const messages = db.prepare(`
    SELECT m.content, m.created_at, u.name AS other_name FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END
    WHERE m.sender_id = ? OR m.recipient_id = ? ORDER BY m.id DESC LIMIT 10
  `).all(student.id, student.id, student.id);

  res.json({
    student: {
      id: student.id, name: student.name, email: student.email, avatar: student.avatar,
      points: student.points, active: student.active, created_at: student.created_at,
      level: levelInfo(student.points),
      section: student.section_id ? db.prepare('SELECT id, name, icon, color FROM sections WHERE id = ?').get(student.section_id) : null,
    },
    enrollments, quizResults, attendance, solvedChallenges, reviews, messages,
    stats: {
      coursesDone: enrollments.filter((e) => e.completed).length,
      averageQuiz: quizResults.length ? (quizResults.reduce((s, q) => s + (q.score / Math.max(q.total, 1)) * 100, 0) / quizResults.length).toFixed(0) : null,
      attendanceCount: attendance.length,
      challengesSolved: solvedChallenges.length,
    },
  });
});

// ======= إدارة الدورات =======
// الرئيسي: أي قسم. الفرعي: أقسامه فقط.
router.get('/courses', (req, res) => {
  let rows;
  if (req.user.role === 'main_admin') {
    rows = db.prepare('SELECT c.*, s.name AS section_name FROM courses c JOIN sections s ON s.id = c.section_id ORDER BY c.id DESC').all();
  } else {
    const ids = getSubAdminSections(req.user.id);
    rows = ids.length
      ? db.prepare(`SELECT c.*, s.name AS section_name FROM courses c JOIN sections s ON s.id = c.section_id WHERE c.section_id IN (${ids.map(() => '?').join(',')}) ORDER BY c.id DESC`).all(...ids)
      : [];
  }
  res.json({ courses: rows });
});

// ======= إدارة الدروس =======
router.get('/courses/:id/lessons', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  const lessons = db.prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_no').all(course.id);
  const questions = db.prepare('SELECT id, lesson_id, question, options, correct_index, order_no FROM quiz_questions').all();
  const byLesson = {};
  for (const q of questions) {
    if (!byLesson[q.lesson_id]) byLesson[q.lesson_id] = [];
    byLesson[q.lesson_id].push(q);
  }
  res.json({ lessons: lessons.map((l) => ({ ...l, quizQuestions: byLesson[l.id] || [] })) });
});

router.post('/courses/:id/lessons', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  const { title, content, type, order_no, quizQuestions } = req.body || {};
  if (!title) return res.status(400).json({ error: 'عنوان الدرس مطلوب' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(order_no), 0) AS m FROM lessons WHERE course_id = ?').get(course.id).m;
  const info = db.prepare('INSERT INTO lessons (course_id, title, content, type, order_no) VALUES (?,?,?,?,?)')
    .run(course.id, title, content || '', type || 'text', order_no || maxOrder + 1);
  const lessonId = info.lastInsertRowid;
  if (type === 'quiz' && Array.isArray(quizQuestions)) {
    const ins = db.prepare('INSERT INTO quiz_questions (lesson_id, question, options, correct_index, order_no) VALUES (?,?,?,?,?)');
    quizQuestions.forEach((q, i) => ins.run(lessonId, q.question, JSON.stringify(q.options || []), q.correct_index, i + 1));
  }
  audit(req.user.id, 'إضافة درس', title);
  res.json({ ok: true, id: lessonId });
});

router.put('/lessons/:id', (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(lesson.course_id);
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  const { title, content, type, order_no, quizQuestions } = req.body || {};
  db.prepare('UPDATE lessons SET title = ?, content = ?, type = ?, order_no = ? WHERE id = ?')
    .run(title, content, type, order_no, lesson.id);
  if (type === 'quiz' && Array.isArray(quizQuestions)) {
    db.prepare('DELETE FROM quiz_questions WHERE lesson_id = ?').run(lesson.id);
    const ins = db.prepare('INSERT INTO quiz_questions (lesson_id, question, options, correct_index, order_no) VALUES (?,?,?,?,?)');
    quizQuestions.forEach((q, i) => ins.run(lesson.id, q.question, JSON.stringify(q.options || []), q.correct_index, i + 1));
  }
  audit(req.user.id, 'تعديل درس', title);
  res.json({ ok: true });
});

router.delete('/lessons/:id', (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(lesson.course_id);
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  db.prepare('DELETE FROM quiz_questions WHERE lesson_id = ?').run(lesson.id);
  db.prepare('DELETE FROM lesson_progress WHERE lesson_id = ?').run(lesson.id);
  db.prepare('DELETE FROM lessons WHERE id = ?').run(lesson.id);
  audit(req.user.id, 'حذف درس', lesson.title);
  res.json({ ok: true });
});

// ======= الإعلانات =======
router.get('/announcements', (req, res) => {
  const rows = db.prepare('SELECT a.*, u.name AS user_name FROM announcements a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC').all();
  res.json({ announcements: rows });
});

router.post('/announcements', (req, res) => {
  const { title, content } = req.body || {};
  if (!title) return res.status(400).json({ error: 'عنوان الإعلان مطلوب' });
  const info = db.prepare('INSERT INTO announcements (user_id, title, content) VALUES (?,?,?)').run(req.user.id, title, content || '');
  audit(req.user.id, 'نشر إعلان', title);
  // إشعار لجميع الطلاب النشطين
  const students = db.prepare("SELECT id FROM users WHERE role = 'student' AND active = 1").all();
  const insN = db.prepare('INSERT INTO notifications (user_id, title, content) VALUES (?,?,?)');
  for (const s of students) insN.run(s.id, `📢 ${title}`, content || '');
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.delete('/announcements/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'غير موجود' });
  db.prepare('DELETE FROM announcements WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

// تقرير حضور قاعة البث
router.get('/live/:id/attendance', (req, res) => {
  const room = db.prepare('SELECT * FROM live_rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'القاعة غير موجودة' });
  const attendees = db.prepare(`
    SELECT la.*, u.name AS user_name, u.email, s.name AS section_name FROM live_attendance la
    JOIN users u ON u.id = la.user_id
    LEFT JOIN sections s ON s.id = u.section_id
    WHERE la.room_id = ? ORDER BY la.joined_at
  `).all(room.id);
  res.json({ room: { id: room.id, title: room.title, status: room.status }, attendees, count: attendees.length });
});

router.post('/courses', (req, res) => {
  const { section_id, title, description, level, price, duration_hours, outcomes, prerequisites, instructor, language } = req.body || {};
  if (!section_id || !title) return res.status(400).json({ error: 'القسم والعنوان مطلوبان' });
  if (!canManageSection(req.user, section_id)) return res.status(403).json({ error: 'لا تملك صلاحية على هذا القسم' });
  const info = db.prepare('INSERT INTO courses (section_id, title, description, level, price, duration_hours, outcomes, prerequisites, instructor, language) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(section_id, title, description || '', level || 'مبتدئ', price || 0, duration_hours || 0, outcomes || '', prerequisites || '', instructor || '', language || 'العربية');
  audit(req.user.id, 'إضافة دورة', title);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/courses/:id', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  const { title, description, level, price, active, duration_hours, outcomes, prerequisites, instructor, language } = req.body || {};
  db.prepare(`UPDATE courses SET title = ?, description = ?, level = ?, price = ?, active = ?, duration_hours = ?, outcomes = ?, prerequisites = ?, instructor = ?, language = ? WHERE id = ?`)
    .run(title, description, level, price ?? 0, active ?? 1, duration_hours ?? course.duration_hours ?? 0, outcomes ?? '', prerequisites ?? '', instructor ?? '', language ?? 'العربية', course.id);
  audit(req.user.id, 'تعديل دورة', title);
  res.json({ ok: true });
});

router.delete('/courses/:id', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  if (!canManageSection(req.user, course.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  db.prepare('DELETE FROM courses WHERE id = ?').run(course.id);
  audit(req.user.id, 'حذف دورة', course.title);
  res.json({ ok: true });
});

// ======= سجل التدقيق =======
router.get('/audit', (req, res) => {
  let rows;
  if (req.user.role === 'main_admin') {
    rows = db.prepare('SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 100').all();
  } else {
    rows = db.prepare('SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 100').all(req.user.id);
  }
  res.json({ logs: rows });
});

// ======= إدارة التحديات =======
router.get('/challenges', (req, res) => {
  if (req.user.role === 'main_admin') {
    const rows = db.prepare('SELECT ch.*, s.name AS section_name FROM challenges ch JOIN sections s ON s.id = ch.section_id').all();
    return res.json({ challenges: rows });
  }
  const ids = getSubAdminSections(req.user.id);
  const rows = ids.length
    ? db.prepare(`SELECT ch.*, s.name AS section_name FROM challenges ch JOIN sections s ON s.id = ch.section_id WHERE ch.section_id IN (${ids.map(() => '?').join(',')})`).all(...ids)
    : [];
  res.json({ challenges: rows });
});

router.post('/challenges', (req, res) => {
  const { section_id, title, description, points, flag, difficulty } = req.body || {};
  if (!section_id || !title) return res.status(400).json({ error: 'البيانات ناقصة' });
  if (!canManageSection(req.user, section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  const info = db.prepare('INSERT INTO challenges (section_id, title, description, points, flag, difficulty) VALUES (?,?,?,?,?,?)')
    .run(section_id, title, description || '', points || 100, flag || '', difficulty || 'سهل');
  audit(req.user.id, 'إضافة تحدي', title);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.delete('/challenges/:id', (req, res) => {
  const ch = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!ch) return res.status(404).json({ error: 'غير موجود' });
  if (!canManageSection(req.user, ch.section_id)) return res.status(403).json({ error: 'لا تملك صلاحية' });
  db.prepare('DELETE FROM challenges WHERE id = ?').run(ch.id);
  audit(req.user.id, 'حذف تحدي', ch.title);
  res.json({ ok: true });
});

// ======= الأكاديمية الوطنية (الرئيسي) =======
router.get('/academy', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const tracks = db.prepare('SELECT * FROM academy_tracks ORDER BY id').all();
  const stages = db.prepare(`
    SELECT st.*, c.title AS course_title, ch.title AS challenge_title
    FROM academy_stages st
    LEFT JOIN courses c ON c.id = st.course_id
    LEFT JOIN challenges ch ON ch.id = st.challenge_id
    ORDER BY st.track_id, st.order_no, st.id
  `).all();
  const courses = db.prepare('SELECT id, title FROM courses ORDER BY id').all();
  const challenges = db.prepare('SELECT id, title FROM challenges ORDER BY id').all();
  const byTrack = {};
  for (const s of stages) {
    if (!byTrack[s.track_id]) byTrack[s.track_id] = [];
    byTrack[s.track_id].push(s);
  }
  res.json({ tracks: tracks.map((t) => ({ ...t, stages: byTrack[t.id] || [] })), courses, challenges });
});

router.post('/academy', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { title, description, icon, color } = req.body || {};
  if (!title) return res.status(400).json({ error: 'العنوان مطلوب' });
  const info = db.prepare('INSERT INTO academy_tracks (title, description, icon, color) VALUES (?,?,?,?)')
    .run(title, description || '', icon || '🎓', color || '#6c7bff');
  audit(req.user.id, 'إضافة مسار أكاديمي', title);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/academy/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const track = db.prepare('SELECT * FROM academy_tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'المسار غير موجود' });
  const { title, description, icon, color, active } = req.body || {};
  db.prepare('UPDATE academy_tracks SET title = ?, description = ?, icon = ?, color = ?, active = ? WHERE id = ?')
    .run(title, description, icon, color, active ?? 1, track.id);
  audit(req.user.id, 'تعديل مسار أكاديمي', title);
  res.json({ ok: true });
});

router.delete('/academy/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  db.prepare('DELETE FROM academy_certificates WHERE track_id = ?').run(req.params.id);
  db.prepare('DELETE FROM academy_enrollments WHERE track_id = ?').run(req.params.id);
  db.prepare('DELETE FROM academy_stages WHERE track_id = ?').run(req.params.id);
  db.prepare('DELETE FROM academy_tracks WHERE id = ?').run(req.params.id);
  audit(req.user.id, 'حذف مسار أكاديمي', String(req.params.id));
  res.json({ ok: true });
});

router.post('/academy/:trackId/stages', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const track = db.prepare('SELECT id FROM academy_tracks WHERE id = ?').get(req.params.trackId);
  if (!track) return res.status(404).json({ error: 'المسار غير موجود' });
  const { title, description, course_id, challenge_id } = req.body || {};
  if (!title) return res.status(400).json({ error: 'عنوان المرحلة مطلوب' });
  const order = (db.prepare('SELECT COUNT(*) AS n FROM academy_stages WHERE track_id = ?').get(track.id).n) + 1;
  const info = db.prepare('INSERT INTO academy_stages (track_id, order_no, title, description, course_id, challenge_id) VALUES (?,?,?,?,?,?)')
    .run(track.id, order, title, description || '', course_id || null, challenge_id || null);
  audit(req.user.id, 'إضافة مرحلة أكاديمية', title);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/academy/stages/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const stage = db.prepare('SELECT * FROM academy_stages WHERE id = ?').get(req.params.id);
  if (!stage) return res.status(404).json({ error: 'المرحلة غير موجودة' });
  const { title, description, course_id, challenge_id } = req.body || {};
  db.prepare('UPDATE academy_stages SET title = ?, description = ?, course_id = ?, challenge_id = ? WHERE id = ?')
    .run(title, description || '', course_id || null, challenge_id || null, stage.id);
  audit(req.user.id, 'تعديل مرحلة أكاديمية', title);
  res.json({ ok: true });
});

router.delete('/academy/stages/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  db.prepare('DELETE FROM academy_stages WHERE id = ?').run(req.params.id);
  audit(req.user.id, 'حذف مرحلة أكاديمية', String(req.params.id));
  res.json({ ok: true });
});

// حفظ ترتيب مراحل المسار [{ id, order_no }]
router.put('/academy/:trackId/order', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { stages } = req.body || {};
  if (!Array.isArray(stages)) return res.status(400).json({ error: 'قائمة مراحل مطلوبة' });
  for (const s of stages) {
    db.prepare('UPDATE academy_stages SET order_no = ? WHERE id = ? AND track_id = ?').run(s.order_no, s.id, req.params.trackId);
  }
  audit(req.user.id, 'إعادة ترتيب مراحل المسار', String(req.params.trackId));
  res.json({ ok: true });
});

// ======= الإعدادات المركزية + مفاتيح الميزات (الأدمن الرئيسي) =======
router.get('/settings', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  res.json({ settings: getAllSettings(), flags: getAllFlags() });
});

router.put('/settings', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { settings, flags } = req.body || {};
  if (settings && typeof settings === 'object') setSettings(settings);
  if (Array.isArray(flags)) setFlags(flags.map((f) => ({ key: f.key, enabled: f.enabled !== false ? 1 : 0, description: f.description || '' })));
  audit(req.user.id, 'تعديل إعدادات المنصة', JSON.stringify(settings || {}).slice(0, 200));
  res.json({ ok: true });
});

// ======= مركز الأمان: مراقبة فشل الدخول + اعتماد MFA + الحالات =======
router.get('/security', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const failed24h = db.prepare(`SELECT * FROM audit_log WHERE action = 'محاولة تسجيل دخول فاشلة' AND created_at >= datetime('now','-1 day') ORDER BY id DESC LIMIT 100`).all();
  const adminsWithoutMfa = db.prepare(`SELECT id, name, email, role FROM users WHERE role != 'student' AND mfa_enabled != 1 AND active = 1`).all();
  const mfaAdoption = db.prepare(`SELECT
    (SELECT COUNT(*) FROM users WHERE active = 1) AS total,
    (SELECT COUNT(*) FROM users WHERE active = 1 AND mfa_enabled = 1) AS mfaOn,
    (SELECT COUNT(*) FROM users WHERE active = 1 AND role != 'student' AND mfa_enabled = 1) AS adminsMfaOn`).get();
  const activeSessions = db.prepare(`SELECT COUNT(*) AS n FROM refresh_tokens WHERE revoked = 0 AND expires_at > datetime('now')`).get().n;
  const failedByUser = db.prepare(`
    SELECT a.details, COUNT(*) AS n FROM audit_log a
    WHERE a.action = 'محاولة تسجيل دخول فاشلة' AND a.created_at >= datetime('now','-1 day')
    GROUP BY a.details ORDER BY n DESC LIMIT 10
  `).all();
  const recentAdminActions = db.prepare(`
    SELECT a.*, u.name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
    WHERE a.user_id IN (SELECT id FROM users WHERE role != 'student')
    ORDER BY a.id DESC LIMIT 15
  `).all();
  res.json({
    failedLogins24h: failed24h,
    failedLoginsCount: failed24h.length,
    adminsWithoutMfa,
    mfaAdoption,
    activeSessions,
    failedByUser,
    recentAdminActions,
    rateStats: getRateStats(),
    passwordPolicy: passwordPolicy(),
  });
});

// ======= إدارة الفرص (المرحلة 12) =======
router.get('/opportunities', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const rows = db.prepare(`
    SELECT o.*,
      (SELECT COUNT(*) FROM opportunity_applications oa WHERE oa.opportunity_id = o.id) AS applicants_count,
      (SELECT COUNT(*) FROM opportunity_applications oa WHERE oa.opportunity_id = o.id AND oa.status = 'accepted') AS accepted_count
    FROM opportunities o ORDER BY o.id DESC
  `).all();
  res.json({ opportunities: rows });
});

router.post('/opportunities', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { title, type, organization, description, location, deadline, eligibility, spots, active } = req.body || {};
  if (!title || !type) return res.status(400).json({ error: 'العنوان والنوع مطلوبان' });
  const info = db.prepare(`
    INSERT INTO opportunities (title, type, organization, description, location, deadline, eligibility, spots, active)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(title, type, organization || '', description || '', location || '', deadline || null, eligibility || '', Math.max(1, Number(spots) || 1), active === false ? 0 : 1);
  audit(req.user.id, 'إضافة فرصة', title);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/opportunities/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
  if (!opp) return res.status(404).json({ error: 'الفرصة غير موجودة' });
  const { title, type, organization, description, location, deadline, eligibility, spots, active } = req.body || {};
  db.prepare(`
    UPDATE opportunities SET title = ?, type = ?, organization = ?, description = ?, location = ?,
      deadline = ?, eligibility = ?, spots = ?, active = ? WHERE id = ?
  `).run(title, type, organization || '', description || '', location || '', deadline || null, eligibility || '', Math.max(1, Number(spots) || 1), active === false ? 0 : 1, opp.id);
  audit(req.user.id, 'تعديل فرصة', title);
  res.json({ ok: true });
});

router.delete('/opportunities/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  db.prepare('DELETE FROM opportunity_applications WHERE opportunity_id = ?').run(req.params.id);
  db.prepare('DELETE FROM opportunities WHERE id = ?').run(req.params.id);
  audit(req.user.id, 'حذف فرصة', String(req.params.id));
  res.json({ ok: true });
});

// المتقدمون على فرصة مع ملف مهاراتهم
router.get('/opportunities/:id/applications', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
  if (!opp) return res.status(404).json({ error: 'الفرصة غير موجودة' });
  const rows = db.prepare(`
    SELECT oa.*, u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar, u.points,
      (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = oa.user_id AND e.completed = 1) AS courses_done,
      (SELECT COUNT(*) FROM challenge_submissions cs WHERE cs.user_id = oa.user_id AND cs.solved = 1) AS challenges_solved,
      (SELECT COUNT(*) FROM certificates c WHERE c.user_id = oa.user_id) AS certificates_count
    FROM opportunity_applications oa JOIN users u ON u.id = oa.user_id
    WHERE oa.opportunity_id = ? ORDER BY oa.id ASC
  `).all(opp.id);
  res.json({ opportunity: opp, applicants: rows.map((r) => ({ ...r, fit: Math.min(100, r.courses_done * 15 + r.challenges_solved * 5 + r.certificates_count * 10) })) });
});

// قبول / رفض متقدم (يُشعَر صاحب الطلب)
router.put('/opportunities/:id/applications/:appId', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { status } = req.body || {};
  if (!['accepted', 'rejected'].includes(status)) return res.status(400).json({ error: 'قرار غير صالح' });
  const app = db.prepare(`
    SELECT oa.*, o.title AS opp_title FROM opportunity_applications oa
    JOIN opportunities o ON o.id = oa.opportunity_id
    WHERE oa.id = ? AND oa.opportunity_id = ?
  `).get(req.params.appId, req.params.id);
  if (!app) return res.status(404).json({ error: 'الطلب غير موجود' });
  db.prepare('UPDATE opportunity_applications SET status = ? WHERE id = ?').run(status, app.id);
  if (status === 'accepted') {
    const opp = db.prepare('SELECT spots FROM opportunities WHERE id = ?').get(app.opportunity_id);
    const acceptedNow = db.prepare(`SELECT COUNT(*) AS n FROM opportunity_applications WHERE opportunity_id = ? AND status = 'accepted'`).get(app.opportunity_id).n;
    if (acceptedNow > opp.spots) {
      db.prepare("UPDATE opportunity_applications SET status = 'pending' WHERE id = ?").run(app.id);
      return res.status(400).json({ error: 'عدد المقاعد ممتلئ' });
    }
    notify(app.user_id, '🎉 مبروك! تم قبولك', `قُبل طلبك في: ${app.opp_title}`);
  } else {
    notify(app.user_id, '💼 تحديث الطلب', `عذراً، لم يُقبل طلبك في: ${app.opp_title}`);
  }
  audit(req.user.id, `قرار فرصة (${status === 'accepted' ? 'قبول' : 'رفض'})`, app.opp_title);
  res.json({ ok: true });
});

// ======= إدارة الفعاليات والمؤتمرات (المرحلة 13) =======
router.get('/events', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const rows = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) AS registered_count,
      (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id AND er.attended = 1) AS attended_count
    FROM events e ORDER BY e.id DESC
  `).all();
  res.json({ events: rows });
});

router.post('/events', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { title, type, description, location, starts_at, ends_at, capacity, speaker, active } = req.body || {};
  if (!title) return res.status(400).json({ error: 'العنوان مطلوب' });
  const info = db.prepare(`
    INSERT INTO events (title, type, description, location, starts_at, ends_at, capacity, speaker, active)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(title, type || 'activity', description || '', location || '', starts_at || null, ends_at || null, Math.max(1, Number(capacity) || 100), speaker || '', active === false ? 0 : 1);
  audit(req.user.id, 'إضافة فعالية', title);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/events/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'الفعالية غير موجودة' });
  const { title, type, description, location, starts_at, ends_at, capacity, speaker, active } = req.body || {};
  db.prepare(`
    UPDATE events SET title = ?, type = ?, description = ?, location = ?, starts_at = ?, ends_at = ?, capacity = ?, speaker = ?, active = ? WHERE id = ?
  `).run(title, type || 'activity', description || '', location || '', starts_at || null, ends_at || null, Math.max(1, Number(capacity) || 100), speaker || '', active === false ? 0 : 1, ev.id);
  audit(req.user.id, 'تعديل فعالية', title);
  res.json({ ok: true });
});

router.delete('/events/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  db.prepare('DELETE FROM event_registrations WHERE event_id = ?').run(req.params.id);
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  audit(req.user.id, 'حذف فعالية', String(req.params.id));
  res.json({ ok: true });
});

// قائمة المسجلين في فعالية
router.get('/events/:id/registrations', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'الفعالية غير موجودة' });
  const rows = db.prepare(`
    SELECT er.*, u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar, u.section_id, s.name AS section_name
    FROM event_registrations er
    JOIN users u ON u.id = er.user_id
    LEFT JOIN sections s ON s.id = u.section_id
    WHERE er.event_id = ? ORDER BY er.id ASC
  `).all(ev.id);
  res.json({ event: ev, registrations: rows });
});

// تسجيل حضور / إلغاء حضور
router.put('/events/:id/registrations/:regId', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { attended } = req.body || {};
  const reg = db.prepare('SELECT * FROM event_registrations WHERE id = ? AND event_id = ?').get(req.params.regId, req.params.id);
  if (!reg) return res.status(404).json({ error: 'التسجيل غير موجود' });
  db.prepare('UPDATE event_registrations SET attended = ? WHERE id = ?').run(attended ? 1 : 0, reg.id);
  audit(req.user.id, 'تسجيل حضور فعالية', `#${reg.id}`);
  res.json({ ok: true });
});

// ======= إدارة المرافق والقاعات (المرحلة 14) =======
router.get('/resources', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const rows = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM resource_bookings rb WHERE rb.resource_id = r.id) AS bookings_count,
      (SELECT COUNT(*) FROM resource_bookings rb WHERE rb.resource_id = r.id AND rb.status = 'pending') AS pending_count
    FROM resources r ORDER BY r.id
  `).all();
  res.json({ resources: rows });
});

router.post('/resources', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { name, type, description, location, capacity, requires_approval, active } = req.body || {};
  if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
  const info = db.prepare(`
    INSERT INTO resources (name, type, description, location, capacity, requires_approval, active)
    VALUES (?,?,?,?,?,?,?)
  `).run(name, type || 'room', description || '', location || '', Math.max(1, Number(capacity) || 1), requires_approval ? 1 : 0, active === false ? 0 : 1);
  audit(req.user.id, 'إضافة مرافق', name);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/resources/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const r = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'المرافق غير موجود' });
  const { name, type, description, location, capacity, requires_approval, active } = req.body || {};
  db.prepare(`
    UPDATE resources SET name = ?, type = ?, description = ?, location = ?, capacity = ?, requires_approval = ?, active = ? WHERE id = ?
  `).run(name, type || 'room', description || '', location || '', Math.max(1, Number(capacity) || 1), requires_approval ? 1 : 0, active === false ? 0 : 1, r.id);
  audit(req.user.id, 'تعديل مرافق', name);
  res.json({ ok: true });
});

router.delete('/resources/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  db.prepare('DELETE FROM resource_bookings WHERE resource_id = ?').run(req.params.id);
  db.prepare('DELETE FROM resources WHERE id = ?').run(req.params.id);
  audit(req.user.id, 'حذف مرافق', String(req.params.id));
  res.json({ ok: true });
});

// حجوزات مرافق
router.get('/resources/:id/bookings', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const r = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'المرافق غير موجود' });
  const rows = db.prepare(`
    SELECT rb.*, u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar
    FROM resource_bookings rb JOIN users u ON u.id = rb.user_id
    WHERE rb.resource_id = ? ORDER BY rb.id DESC LIMIT 100
  `).all(r.id);
  res.json({ resource: r, bookings: rows });
});

// تغيير حالة حجز (موافقة/رفض/إكمال/استعادة)
router.put('/resources/:id/bookings/:bid', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { status } = req.body || {};
  if (!['pending', 'approved', 'rejected', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' });
  }
  const b = db.prepare('SELECT * FROM resource_bookings WHERE id = ? AND resource_id = ?').get(req.params.bid, req.params.id);
  if (!b) return res.status(404).json({ error: 'الحجز غير موجود' });
  db.prepare('UPDATE resource_bookings SET status = ? WHERE id = ?').run(status, b.id);
  const r = db.prepare('SELECT name FROM resources WHERE id = ?').get(b.resource_id);
  if (status === 'approved') notify(b.user_id, '✅ تمت الموافقة على حجزك', `تمت الموافقة على حجز «${r.name}» خلال الفترة المحددة.`);
  if (status === 'rejected') notify(b.user_id, '❌ تم رفض الحجز', `عُذّر رفض حجز «${r.name}». راجع المواعيد المتاحة.`);
  audit(req.user.id, 'تغيير حالة حجز', `#${b.id} → ${status}`);
  res.json({ ok: true });
});

// ======= إدارة العمل التطوعي (المرحلة 15) =======
router.get('/volunteers', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM volunteer_applications va WHERE va.program_id = p.id) AS applications_count,
      (SELECT COUNT(*) FROM volunteer_applications va WHERE va.program_id = p.id AND va.status = 'pending') AS pending_count,
      (SELECT COALESCE(SUM(va.hours_logged),0) FROM volunteer_applications va WHERE va.program_id = p.id) AS hours_sum
    FROM volunteer_programs p ORDER BY p.id DESC
  `).all();
  res.json({ programs: rows });
});

router.post('/volunteers', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { title, type, description, location, starts_at, ends_at, required_skills, spots, active } = req.body || {};
  if (!title) return res.status(400).json({ error: 'العنوان مطلوب' });
  const info = db.prepare(`
    INSERT INTO volunteer_programs (title, type, description, location, starts_at, ends_at, required_skills, spots, active)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(title, type || 'activity', description || '', location || '', starts_at || null, ends_at || null, required_skills || '', Math.max(1, Number(spots) || 20), active === false ? 0 : 1);
  audit(req.user.id, 'إضافة برنامج تطوعي', title);
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/volunteers/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const p = db.prepare('SELECT * FROM volunteer_programs WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'البرنامج غير موجود' });
  const { title, type, description, location, starts_at, ends_at, required_skills, spots, active } = req.body || {};
  db.prepare(`
    UPDATE volunteer_programs SET title = ?, type = ?, description = ?, location = ?, starts_at = ?, ends_at = ?, required_skills = ?, spots = ?, active = ? WHERE id = ?
  `).run(title, type || 'activity', description || '', location || '', starts_at || null, ends_at || null, required_skills || '', Math.max(1, Number(spots) || 20), active === false ? 0 : 1, p.id);
  audit(req.user.id, 'تعديل برنامج تطوعي', title);
  res.json({ ok: true });
});

router.delete('/volunteers/:id', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  db.prepare('DELETE FROM volunteer_applications WHERE program_id = ?').run(req.params.id);
  db.prepare('DELETE FROM volunteer_programs WHERE id = ?').run(req.params.id);
  audit(req.user.id, 'حذف برنامج تطوعي', String(req.params.id));
  res.json({ ok: true });
});

// المتقدمون في برنامج
router.get('/volunteers/:id/applications', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const p = db.prepare('SELECT * FROM volunteer_programs WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'البرنامج غير موجود' });
  const rows = db.prepare(`
    SELECT va.*, u.name AS user_name, u.email AS user_email, u.avatar AS user_avatar
    FROM volunteer_applications va JOIN users u ON u.id = va.user_id
    WHERE va.program_id = ? ORDER BY va.id ASC
  `).all(p.id);
  res.json({ program: p, applications: rows });
});

// تغيير حالة طلب (موافقة/رفض/حضور/إكمال + ساعات)
router.put('/volunteers/:id/applications/:aid', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });
  const { status, hours_logged } = req.body || {};
  if (!['pending', 'approved', 'rejected', 'attended', 'completed', 'withdrawn'].includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' });
  }
  const app = db.prepare('SELECT * FROM volunteer_applications WHERE id = ? AND program_id = ?').get(req.params.aid, req.params.id);
  if (!app) return res.status(404).json({ error: 'الطلب غير موجود' });
  const p = db.prepare('SELECT title FROM volunteer_programs WHERE id = ?').get(app.program_id);
  const hours = Number(hours_logged) >= 0 ? Math.max(0, Number(hours_logged) || app.hours_logged) : app.hours_logged;
  db.prepare('UPDATE volunteer_applications SET status = ?, hours_logged = ? WHERE id = ?').run(status, hours, app.id);
  if (status === 'approved') notify(app.user_id, '✅ قبول تطوع', `تم قبول مشاركتك في «${p.title}».`);
  if (status === 'rejected') notify(app.user_id, '❌ رفض طلب تطوع', `عُذّر رفض طلبك في «${p.title}».`);
  if (status === 'attended' || status === 'completed') notify(app.user_id, '🎖️ ساعات التطوع', `سُجلت لك ${hours} ساعة في «${p.title}».`);
  audit(req.user.id, 'تغيير حالة طلب تطوع', `#${app.id} → ${status}`);
  res.json({ ok: true });
});

export default router;
