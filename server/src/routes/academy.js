import { Router } from 'express';
import db from '../db.js';
import { notify, awardXP } from '../auth.js';
import { isFeatureEnabled } from '../settings.js';

const router = Router();

// قائمة مسارات الأكاديمية الوطنية
router.get('/', (req, res) => {
  if (!isFeatureEnabled('academy')) return res.json({ tracks: [], disabled: true });
  const tracks = db.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM academy_stages st WHERE st.track_id = t.id) AS stages_count,
      (SELECT COUNT(*) FROM academy_enrollments ae WHERE ae.track_id = t.id) AS students_count
    FROM academy_tracks t WHERE t.active = 1 ORDER BY t.id
  `).all();
  const myTracks = db.prepare('SELECT track_id, progress, completed FROM academy_enrollments WHERE user_id = ?').all(req.user.id);
  const myMap = Object.fromEntries(myTracks.map((m) => [m.track_id, m]));
  res.json({ tracks: tracks.map((t) => ({ ...t, myProgress: myMap[t.id] || null })) });
});

// تفاصيل مسار: مراحله المتسلسلة مع حالة القفل/الإتمام
router.get('/:id', (req, res) => {
  const track = db.prepare('SELECT * FROM academy_tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'المسار غير موجود' });

  const myCourses = db.prepare('SELECT course_id, completed FROM enrollments WHERE user_id = ?').all(req.user.id);
  const courseDone = new Set(myCourses.filter((e) => e.completed).map((e) => e.course_id));
  const solvedCh = db.prepare('SELECT challenge_id FROM challenge_submissions WHERE user_id = ? AND solved = 1').all(req.user.id);
  const chSolved = new Set(solvedCh.map((s) => s.challenge_id));

  const stages = db.prepare(`
    SELECT st.*, c.title AS course_title, c.section_id AS course_section, c.level AS course_level,
      ch.title AS challenge_title, ch.points AS challenge_points
    FROM academy_stages st
    LEFT JOIN courses c ON c.id = st.course_id
    LEFT JOIN challenges ch ON ch.id = st.challenge_id
    WHERE st.track_id = ? ORDER BY st.order_no, st.id
  `).all(track.id);

  let prevDone = true;
  const enriched = stages.map((s, i) => {
    const courseDoneNow = s.course_id ? courseDone.has(s.course_id) : true;
    const challengeDoneNow = !s.challenge_id || chSolved.has(s.challenge_id);
    const done = courseDoneNow && challengeDoneNow;
    const locked = i > 0 && !prevDone;
    prevDone = done;
    return { ...s, courseDone: !!courseDoneNow, challengeDone: !!challengeDoneNow, done, locked };
  });

  const enrolled = db.prepare('SELECT * FROM academy_enrollments WHERE track_id = ? AND user_id = ?').get(track.id, req.user.id);
  const doneCount = enriched.filter((s) => s.done).length;
  const total = enriched.length;
  const progress = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const completed = total > 0 && doneCount === total ? 1 : 0;
  if (enrolled && (enrolled.progress !== progress || enrolled.completed !== completed)) {
    db.prepare('UPDATE academy_enrollments SET progress = ?, completed = ? WHERE id = ?').run(progress, completed, enrolled.id);
  }
  const certificate = db.prepare('SELECT * FROM academy_certificates WHERE track_id = ? AND user_id = ?').get(track.id, req.user.id);

  res.json({ track, stages: enriched, enrolled, progress, completed, doneCount, total, certificate });
});

// التسجيل في مسار
router.post('/:id/enroll', (req, res) => {
  const track = db.prepare('SELECT * FROM academy_tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'المسار غير موجود' });
  try {
    db.prepare('INSERT INTO academy_enrollments (user_id, track_id) VALUES (?,?)').run(req.user.id, track.id);
    notify(req.user.id, '🎓 الأكاديمية الوطنية', `انضممت إلى المسار: ${track.title}`);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'أنت منضم إلى هذا المسار بالفعل' });
  }
});

// شهادة إتمام المسار (تُصدر بعد إكمال كل المراحل)
router.post('/:id/certificate', (req, res) => {
  const track = db.prepare('SELECT * FROM academy_tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'المسار غير موجود' });
  const ae = db.prepare('SELECT * FROM academy_enrollments WHERE track_id = ? AND user_id = ?').get(track.id, req.user.id);
  if (!ae || !ae.completed) return res.status(400).json({ error: 'أكمل جميع مراحل المسار أولاً' });
  const existing = db.prepare('SELECT * FROM academy_certificates WHERE track_id = ? AND user_id = ?').get(track.id, req.user.id);
  if (existing) return res.json({ certificate: existing });
  const code = `ACAD-MK-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;
  const info = db.prepare('INSERT INTO academy_certificates (user_id, track_id, code) VALUES (?,?,?)').run(req.user.id, track.id, code);
  const cert = db.prepare('SELECT * FROM academy_certificates WHERE id = ?').get(info.lastInsertRowid);
  awardXP(req.user.id, 50, `أتممت المسار الأكاديمي "${track.title}" 🎓`);
  notify(req.user.id, '🎓 شهادة الأكاديمية', `حصلت على شهادة المسار: ${track.title} (${cert.code})`);
  res.json({ certificate: cert });
});

// شهادة قابلة للطباعة
router.get('/:id/certificate/print', (req, res) => {
  const track = db.prepare('SELECT * FROM academy_tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'المسار غير موجود' });
  const cert = db.prepare('SELECT * FROM academy_certificates WHERE track_id = ? AND user_id = ?').get(track.id, req.user.id);
  if (!cert) return res.status(400).json({ error: 'لا توجد شهادة لهذا المسار' });
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
  const stages = db.prepare('SELECT COUNT(*) AS n FROM academy_stages WHERE track_id = ?').get(track.id).n;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>شهادة أكاديمية - ${track.title}</title>
<style>
  @page { size: landscape; margin: 20px; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2ff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .cert { width: 1100px; max-width: 100%; background: #fff; border: 8px solid #6c7bff; border-radius: 16px; padding: 40px 50px; box-shadow: 0 10px 40px rgba(0,0,0,.15); position: relative; }
  .cert::before { content: ''; position: absolute; inset: 12px; border: 2px solid #9f6cff; border-radius: 8px; pointer-events: none; }
  .center { text-align: center; }
  h1 { color: #6c7bff; font-size: 26px; margin: 4px 0; }
  .title { font-size: 40px; font-weight: 800; color: #1a1b2e; margin: 12px 0 4px; }
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
      <h1>🛡️ الأكاديمية الوطنية</h1>
      <div class="sub">شهادة إتمام مسار أكاديمي</div>
      <div class="name">${user.name}</div>
      <div class="sub">أتمّ بنجاح المسار التدريبي المتسلسل</div>
      <div class="course">${track.title}</div>
      <div class="badges">
        <span>المراحل: ${stages} مرحلة</span>
        <span>التاريخ: ${cert.issued_at.slice(0, 10)}</span>
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

export default router;