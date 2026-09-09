import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data.db');

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec('PRAGMA foreign_keys = ON');

// ترقية: إضافة عمود النقاط للمستخدمين إن لم يوجد
const cols = db.prepare('PRAGMA table_info(users)').all();
if (!cols.some((c) => c.name === 'points')) {
  db.exec('ALTER TABLE users ADD COLUMN points INTEGER NOT NULL DEFAULT 0');
}
if (!cols.some((c) => c.name === 'section_id')) {
  db.exec('ALTER TABLE users ADD COLUMN section_id INTEGER');
}
if (!cols.some((c) => c.name === 'google_sub')) {
  db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT');
}
if (!cols.some((c) => c.name === 'mfa_secret')) {
  db.exec('ALTER TABLE users ADD COLUMN mfa_secret TEXT');
}
if (!cols.some((c) => c.name === 'mfa_enabled')) {
  db.exec('ALTER TABLE users ADD COLUMN mfa_enabled INTEGER NOT NULL DEFAULT 0');
}
if (!cols.some((c) => c.name === 'mfa_recovery')) {
  db.exec('ALTER TABLE users ADD COLUMN mfa_recovery TEXT');
}
if (!cols.some((c) => c.name === 'token_version')) {
  db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0');
}

// ترقية: أعمدة الدورات المحسنة
const courseCols = db.prepare('PRAGMA table_info(courses)').all();
for (const [name, def] of [
  ['duration_hours', 'INTEGER DEFAULT 0'],
  ['outcomes', 'TEXT'],
  ['prerequisites', 'TEXT'],
  ['instructor', 'TEXT'],
  ['language', "TEXT DEFAULT 'العربية'"],
]) {
  if (!courseCols.some((c) => c.name === name)) {
    db.exec(`ALTER TABLE courses ADD COLUMN ${name} ${def}`);
  }
}

// ترقية: عمود درجة الشهادة (من الامتحان النهائي)
const certCols = db.prepare('PRAGMA table_info(certificates)').all();
if (!certCols.some((c) => c.name === 'grade')) {
  db.exec('ALTER TABLE certificates ADD COLUMN grade REAL');
}

// ترقية: أعمدة الجلسات (بيانات الجهاز + IP لمراقبة الجلسات)
const rtCols = db.prepare('PRAGMA table_info(refresh_tokens)').all();
if (!rtCols.some((c) => c.name === 'device')) {
  db.exec('ALTER TABLE refresh_tokens ADD COLUMN device TEXT');
}
if (!rtCols.some((c) => c.name === 'ip')) {
  db.exec('ALTER TABLE refresh_tokens ADD COLUMN ip TEXT');
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','main_admin','sub_admin')),
  avatar TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  google_sub TEXT
);

CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id),
  title TEXT NOT NULL,
  description TEXT,
  level TEXT DEFAULT 'مبتدئ',
  price INTEGER DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  duration_hours INTEGER DEFAULT 0,
  outcomes TEXT,
  prerequisites TEXT,
  instructor TEXT,
  language TEXT DEFAULT 'العربية'
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text','video','lab','quiz')),
  order_no INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  progress INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  lesson_id INTEGER NOT NULL REFERENCES lessons(id),
  completed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS sub_admin_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  section_id INTEGER NOT NULL REFERENCES sections(id),
  UNIQUE(user_id, section_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS live_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER,
  title TEXT NOT NULL,
  host_id INTEGER REFERENCES users(id),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended')),
  scheduled_at TEXT,
  participant_count INTEGER NOT NULL DEFAULT 0,
  token TEXT
);

CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL REFERENCES sections(id),
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 100,
  flag TEXT,
  difficulty TEXT DEFAULT 'سهل'
);

CREATE TABLE IF NOT EXISTS challenge_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  challenge_id INTEGER NOT NULL REFERENCES challenges(id),
  solved INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, challenge_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  code TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id),
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  order_no INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  lesson_id INTEGER NOT NULL REFERENCES lessons(id),
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS qa_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  question TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS qa_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES qa_posts(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS user_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  badge_id INTEGER NOT NULL REFERENCES badges(id),
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS lab_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id),
  title TEXT NOT NULL,
  instruction TEXT,
  answer TEXT NOT NULL,
  order_no INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lab_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  step_id INTEGER NOT NULL REFERENCES lab_steps(id),
  solved INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, step_id)
);

