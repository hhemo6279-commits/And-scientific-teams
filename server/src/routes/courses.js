import { Router } from 'express';
import db from '../db.js';
import { getSubAdminSections, awardBadge, awardXP, notify } from '../auth.js';
import { levelInfo } from '../levels.js';

const router = Router();

router.get('/', (req, res) => {
  const sectionId = req.query.section_id;
  let rows;
  if (sectionId) {
    rows = db.prepare(`
      SELECT c.*, s.name AS section_name FROM courses c
      JOIN sections s ON s.id = c.section_id
      WHERE c.section_id = ? AND c.active = 1
    `).all(sectionId);
  } else {
    rows = db.prepare(`
      SELECT c.*, s.name AS section_name FROM courses c
      JOIN sections s ON s.id = c.section_id
      WHERE c.active = 1
    `).all();
  }
  res.json({ courses: rows });
});

router.get('/:id', (req, res) => {
  const course = db.prepare(`
    SELECT c.*, s.name AS section_name FROM courses c
    JOIN sections s ON s.id = c.section_id WHERE c.id = ?
  `).get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  const lessons = db.prepare('SELECT id, title, type, order_no FROM lessons WHERE course_id = ? ORDER BY order_no').all(course.id);
  const lessonProgress = db.prepare('SELECT lesson_id, completed FROM lesson_progress WHERE user_id = ?').all(req.user.id);
  const progressMap = Object.fromEntries(lessonProgress.map((p) => [p.lesson_id, p.completed]));
  const examPassed = !!db.prepare(`
    SELECT ea.id FROM exam_attempts ea JOIN exams e ON e.id = ea.exam_id
    WHERE ea.user_id = ? AND e.course_id = ? AND ea.passed = 1 LIMIT 1
  `).get(req.user.id, course.id);
  res.json({ course, lessons, progressMap, examPassed });
});

// تسجيل في دورة
router.post('/:id/enroll', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  try {
    db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (?,?)').run(req.user.id, course.id);
  } catch {
    return res.status(400).json({ error: 'أنت مسجل بالفعل' });
  }
  res.json({ ok: true, message: 'تم التسجيل في الدورة' });
});

// إنهاء درس
router.post('/:id/lessons/:lessonId/complete', (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ? AND course_id = ?').get(req.params.lessonId, req.params.id);
  if (!lesson) return res.status(404).json({ error: 'الدرس غير موجود' });
  db.prepare(`
    INSERT INTO lesson_progress (user_id, lesson_id, completed) VALUES (?,?,1)
    ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed = 1
  `).run(req.user.id, lesson.id);

  const total = db.prepare('SELECT COUNT(*) AS n FROM lessons WHERE course_id = ?').get(courseId(req.params.id)).n;
  const done = db.prepare('SELECT COUNT(*) AS n FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.user_id = ? AND l.course_id = ? AND lp.completed = 1').get(req.user.id, req.params.id).n;
  const progress = total === 0 ? 100 : Math.round((done / total) * 100);
  const completed = progress === 100 ? 1 : 0;

  db.prepare(`
    INSERT INTO enrollments (user_id, course_id, progress, completed) VALUES (?,?,?,?)
    ON CONFLICT(user_id, course_id) DO UPDATE SET progress = ?, completed = ?
  `).run(req.user.id, req.params.id, progress, completed, progress, completed);

  if (completed) awardBadge(req.user.id, 'first_course');
  awardXP(req.user.id, 15, `أكملت درس "${lesson.title}"`);

  res.json({ ok: true, progress, completed });
});

// جلب أسئلة اختبار درس (بدون الإجابات الصحيحة)
router.get('/:id/lessons/:lessonId/quiz', (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ? AND course_id = ? AND type = ?').get(req.params.lessonId, req.params.id, 'quiz');
  if (!lesson) return res.status(404).json({ error: 'الاختبار غير موجود' });
  const questions = db.prepare('SELECT id, question, options, order_no FROM quiz_questions WHERE lesson_id = ? ORDER BY order_no').all(lesson.id);
  const lastAttempt = db.prepare('SELECT * FROM quiz_attempts WHERE user_id = ? AND lesson_id = ? ORDER BY id DESC LIMIT 1').get(req.user.id, lesson.id);
  res.json({ lesson: { id: lesson.id, title: lesson.title }, questions, lastAttempt });
});

