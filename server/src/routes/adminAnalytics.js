import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'فقط الأدمن الرئيسي' });

  const one = (sql, ...a) => db.prepare(sql).get(...a);

  // ===== KPI الأساسية
  const students = one("SELECT COUNT(*) AS n FROM users WHERE role = 'student'").n;
  const newStudents30d = one("SELECT COUNT(*) AS n FROM users WHERE role = 'student' AND created_at >= datetime('now','-30 days')").n;
  const active7d = one("SELECT COUNT(DISTINCT user_id) AS n FROM refresh_tokens WHERE revoked = 0 AND created_at >= datetime('now','-7 days')").n;
  const active30d = one("SELECT COUNT(DISTINCT user_id) AS n FROM refresh_tokens WHERE created_at >= datetime('now','-30 days')").n;
  const courses = one('SELECT COUNT(*) AS n FROM courses').n;
  const lessons = one('SELECT COUNT(*) AS n FROM lessons').n;
  const progressDone = one('SELECT COUNT(*) AS n FROM lesson_progress WHERE completed = 1').n;
  const enrollmentsDone = one('SELECT COUNT(*) AS n FROM enrollments WHERE completed = 1').n;
  const certifications = one('SELECT COUNT(*) AS n FROM certificates').n;
  const bundleCerts = one('SELECT COUNT(*) AS n FROM bundle_certificates').n;
  const academyCerts = one('SELECT COUNT(*) AS n FROM academy_certificates').n;
  const examsAttempts = one('SELECT COUNT(*) AS n FROM exam_attempts').n;
  const challengesSolved = one('SELECT COUNT(*) AS n FROM challenge_submissions WHERE solved = 1').n;
  const totalXP = one('SELECT COALESCE(SUM(points),0) AS n FROM users').n;
  const auditAll = one('SELECT COUNT(*) AS n FROM audit_log').n;

  // ===== نمو التسجيلات شهرياً (6 أشهر)
  const monthlySignups = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS ym, COUNT(*) AS n
    FROM users WHERE role = 'student' AND created_at >= datetime('now','-6 months')
    GROUP BY ym ORDER BY ym
  `).all().map((r) => ({ label: r.ym, n: r.n }));

  // ===== عمليات الدخول اليومية (14 يوماً)
  const loginsByDay = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS n
    FROM refresh_tokens WHERE created_at >= datetime('now','-14 days')
    GROUP BY day ORDER BY day
  `).all().map((r) => ({ label: r.day.slice(5), n: r.n, full: r.day }));

  // ===== ساعات الذروة (توزيع عمليات الدخول على الساعات)
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, n: 0 }));
  db.prepare(`SELECT CAST(strftime('%H', created_at) AS INTEGER) AS h, COUNT(*) AS n FROM refresh_tokens GROUP BY h`)
    .all().forEach((r) => { if (byHour[r.h]) byHour[r.h].n = r.n; });

  // ===== المحتوى
  const coursesByLevel = db.prepare('SELECT level, COUNT(*) AS n FROM courses GROUP BY level').all();
  const topCourses = db.prepare(`
    SELECT c.title, COUNT(e.id) AS enrolled, SUM(CASE WHEN e.completed = 1 THEN 1 ELSE 0 END) AS done
    FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id
    GROUP BY c.id ORDER BY enrolled DESC LIMIT 5
  `).all().map((c) => ({ ...c, done: c.done || 0, completion: c.enrolled ? Math.round(((c.done || 0) / c.enrolled) * 100) : 0 }));

  // ===== النشاط وفق الأقسام (heatmap)
  const bySection = db.prepare(`
    SELECT COALESCE(s.name,'بدون قسم') AS name,
      COUNT(u.id) AS students,
      SUM(CASE WHEN u.created_at >= datetime('now','-30 days') THEN 1 ELSE 0 END) AS new30
    FROM users u LEFT JOIN sections s ON s.id = u.section_id
    WHERE u.role = 'student'
    GROUP BY s.id ORDER BY students DESC
  `).all();

  // ===== النظام البيئي للوحدات
  const ecosystem = {
    events: one('SELECT COUNT(*) AS n FROM events').n,
    eventRegs: one('SELECT COUNT(*) AS n FROM event_registrations').n,
    opportunities: one('SELECT COUNT(*) AS n FROM opportunities').n,
    oppApps: one('SELECT COUNT(*) AS n FROM opportunity_applications').n,
    resources: one('SELECT COUNT(*) AS n FROM resources').n,
    bookings: one('SELECT COUNT(*) AS n FROM resource_bookings').n,
    volunteers: one('SELECT COUNT(*) AS n FROM volunteer_programs').n,
    volunteerApps: one('SELECT COUNT(*) AS n FROM volunteer_applications').n,
    groups: one('SELECT COUNT(*) AS n FROM study_groups').n,
    groupMembers: one('SELECT COUNT(*) AS n FROM group_members').n,
    liveRooms: one('SELECT COUNT(*) AS n FROM live_rooms').n,
    liveAttendance: one('SELECT COUNT(*) AS n FROM live_attendance').n,
    qaPosts: one('SELECT COUNT(*) AS n FROM qa_posts').n,
    messages: one('SELECT COUNT(*) AS n FROM messages').n,
  };

  res.json({
    kpis: {
      students, newStudents30d, active7d, active30d,
      courses, lessons, progressDone, enrollmentsDone,
      certifications: certifications + bundleCerts + academyCerts,
      examsAttempts, challengesSolved, totalXP, auditAll,
      retention7d: students ? Math.round((active7d / students) * 1000) / 10 : 0,
      retention30d: students ? Math.round((active30d / students) * 1000) / 10 : 0,
    },
    growth: { monthlySignups, loginsByDay, byHour },
    content: { coursesByLevel, topCourses },
    heatmap: bySection,
    ecosystem,
  });
});

export default router;