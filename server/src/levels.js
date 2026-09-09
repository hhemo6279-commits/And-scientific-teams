// نظام المستويات والألقاب بناءً على نقاط الخبرة (XP)
const LEVELS = [
  { xp: 0, title: 'مبتدئ', icon: '🌱' },
  { xp: 200, title: 'ناشط', icon: '📘' },
  { xp: 500, title: 'مجتهد', icon: '📗' },
  { xp: 1000, title: 'محترف', icon: '📈' },
  { xp: 1800, title: 'خبير', icon: '💎' },
  { xp: 3000, title: 'أستاذ', icon: '🎓' },
  { xp: 5000, title: 'أسطورة', icon: '👑' },
];

export function levelInfo(xp) {
  const n = Math.max(0, Number(xp) || 0);
  let level = 1;
  for (const l of LEVELS) {
    if (n >= l.xp) level = LEVELS.indexOf(l) + 1;
  }
  const current = LEVELS[level - 1];
  const next = LEVELS[level];
  let progress = 100;
  let needed = 0;
  if (next) {
    const span = next.xp - current.xp;
    const got = n - current.xp;
    progress = Math.min(100, Math.round((got / span) * 100));
    needed = next.xp - n;
  }
  return { level, title: current.title, icon: current.icon, progress, needed, nextTitle: next ? next.title : null, xp: n };
}
