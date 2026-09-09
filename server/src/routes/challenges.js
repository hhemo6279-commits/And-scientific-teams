import { Router } from 'express';
import db from '../db.js';
import { awardBadge, awardXP } from '../auth.js';
import { isFeatureEnabled } from '../settings.js';

const router = Router();

// قائمة التحديات المتاحة للطالب
router.get('/', (req, res) => {
  if (!isFeatureEnabled('challenges')) return res.json({ challenges: [], disabled: true });
  const challenges = db.prepare(`
    SELECT ch.id, ch.section_id, ch.title, ch.description, ch.points, ch.difficulty, s.name AS section_name
    FROM challenges ch JOIN sections s ON s.id = ch.section_id
    ORDER BY ch.points ASC
  `).all();
  const solvedRows = db.prepare('SELECT challenge_id FROM challenge_submissions WHERE user_id = ? AND solved = 1').all(req.user.id);
  const solvedSet = new Set(solvedRows.map((r) => r.challenge_id));
  res.json({ challenges: challenges.map((c) => ({ ...c, solved: solvedSet.has(c.id) })) });
});

// تقديم إجابة (flag)
router.post('/:id/submit', (req, res) => {
  const { flag } = req.body || {};
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'التحدي غير موجود' });
  if (String(flag || '').trim() !== String(challenge.flag).trim()) {
    return res.json({ ok: false, message: 'إجابة خاطئة، حاول مرة أخرى' });
  }
  db.prepare(`
    INSERT INTO challenge_submissions (user_id, challenge_id, solved) VALUES (?,?,1)
    ON CONFLICT(user_id, challenge_id) DO UPDATE SET solved = 1
  `).run(req.user.id, challenge.id);
  awardXP(req.user.id, challenge.points, `حللت التحدي "${challenge.title}"`);
  awardBadge(req.user.id, 'challenge_rookie');
  res.json({ ok: true, points: challenge.points, message: 'إجابة صحيحة! أضفت ' + challenge.points + ' نقطة' });
});

export default router;