// تقديم إجابات الاختبار
router.post('/:id/lessons/:lessonId/quiz/submit', (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ? AND course_id = ? AND type = ?').get(req.params.lessonId, req.params.id, 'quiz');
  if (!lesson) return res.status(404).json({ error: 'الاختبار غير موجود' });
  const questions = db.prepare('SELECT * FROM quiz_questions WHERE lesson_id = ? ORDER BY order_no').all(lesson.id);
  const answers = (req.body && req.body.answers) || {};
  let score = 0;
  for (const q of questions) {
    if (answers[q.id] !== undefined && Number(answers[q.id]) === q.correct_index) score++;
  }
  const total = questions.length;
  const passed = total > 0 && score / total >= 0.5;

  db.prepare('INSERT INTO quiz_attempts (user_id, lesson_id, score, total, passed) VALUES (?,?,?,?,?)')
    .run(req.user.id, lesson.id, score, total, passed ? 1 : 0);

  // النجاح ينهي الدرس تلقائياً
  if (passed) {
    db.prepare(`
      INSERT INTO lesson_progress (user_id, lesson_id, completed) VALUES (?,?,1)
      ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed = 1
    `).run(req.user.id, lesson.id);
    const totalLessons = db.prepare('SELECT COUNT(*) AS n FROM lessons WHERE course_id = ?').get(courseId(req.params.id)).n;
    const done = db.prepare('SELECT COUNT(*) AS n FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.user_id = ? AND l.course_id = ? AND lp.completed = 1').get(req.user.id, req.params.id).n;
    const progress = totalLessons === 0 ? 100 : Math.round((done / totalLessons) * 100);
    const completed = progress === 100 ? 1 : 0;
    db.prepare(`
      INSERT INTO enrollments (user_id, course_id, progress, completed) VALUES (?,?,?,?)
      ON CONFLICT(user_id, course_id) DO UPDATE SET progress = ?, completed = ?
    `).run(req.user.id, req.params.id, progress, completed, progress, completed);
    if (completed) awardBadge(req.user.id, 'first_course');
    awardXP(req.user.id, 25, `اجتزت اختبار "${lesson.title}" بنجاح`);
  }

  res.json({ score, total, passed, progress: passed ? 100 : 0 });
});

// مجتمع الأسئلة والأجوبة للدورة
router.get('/:id/qa', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  const posts = db.prepare(`
    SELECT p.*, u.name AS user_name, u.avatar AS user_avatar
    FROM qa_posts p JOIN users u ON u.id = p.user_id
    WHERE p.course_id = ? ORDER BY p.id DESC
  `).all(course.id);
  const answers = db.prepare(`
    SELECT a.*, u.name AS user_name FROM qa_answers a
    JOIN users u ON u.id = a.user_id
    WHERE a.post_id IN (${posts.length ? posts.map(() => '?').join(',') : 'NULL'})
    ORDER BY a.id ASC
  `).all(...posts.map((p) => p.id));
  const byPost = {};
  for (const a of answers) {
    if (!byPost[a.post_id]) byPost[a.post_id] = [];
    byPost[a.post_id].push(a);
  }
  res.json({ posts: posts.map((p) => ({ ...p, answers: byPost[p.id] || [] })) });
});

router.post('/:id/qa', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  const { question } = req.body || {};
  if (!question || !question.trim()) return res.status(400).json({ error: 'اكتب سؤالك' });
  const info = db.prepare('INSERT INTO qa_posts (course_id, user_id, question) VALUES (?,?,?)').run(course.id, req.user.id, question.trim());
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.post('/qa/:postId/answers', (req, res) => {
  const post = db.prepare('SELECT * FROM qa_posts WHERE id = ?').get(req.params.postId);
  if (!post) return res.status(404).json({ error: 'السؤال غير موجود' });
  const { answer } = req.body || {};
  if (!answer || !answer.trim()) return res.status(400).json({ error: 'اكتب إجابتك' });
  db.prepare('INSERT INTO qa_answers (post_id, user_id, answer) VALUES (?,?,?)').run(post.id, req.user.id, answer.trim());
  res.json({ ok: true });
});

// ======= التقييمات والمراجعات =======
router.get('/:id/reviews', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  const reviews = db.prepare(`
    SELECT r.*, u.name AS user_name, u.avatar AS user_avatar
    FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.course_id = ? ORDER BY r.id DESC
  `).all(course.id);
  const avgRow = db.prepare('SELECT AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE course_id = ?').get(course.id);
  const mine = db.prepare('SELECT * FROM reviews WHERE user_id = ? AND course_id = ?').get(req.user.id, course.id);
  res.json({ reviews, avg: avgRow.avg ? Number(avgRow.avg).toFixed(1) : null, count: avgRow.n, mine });
});

