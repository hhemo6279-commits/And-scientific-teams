import { Router } from 'express';
import db from '../db.js';
import { notify } from '../auth.js';
import { isFeatureEnabled } from '../settings.js';

const router = Router();

const TYPE_LABELS = {
  internship: 'تدريب',
  job: 'وظيفة',
  scholarship: 'منحة',
  competition: 'مسابقة',
  program: 'برنامج',
};

// ======= تطابق المهارات (Smart Opportunity Matching - V1) =======
// تقدير مبني على: دورات مكتملة (15 نقطة) + تحديات محلولة (5 نقاط) + شهادات (10 نقاط)
function skillProfile(userId) {
  const coursesDone = db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE user_id = ? AND completed = 1').get(userId).n;
  const challenges = db.prepare('SELECT COUNT(*) AS n FROM challenge_submissions WHERE user_id = ? AND solved = 1').get(userId).n;
  const certs = db.prepare('SELECT COUNT(*) AS n FROM certificates WHERE user_id = ?').get(userId).n;
  const score = Math.min(100, coursesDone * 15 + challenges * 5 + certs * 10);
  return { coursesDone, challenges, certs, score };
}

router.get('/', (req, res) => {
  if (!isFeatureEnabled('opportunities')) return res.json({ opportunities: [], disabled: true });
  const profile = skillProfile(req.user.id);
  const opportunities = db.prepare(`
    SELECT o.*,
      (SELECT COUNT(*) FROM opportunity_applications oa WHERE oa.opportunity_id = o.id) AS applicants_count
    FROM opportunities o
    WHERE o.active = 1 ORDER BY (o.deadline IS NULL), o.deadline ASC, o.id DESC
  `).all();
  const myApps = db.prepare(`
    SELECT oa.opportunity_id, oa.status, oa.created_at FROM opportunity_applications oa
    WHERE oa.user_id = ? AND oa.opportunity_id IN (${opportunities.length ? opportunities.map(() => '?').join(',') : 'NULL'})
  `).all(req.user.id);
  const myMap = Object.fromEntries(myApps.map((a) => [a.opportunity_id, a]));
  res.json({
    opportunities: opportunities.map((o) => ({
      ...o,
      type_label: TYPE_LABELS[o.type] || o.type,
      my_application: myMap[o.id] || null,
      fit: Math.min(100, profile.score + (o.eligibility ? 10 : 0)),
    })),
    profile,
  });
});

// تفاصيل فرصة + حالة طلبي
router.get('/:id', (req, res) => {
  const opp = db.prepare(`
    SELECT o.*,
      (SELECT COUNT(*) FROM opportunity_applications oa WHERE oa.opportunity_id = o.id) AS applicants_count,
      (SELECT COUNT(*) FROM opportunity_applications oa WHERE oa.opportunity_id = o.id AND oa.status = 'accepted') AS accepted_count
    FROM opportunities o WHERE o.id = ?
  `).get(req.params.id);
  if (!opp) return res.status(404).json({ error: 'الفرصة غير موجودة' });
  const my = db.prepare('SELECT * FROM opportunity_applications WHERE opportunity_id = ? AND user_id = ?').get(opp.id, req.user.id);
  res.json({
    opportunity: { ...opp, type_label: TYPE_LABELS[opp.type] || opp.type, fit: Math.min(100, skillProfile(req.user.id).score + (opp.eligibility ? 10 : 0)) },
    my_application: my,
    profile: skillProfile(req.user.id),
  });
});

// تقديم طلب
router.post('/:id/apply', (req, res) => {
  const opp = db.prepare('SELECT * FROM opportunities WHERE id = ? AND active = 1').get(req.params.id);
  if (!opp) return res.status(404).json({ error: 'الفرصة غير موجودة' });
  if (opp.deadline && new Date(opp.deadline) < new Date()) return res.status(400).json({ error: 'انتهت مدة التقديم على هذه الفرصة' });
  const accepted = db.prepare(`SELECT COUNT(*) AS n FROM opportunity_applications WHERE opportunity_id = ? AND status = 'accepted'`).get(opp.id).n;
  if (accepted >= opp.spots) return res.status(400).json({ error: 'اكتمل عدد المقاعد في هذه الفرصة' });
  const note = String((req.body || {}).note || '').trim();
  try {
    db.prepare('INSERT INTO opportunity_applications (opportunity_id, user_id, note) VALUES (?,?,?)').run(opp.id, req.user.id, note || null);
  } catch {
    return res.status(400).json({ error: 'لقد تقدمت لهذه الفرصة مسبقاً' });
  }
  notify(req.user.id, '💼 تم تقديم طلبك', `تقدّمت إلى: ${opp.title}`);
  res.json({ ok: true });
});

// سحب الطلب (قبل القرار فقط)
router.delete('/:id/apply', (req, res) => {
  const info = db.prepare(`DELETE FROM opportunity_applications WHERE opportunity_id = ? AND user_id = ? AND status = 'pending'`).run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(400).json({ error: 'لا يمكن سحب الطلب بعد صدور القرار' });
  res.json({ ok: true });
});

// طلباتي
router.get('/mine/applications', (req, res) => {
  const rows = db.prepare(`
    SELECT oa.*, o.title, o.type, o.organization, o.deadline
    FROM opportunity_applications oa
    JOIN opportunities o ON o.id = oa.opportunity_id
    WHERE oa.user_id = ? ORDER BY oa.id DESC
  `).all(req.user.id);
  res.json({ applications: rows.map((r) => ({ ...r, type_label: TYPE_LABELS[r.type] || r.type })) });
});

export default router;