CREATE TABLE IF NOT EXISTS live_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES live_rooms(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  left_at TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  recipient_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS live_chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES live_rooms(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS live_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES live_rooms(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS live_hands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES live_rooms(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS bundles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📦',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bundle_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bundle_id INTEGER NOT NULL REFERENCES bundles(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  order_no INTEGER DEFAULT 0,
  UNIQUE(bundle_id, course_id)
);

CREATE TABLE IF NOT EXISTS bundle_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bundle_id INTEGER NOT NULL REFERENCES bundles(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  progress INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(bundle_id, user_id)
);

CREATE TABLE IF NOT EXISTS bundle_certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bundle_id INTEGER NOT NULL REFERENCES bundles(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  code TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  score REAL,
  max_score REAL DEFAULT 100,
  note TEXT,
  graded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(course_id, user_id)
);

CREATE TABLE IF NOT EXISTS instructor_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  course_id INTEGER NOT NULL REFERENCES courses(id),
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL UNIQUE REFERENCES courses(id),
  title TEXT NOT NULL DEFAULT 'الامتحان النهائي',
  passing_score REAL DEFAULT 60,
  duration_minutes INTEGER DEFAULT 30,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exam_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id),
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL DEFAULT 0,
  order_no INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  score REAL,
  max_score REAL,
  passed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(exam_id, user_id)
);

CREATE TABLE IF NOT EXISTS schedule_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'محاضرة',
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  section_id INTEGER REFERENCES sections(id),
  course_id INTEGER REFERENCES courses(id),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedule_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES schedule_items(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  reminded INTEGER DEFAULT 0,
  UNIQUE(schedule_id, user_id)
);

CREATE TABLE IF NOT EXISTS study_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  section_id INTEGER REFERENCES sections(id),
  owner_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES study_groups(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES study_groups(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  revoked INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS academy_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS academy_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id INTEGER NOT NULL REFERENCES academy_tracks(id),
  order_no INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  course_id INTEGER REFERENCES courses(id),
  challenge_id INTEGER REFERENCES challenges(id)
);

CREATE TABLE IF NOT EXISTS academy_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  track_id INTEGER NOT NULL REFERENCES academy_tracks(id),
  progress INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, track_id)
);

CREATE TABLE IF NOT EXISTS academy_certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  track_id INTEGER NOT NULL REFERENCES academy_tracks(id),
  code TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  description TEXT
);

CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('internship','job','scholarship','competition','program')),
  organization TEXT,
  description TEXT,
  location TEXT,
  deadline TEXT,
  eligibility TEXT,
  spots INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opportunity_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(opportunity_id, user_id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'activity' CHECK (type IN ('conference','workshop','seminar','training','competition','activity')),
  description TEXT,
  location TEXT,
  starts_at TEXT,
  ends_at TEXT,
  capacity INTEGER NOT NULL DEFAULT 100,
  speaker TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  attended INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'room' CHECK (type IN ('room','lab','equipment','device','training')),
  description TEXT,
  location TEXT,
  capacity INTEGER NOT NULL DEFAULT 1,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resource_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id INTEGER NOT NULL REFERENCES resources(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  purpose TEXT,
  booked_from TEXT,
  booked_until TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled','completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS volunteer_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'activity' CHECK (type IN ('campaign','initiative','activity','relief')),
  description TEXT,
  location TEXT,
  starts_at TEXT,
  ends_at TEXT,
  required_skills TEXT,
  spots INTEGER NOT NULL DEFAULT 20,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS volunteer_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL REFERENCES volunteer_programs(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  skills TEXT,
  hours_committed INTEGER NOT NULL DEFAULT 1,
  hours_logged INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn','attended','completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(program_id, user_id)
);
`);

// إعدادات منصة افتراضية (تُنشأ مرة واحدة فقط)
const SETTING_DEFAULTS = {
  site_name: 'منصة MK التعليمية',
  maintenance_mode: '0',
  registration_open: '1',
  password_min_length: '6',
  password_require_uppercase: '0',
  password_require_number: '0',
  password_require_symbol: '0',
  mfa_required_for_admins: '0',
  session_timeout_minutes: '120',
};
db.exec('BEGIN');
try {
  for (const [k, v] of Object.entries(SETTING_DEFAULTS)) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)').run(k, v);
  }
  db.exec('COMMIT');
} catch { db.exec('ROLLBACK'); }

// مفاتيح ميزات (Feature Flags) افتراضية
const FLAG_DEFAULTS = [
  ['challenges', 1, 'التحديات (CTF)'],
  ['groups', 1, 'المجموعات الدراسية'],
  ['live', 1, 'البث المباشر'],
  ['bundles', 1, 'الحقائب التعليمية'],
  ['academy', 1, 'الأكاديمية الوطنية'],
  ['offline', 1, 'الدروس دون اتصال'],
  ['messages', 1, 'الرسائل الخاصة'],
  ['schedule', 1, 'الجدول الزمني'],
  ['opportunities', 1, 'الفرص (تدريب/وظائف/منح)'],
  ['events', 1, 'الفعاليات والمؤتمرات'],
  ['resources', 1, 'المرافق والقاعات والمعدات'],
  ['volunteers', 1, 'العمل التطوعي'],
];
db.exec('BEGIN');
try {
  for (const [k, en, d] of FLAG_DEFAULTS) {
    db.prepare('INSERT OR IGNORE INTO feature_flags (key, enabled, description) VALUES (?,?,?)').run(k, en, d);
  }
  db.exec('COMMIT');
} catch { db.exec('ROLLBACK'); }

// بيانات تجريبية ذاتية للفرص: تُنشأ فقط إن لم توجد أي فرص بعد
if (db.prepare('SELECT COUNT(*) AS n FROM opportunities').get().n === 0) {
  const demoOpps = [
    ['تدريب صيفي في الأمن السيبراني', 'internship', 'مركز الأمن الرقمي الوطني', 'تدريب عملي مكثف لمدة 8 أسابيع في الاختبارات الأمنية والدفاع السيبراني مع فرصة توظيف بعد التخرج.', 'بغداد', null, 'طالب في سنة متقدمة، يجيد أساسيات الشبكات والبرمجة.'],
    ['منحة دراسية كاملة — هندسة البرمجيات', 'scholarship', 'جامعة التكنولوجيا', 'منحة كاملة تغطي الرسوم الدراسية لمدة 4 سنوات لتخصص هندسة البرمجيات.', 'بغداد', null, 'معدل مرتفع + اجتياز اختبار القبول.'],
    ['مسابقة البرمجة الوطنية 2026', 'competition', 'وزارة التعليم العالي', 'مسابقة برمجة تنافسية على مستوى الدولة بجوائز مالية وفرص تدريب.', 'أونلاين', null, 'فريق من 3 طلاب، الإلمام بلغات البرمجة.'],
  ];
  for (const [title, type, organization, description, location, deadline, eligibility] of demoOpps) {
    db.prepare('INSERT INTO opportunities (title, type, organization, description, location, deadline, eligibility, spots) VALUES (?,?,?,?,?,?,?,?)')
      .run(title, type, organization, description, location, deadline, eligibility, 10);
  }
}
// بيانات تجريبية ذاتية للفعاليات: تُنشأ فقط إن لم توجد أي فعاليات بعد
if (db.prepare('SELECT COUNT(*) AS n FROM events').get().n === 0) {
  const demoEvents = [
    ['المؤتمر الوطني للأمن السيبراني 2026', 'conference', 'مؤتمر سنوي يجمع الخبراء والطلاب لمناقشة أحدث التهديدات وسبل الدفاع.', 'قاعة المؤتمرات الكبرى — بغداد', '2026-10-05 09:00:00', '2026-10-06 18:00:00', 300, 'د. سارة العلي'],
    ['ورشة عمل: أساسيات الاختراق الأخلاقي', 'workshop', 'ورشة عملية لتعلم أدوات الاختبارات الأمنية وكتابة تقارير الثغرات.', 'مختبر الشبكات — الجامعة', '2026-09-20 10:00:00', '2026-09-20 14:00:00', 50, 'م. علي حسين'],
    ['ندوة: مسارات مهنية في الذكاء الاصطناعي', 'seminar', 'جلسة حوارية حول الفرص المهنية والتحديات في مجال الذكاء الاصطناعي.', 'قاعة المحاضرات 2', '2026-09-15 11:00:00', '2026-09-15 12:30:00', 120, 'د. عمر خالد'],
  ];
  for (const [title, type, description, location, starts, ends, capacity, speaker] of demoEvents) {
    db.prepare('INSERT INTO events (title, type, description, location, starts_at, ends_at, capacity, speaker) VALUES (?,?,?,?,?,?,?,?)')
      .run(title, type, description, location, starts, ends, capacity, speaker);
  }
}
if (db.prepare('SELECT COUNT(*) AS n FROM resources').get().n === 0) {
  const demoResources = [
    ['قاعة المحاضرات الرئيسية', 'room', 'قاعة كبيرة مجهزة بمسرح وعرض ذكي تتسع لأكثر من 120 شخصاً.', 'المبنى الرئيسي — الطابق الأرضي', 120, 1],
    ['مختبر الشبكات والأمن', 'lab', 'أجهزة حاسوب وقوافل شبكات للتدريب العملي، 20 محطة عمل.', 'المبنى B — الطابق الثاني', 20, 1],
    ['مختبر الروبوتات', 'lab', 'معدات روبوتية ولوحات تطوير للورش العملية.', 'المبنى B — الطابق الثالث', 16, 0],
    ['معدات تصوير احترافية', 'equipment', 'كاميرا DSLR + ميكروفونات + إضاءة لتسجيلات الطلاب.', 'مكتب الوسائط — الطابق الأول', 4, 1],
    ['شاشة عرض متنقلة', 'device', 'شاشة 65 بوصة مع حامل وعرض ذكي.', 'مكتب الوسائط — الطابق الأول', 1, 0],
  ];
  for (const [name, type, description, location, capacity, approval] of demoResources) {
    db.prepare('INSERT INTO resources (name, type, description, location, capacity, requires_approval) VALUES (?,?,?,?,?,?)')
      .run(name, type, description, location, capacity, approval);
  }
}
if (db.prepare('SELECT COUNT(*) AS n FROM volunteer_programs').get().n === 0) {
  const demoVolunteers = [
    ['حملة توعية أمن المعلومات للمدارس', 'campaign', 'زيارة مدارس متوسطة لتقديم ورش مبسطة عن أمن المعلومات والاستخدام الآمن للإنترنت.', 'مدارس بغداد', '2026-10-01 08:00:00', '2026-10-20 13:00:00', 'تحدث عام، فريق عمل، تقنية', 40],
    ['مبادرة ترقيم وإدخال البيانات للمكتبة', 'initiative', 'مساعدة المكتبة الجامعية في ترقيم الفهارس وإدخالها إلكترونياً.', 'المكتبة المركزية', '2026-09-01 09:00:00', '2026-09-30 15:00:00', 'مهارات حاسوب، تنظيم', 15],
    ['إغاثة وحملة تنظيف بعد المؤتمر التقني', 'relief', 'فريق مساندة أثناء المؤتمر التقني الوطني: استقبال وتسجيل وتنظيم القاعات.', 'قاعة المؤتمرات', '2026-10-05 07:00:00', '2026-10-06 18:00:00', 'عمل جماعي، مسؤولية', 30],
  ];
  for (const [title, type, description, location, starts, ends, skills, spots] of demoVolunteers) {
    db.prepare('INSERT INTO volunteer_programs (title, type, description, location, starts_at, ends_at, required_skills, spots) VALUES (?,?,?,?,?,?,?,?)')
      .run(title, type, description, location, starts, ends, skills, spots);
  }
}
if (db.prepare('SELECT COUNT(*) AS n FROM academy_tracks').get().n === 0) {
  const anyCourse = db.prepare('SELECT id, title FROM courses WHERE active = 1 ORDER BY id LIMIT 2').all();
  if (anyCourse.length > 0) {
    const t = db.prepare('INSERT INTO academy_tracks (title, description, icon, color) VALUES (?,?,?,?)')
      .run('الأكاديمية الوطنية — أساسيات الأمن السيبراني', 'مسار متسلسل: كل مرحلة تشمل درساً → اختباراً → معملاً → تحدياً → امتحاناً → شهادة. أكمل المرحلة لتفتح التالية.', '🛡️', '#6c7bff');
    const trackId = t.lastInsertRowid;
    const stageTitles = ['مقدمة وأساسيات', 'تطبيق عملي'];
    anyCourse.forEach((c, i) => {
      db.prepare('INSERT INTO academy_stages (track_id, order_no, title, description, course_id) VALUES (?,?,?,?,?)')
        .run(trackId, i + 1, stageTitles[i] || `المرحلة ${i + 1}`, `أكمل دورة «${c.title}» بالكامل`, c.id);
    });
  }
}

export default db;