router.post('/:id/reviews', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  const enrolled = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, course.id);
  if (!enrolled) return res.status(403).json({ error: 'يجب التسجيل في الدورة أولاً' });
  const { rating, comment } = req.body || {};
  const r = Math.round(Number(rating));
  if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'التقييم من 1 إلى 5' });
  db.prepare(`
    INSERT INTO reviews (user_id, course_id, rating, comment) VALUES (?,?,?,?)
    ON CONFLICT(user_id, course_id) DO UPDATE SET rating = ?, comment = ?
  `).run(req.user.id, course.id, r, comment || '', r, comment || '');
  res.json({ ok: true });
});

// ======= المعامل التطبيقية التفاعلية =======
router.get('/:id/lessons/:lessonId/lab', (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ? AND course_id = ? AND type = ?').get(req.params.lessonId, req.params.id, 'lab');
  if (!lesson) return res.status(404).json({ error: 'المعمل غير موجود' });
  const steps = db.prepare('SELECT id, title, instruction, order_no FROM lab_steps WHERE lesson_id = ? ORDER BY order_no').all(lesson.id);
  const solved = db.prepare(`
    SELECT step_id FROM lab_progress lp JOIN lab_steps ls ON ls.id = lp.step_id
    WHERE lp.user_id = ? AND ls.lesson_id = ? AND lp.solved = 1
  `).all(req.user.id, lesson.id);
  const solvedSet = new Set(solved.map((s) => s.step_id));
  res.json({ lesson: { id: lesson.id, title: lesson.title }, steps: steps.map((s) => ({ ...s, solved: solvedSet.has(s.id) })) });
});

router.post('/:id/lessons/:lessonId/lab/submit', (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ? AND course_id = ? AND type = ?').get(req.params.lessonId, req.params.id, 'lab');
  if (!lesson) return res.status(404).json({ error: 'المعمل غير موجود' });
  const { step_id, answer } = req.body || {};
  const step = db.prepare('SELECT * FROM lab_steps WHERE id = ? AND lesson_id = ?').get(step_id, lesson.id);
  if (!step) return res.status(404).json({ error: 'الخطوة غير موجودة' });
  const correct = String(answer || '').trim().toLowerCase() === String(step.answer).trim().toLowerCase();
  if (correct) {
    db.prepare(`
      INSERT INTO lab_progress (user_id, step_id, solved) VALUES (?,?,1)
      ON CONFLICT(user_id, step_id) DO UPDATE SET solved = 1
    `).run(req.user.id, step.id);
  }
  // إكمال كل الخطوات = إنهاء الدرس
  const total = db.prepare('SELECT COUNT(*) AS n FROM lab_steps WHERE lesson_id = ?').get(lesson.id).n;
  const done = db.prepare('SELECT COUNT(*) AS n FROM lab_progress lp JOIN lab_steps ls ON ls.id = lp.step_id WHERE lp.user_id = ? AND ls.lesson_id = ? AND lp.solved = 1').get(req.user.id, lesson.id).n;
  const allDone = total > 0 && done === total;
  if (allDone) {
    db.prepare(`
      INSERT INTO lesson_progress (user_id, lesson_id, completed) VALUES (?,?,1)
      ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed = 1
    `).run(req.user.id, lesson.id);
    const totalLessons = db.prepare('SELECT COUNT(*) AS n FROM lessons WHERE course_id = ?').get(courseId(req.params.id)).n;
    const doneLessons = db.prepare('SELECT COUNT(*) AS n FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id WHERE lp.user_id = ? AND l.course_id = ? AND lp.completed = 1').get(req.user.id, req.params.id).n;
    const progress = totalLessons === 0 ? 100 : Math.round((doneLessons / totalLessons) * 100);
    const completed = progress === 100 ? 1 : 0;
    db.prepare(`
      INSERT INTO enrollments (user_id, course_id, progress, completed) VALUES (?,?,?,?)
      ON CONFLICT(user_id, course_id) DO UPDATE SET progress = ?, completed = ?
    `).run(req.user.id, req.params.id, progress, completed, progress, completed);
    if (completed) awardBadge(req.user.id, 'first_course');
    awardXP(req.user.id, 30, `أكملت المعمل التطبيقي "${lesson.title}"`);
  }
  res.json({ ok: correct, done, total, completed: allDone });
});

