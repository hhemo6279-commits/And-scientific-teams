import { Router } from 'express';
import db from '../db.js';
import { notify } from '../auth.js';
import { isFeatureEnabled } from '../settings.js';

const router = Router();

// قائمة مجموعاتي (التي أنشأتها أو انضممت إليها) + المجموعات المقترحة لقسمي
router.get('/', (req, res) => {
  if (!isFeatureEnabled('groups')) return res.json({ myGroups: [], suggested: [], disabled: true });
  const user = db.prepare('SELECT section_id FROM users WHERE id = ?').get(req.user.id);
  const myGroups = db.prepare(`
    SELECT g.*, u.name AS owner_name, u.avatar AS owner_avatar,
      (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count,
      (SELECT COUNT(*) FROM group_posts gp WHERE gp.group_id = g.id) AS posts_count,
      (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?) AS is_member
    FROM study_groups g
    JOIN users u ON u.id = g.owner_id
    JOIN group_members gm2 ON gm2.group_id = g.id AND gm2.user_id = ?
    ORDER BY g.created_at DESC
  `).all(req.user.id, req.user.id);
  const suggested = db.prepare(`
    SELECT g.*, u.name AS owner_name, u.avatar AS owner_avatar,
      (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS members_count,
      (SELECT COUNT(*) FROM group_posts gp WHERE gp.group_id = g.id) AS posts_count,
      (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.user_id = ?) AS is_member
    FROM study_groups g
    JOIN users u ON u.id = g.owner_id
    WHERE g.section_id = ? AND g.id NOT IN (SELECT group_id FROM group_members WHERE user_id = ?)
    ORDER BY g.created_at DESC
  `).all(req.user.id, user.section_id || 0, req.user.id);
  res.json({ myGroups, suggested });
});

// إنشاء مجموعة
router.post('/', (req, res) => {
  const { name, description, section_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'اسم المجموعة مطلوب' });
  const user = db.prepare('SELECT section_id FROM users WHERE id = ?').get(req.user.id);
  const info = db.prepare('INSERT INTO study_groups (name, description, section_id, owner_id) VALUES (?,?,?,?)')
    .run(name, description || '', section_id || user.section_id || null, req.user.id);
  db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?,?,?)').run(info.lastInsertRowid, req.user.id, 'owner');
  res.json({ ok: true, id: info.lastInsertRowid });
});

// تفاصيل مجموعة (مع الأعضاء والمنشورات)
router.get('/:id', (req, res) => {
  const group = db.prepare('SELECT * FROM study_groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'المجموعة غير موجودة' });
  const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(group.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'انضم إلى المجموعة أولاً' });
  const members = db.prepare(`
    SELECT u.id, u.name, u.avatar, u.points, gm.role, gm.joined_at
    FROM group_members gm JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id = ? ORDER BY gm.joined_at
  `).all(group.id);
  const posts = db.prepare(`
    SELECT gp.*, u.name AS user_name, u.avatar AS user_avatar
    FROM group_posts gp JOIN users u ON u.id = gp.user_id
    WHERE gp.group_id = ? ORDER BY gp.created_at DESC LIMIT 50
  `).all(group.id);
  const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(group.owner_id);
  res.json({ group: { ...group, owner_name: owner.name, isOwner: group.owner_id === req.user.id }, members, posts });
});

// الانضمام لمجموعة
router.post('/:id/join', (req, res) => {
  const group = db.prepare('SELECT * FROM study_groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'المجموعة غير موجودة' });
  try {
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?,?)').run(group.id, req.user.id);
    const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    notify(group.owner_id, '👥 انضمام جديد', `انضم ${owner.name} إلى مجموعتك "${group.name}"`);
    res.json({ ok: true });
  } catch {
    return res.status(400).json({ error: 'أنت عضو بالفعل' });
  }
});

// مغادرة مجموعة
router.post('/:id/leave', (req, res) => {
  const group = db.prepare('SELECT * FROM study_groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'المجموعة غير موجودة' });
  if (group.owner_id === req.user.id) {
    // المالك يغادر: تنقل الملكية لأقدم عضو أو تحذف المجموعة
    const next = db.prepare('SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ? ORDER BY joined_at LIMIT 1').get(group.id, req.user.id);
    if (!next) {
      db.prepare('DELETE FROM group_posts WHERE group_id = ?').run(group.id);
      db.prepare('DELETE FROM group_members WHERE group_id = ?').run(group.id);
      db.prepare('DELETE FROM study_groups WHERE id = ?').run(group.id);
      return res.json({ ok: true, deleted: true });
    }
    db.prepare('UPDATE study_groups SET owner_id = ? WHERE id = ?').run(next.user_id, group.id);
    db.prepare('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?').run('owner', group.id, next.user_id);
  }
  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(group.id, req.user.id);
  res.json({ ok: true });
});

// نشر منشور
router.post('/:id/posts', (req, res) => {
  const group = db.prepare('SELECT * FROM study_groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'المجموعة غير موجودة' });
  const member = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?').get(group.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'انضم إلى المجموعة أولاً' });
  const { content } = req.body || {};
  if (!content) return res.status(400).json({ error: 'اكتب محتوى المنشور' });
  const info = db.prepare('INSERT INTO group_posts (group_id, user_id, content) VALUES (?,?,?)').run(group.id, req.user.id, content);
  res.json({ ok: true, id: info.lastInsertRowid });
});

export default router;