// شهادة إتمام
router.post('/:id/certificate', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  const enroll = db.prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?').get(req.user.id, course.id);
  if (!enroll || !enroll.completed) return res.status(400).json({ error: 'يجب إكمال الدورة أولاً' });
  const existing = db.prepare('SELECT * FROM certificates WHERE user_id = ? AND course_id = ?').get(req.user.id, course.id);
  if (existing) return res.json({ certificate: existing });
  const code = `CERT-MK-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
  const examAttempt = db.prepare(`
    SELECT ea.score FROM exam_attempts ea JOIN exams e ON e.id = ea.exam_id
    WHERE ea.user_id = ? AND e.course_id = ? AND ea.passed = 1 ORDER BY ea.id DESC LIMIT 1
  `).get(req.user.id, course.id);
  const grade = examAttempt ? Number(examAttempt.score) : null;
  const info = db.prepare('INSERT INTO certificates (user_id, course_id, code, grade) VALUES (?,?,?,?)').run(req.user.id, course.id, code, grade);
  const certificate = db.prepare('SELECT * FROM certificates WHERE id = ?').get(info.lastInsertRowid);
  notify(req.user.id, '🎓 شهادة جديدة', `حصلت على شهادة إتمام: ${course.title} (${certificate.code})`);
  res.json({ certificate });
});

// شهادة قابلة للطباعة (HTML) — يمكن للمستخدم حفظها PDF من نافذة الطباعة
router.get('/:id/certificate/print', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  const cert = db.prepare('SELECT * FROM certificates WHERE user_id = ? AND course_id = ?').get(req.user.id, course.id);
  if (!cert) return res.status(400).json({ error: 'لا توجد شهادة لهذه الدورة' });
  const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(req.user.id);
  const level = levelInfo(db.prepare('SELECT points FROM users WHERE id = ?').get(req.user.id).points);
  const grade = cert.grade != null ? Number(cert.grade) : null;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>شهادة إتمام - ${course.title}</title>
<style>
  @page { size: landscape; margin: 20px; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2ff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .cert { width: 1100px; max-width: 100%; background: #fff; border: 8px solid #6c7bff; border-radius: 16px; padding: 40px 50px; box-shadow: 0 10px 40px rgba(0,0,0,.15); position: relative; }
  .cert::before { content: ''; position: absolute; inset: 12px; border: 2px solid #9f6cff; border-radius: 8px; pointer-events: none; }
  .center { text-align: center; }
  h1 { color: #6c7bff; font-size: 26px; margin: 4px 0; }
  .title { font-size: 44px; font-weight: 800; color: #1a1b2e; margin: 12px 0 4px; }
  .sub { color: #555; font-size: 18px; margin: 4px 0; }
  .name { font-size: 40px; font-weight: 800; color: #6c7bff; margin: 18px 0 4px; }
  .course { font-size: 26px; color: #333; margin: 6px 0; }
  .meta { color: #777; font-size: 14px; margin-top: 24px; }
  .code { font-size: 18px; letter-spacing: 2px; color: #9f6cff; font-weight: bold; direction: ltr; }
  .badges { margin: 16px 0; }
  .badges span { display: inline-block; background: #eef0ff; border: 1px solid #6c7bff; color: #6c7bff; border-radius: 20px; padding: 6px 16px; margin: 0 4px; font-size: 14px; }
  .print-btn { position: fixed; bottom: 20px; left: 20px; z-index: 10; }
  @media print { .print-btn { display: none; } body { background: #fff; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  <div class="cert">
    <div class="center">
      <h1>منصة MK التعليمية</h1>
      <div class="sub">شهادة إتمام دورة</div>
      <div class="name">${user.name}</div>
      <div class="sub">قد أكمل بنجاح دورة</div>
      <div class="course">${course.title}</div>
      <div class="badges">
        <span>المستوى: ${level.icon} ${level.title}</span>
        <span>القسم: ${course.section_id || '—'}</span>
        <span>التاريخ: ${cert.issued_at.slice(0, 10)}</span>
        ${grade != null ? `<span>الدرجة: ${grade}%</span>` : ''}
      </div>
      <div class="meta">
        <div>رمز التحقق: <span class="code">${cert.code}</span></div>
        <div style="margin-top:6px">تحقق من صحة الشهادة على: ${baseUrl}/verify</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

function courseId(id) {
  return Number(id);
}

// ======= الامتحان النهائي (للطالب) =======
// الحصول على الامتحان: معلومات + الأسئلة (الأسئلة بدون الإجابة الصحيحة)
router.get('/:id/exam', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  const exam = db.prepare('SELECT * FROM exams WHERE course_id = ?').get(course.id);
  if (!exam) return res.json({ exam: null });
  const enrollment = db.prepare('SELECT * FROM enrollments WHERE course_id = ? AND user_id = ?').get(course.id, req.user.id);
  if (!enrollment) return res.status(403).json({ error: 'سجّل في الدورة أولاً' });
  const questions = db.prepare('SELECT id, question, options, order_no FROM exam_questions WHERE exam_id = ? ORDER BY order_no').all(exam.id)
    .map((q) => ({ ...q, options: JSON.parse(q.options) }));
  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND user_id = ?').get(exam.id, req.user.id);
  res.json({ exam: { ...exam, questions, hasAttempt: !!attempt }, attempt });
});

// تقديم الامتحان
router.post('/:id/exam/submit', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'الدورة غير موجودة' });
  const exam = db.prepare('SELECT * FROM exams WHERE course_id = ?').get(course.id);
  if (!exam) return res.status(404).json({ error: 'لا يوجد امتحان لهذه الدورة' });
  const enrollment = db.prepare('SELECT * FROM enrollments WHERE course_id = ? AND user_id = ?').get(course.id, req.user.id);
  if (!enrollment) return res.status(403).json({ error: 'سجّل في الدورة أولاً' });
  const existing = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND user_id = ?').get(exam.id, req.user.id);
  if (existing) return res.status(400).json({ error: 'لقد أديت هذا الامتحان من قبل' });
  const { answers } = req.body || {};
  const questions = db.prepare('SELECT * FROM exam_questions WHERE exam_id = ?').all(exam.id);
  let score = 0;
  for (const q of questions) {
    if (answers && Number(answers[q.id]) === q.correct_index) score += 1;
  }
  const maxScore = questions.length || 1;
  const percent = Math.round((score / maxScore) * 100);
  const passed = percent >= exam.passing_score ? 1 : 0;
  db.prepare('INSERT INTO exam_attempts (exam_id, user_id, score, max_score, passed) VALUES (?,?,?,?,?)')
    .run(exam.id, req.user.id, percent, 100, passed);
  if (passed) {
    // إكمال الدورة: النجاح في الامتحان النهائي = إتمام الدورة + XP
    const newlyCompleted = !enrollment.completed ? 1 : 0;
    db.prepare(`
      INSERT INTO enrollments (user_id, course_id, progress, completed) VALUES (?,?,100,1)
      ON CONFLICT(user_id, course_id) DO UPDATE SET progress = 100, completed = 1
    `).run(req.user.id, course.id);
    if (newlyCompleted) awardBadge(req.user.id, 'first_course');
    awardXP(req.user.id, 10, `اجتزت امتحان "${course.title}" بنسبة ${percent}% — تم إكمال الدورة 🎓`);
  } else {
    notify(req.user.id, '📝 نتيجة الامتحان', `لم تجتز امتحان "${course.title}" — النتيجة ${percent}%`);
  }
  res.json({ score: percent, maxScore: 100, passed: !!passed, correct: score, total: maxScore });
});

export default router;
