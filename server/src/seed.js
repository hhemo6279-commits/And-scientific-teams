import db from './db.js';
import bcrypt from 'bcryptjs';

function hash(pw) {
  return bcrypt.hashSync(pw, 10);
}

db.prepare('DELETE FROM audit_log').run();
db.prepare('DELETE FROM reviews').run();
db.prepare('DELETE FROM user_badges').run();
db.prepare('DELETE FROM lab_progress').run();
db.prepare('DELETE FROM lab_steps').run();
db.prepare('DELETE FROM live_attendance').run();
db.prepare('DELETE FROM notifications').run();
db.prepare('DELETE FROM quiz_questions').run();
db.prepare('DELETE FROM quiz_attempts').run();
db.prepare('DELETE FROM qa_answers').run();
db.prepare('DELETE FROM notifications').run();
db.prepare('DELETE FROM messages').run();
db.prepare('DELETE FROM live_chat').run();
db.prepare('DELETE FROM live_reactions').run();
db.prepare('DELETE FROM live_hands').run();
db.prepare('DELETE FROM group_posts').run();
db.prepare('DELETE FROM group_members').run();
db.prepare('DELETE FROM study_groups').run();
db.prepare('DELETE FROM schedule_reminders').run();
db.prepare('DELETE FROM schedule_items').run();
db.prepare('DELETE FROM exam_attempts').run();
db.prepare('DELETE FROM exam_questions').run();
db.prepare('DELETE FROM exams').run();
db.prepare('DELETE FROM grades').run();
db.prepare('DELETE FROM instructor_courses').run();
db.prepare('DELETE FROM bundle_certificates').run();
db.prepare('DELETE FROM bundle_enrollments').run();
db.prepare('DELETE FROM bundle_courses').run();
db.prepare('DELETE FROM bundles').run();
db.prepare('DELETE FROM qa_answers').run();
db.prepare('DELETE FROM qa_posts').run();
db.prepare('DELETE FROM announcements').run();
db.prepare('DELETE FROM challenge_submissions').run();
db.prepare('DELETE FROM certificates').run();
db.prepare('DELETE FROM lesson_progress').run();
db.prepare('DELETE FROM lessons').run();
db.prepare('DELETE FROM enrollments').run();
db.prepare('DELETE FROM courses').run();
db.prepare('DELETE FROM sub_admin_sections').run();
db.prepare('DELETE FROM live_rooms').run();
db.prepare('DELETE FROM challenges').run();
db.prepare('DELETE FROM sections').run();
db.prepare('DELETE FROM badges').run();
db.prepare('DELETE FROM users').run();
db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('users','sections','courses','lessons','enrollments','challenges','live_rooms','quiz_questions','quiz_attempts','qa_posts','qa_answers','announcements','reviews','user_badges','lab_progress','lab_steps','live_attendance','notifications','badges','messages','live_chat','live_reactions','live_hands','bundles','bundle_courses','bundle_enrollments','bundle_certificates','grades','instructor_courses','exams','exam_questions','exam_attempts','schedule_items','schedule_reminders','study_groups','group_members','group_posts')").run();

const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role, avatar, section_id) VALUES (?,?,?,?,?,?)');
const insertSection = db.prepare('INSERT INTO sections (name, description, icon, color) VALUES (?,?,?,?)');
const insertCourse = db.prepare('INSERT INTO courses (section_id, title, description, level, price) VALUES (?,?,?,?,?)');
const insertLesson = db.prepare('INSERT INTO lessons (course_id, title, content, type, order_no) VALUES (?,?,?,?,?)');

// المستخدمون
const mainAdminId = insertUser.run('أحمد المدير', 'admin@mk.io', hash('admin123'), 'main_admin', '🛡️', null).lastInsertRowid;
const subSec = [];
const sections = [
  ['الأمن السيبراني', 'اختبار الاختراق، تحليل الثغرات، التحقيق الرقمي', '🔐', '#e74c3c'],
  ['البرمجة', 'تطوير ويب، تطبيقات، علوم بيانات', '💻', '#3498db'],
  ['الهندسة والتقنية', 'ذكاء اصطناعي، سحابية، شبكات', '🤖', '#9b59b6'],
  ['غير التقنية', 'إدارة، تسويق، مهارات شخصية', '📈', '#f39c12'],
  ['طبية', 'أساسيات رعاية صحية، مصطلحات طبية', '⚕️', '#1abc9c'],
  ['علمية', 'رياضيات، فيزياء، كيمياء', '🔬', '#2ecc71'],
  ['ثقافية', 'تاريخ، لغات، تنمية ذاتية', '📚', '#e67e22'],
];
const sectionIds = sections.map(([name, desc, icon, color]) => insertSection.run(name, desc, icon, color).lastInsertRowid);

// أدمن فرعي لكل قسم رئيسي
const subNames = [
  ['أحلام الشمري', 'cyber@mk.io'],
  ['سعد العتيبي', 'code@mk.io'],
  ['نورة القحطاني', 'eng@mk.io'],
];
for (let i = 0; i < subNames.length; i++) {
  const id = insertUser.run(subNames[i][0], subNames[i][1], hash('admin123'), 'sub_admin', '👤', null).lastInsertRowid;
  subSec.push(id);
}
// الأمن السيبراني والبرمجة فقط للادمن الفرعي الأول، البرمجة للثاني، الهندسة للثالث
db.prepare('INSERT INTO sub_admin_sections (user_id, section_id) VALUES (?,?)').run(subSec[0], sectionIds[0]);
db.prepare('INSERT INTO sub_admin_sections (user_id, section_id) VALUES (?,?)').run(subSec[0], sectionIds[1]);
db.prepare('INSERT INTO sub_admin_sections (user_id, section_id) VALUES (?,?)').run(subSec[1], sectionIds[1]);
db.prepare('INSERT INTO sub_admin_sections (user_id, section_id) VALUES (?,?)').run(subSec[2], sectionIds[2]);

const student1 = insertUser.run('حسين الطالب', 'student@mk.io', hash('student123'), 'student', '🎓', sectionIds[0]).lastInsertRowid;
insertUser.run('مريم طالبة', 'student2@mk.io', hash('student123'), 'student', '🎓', sectionIds[1]);
insertUser.run('علي خريج', 'ali@mk.io', hash('student123'), 'student', '👨‍🎓', sectionIds[6]);

// الدورات
const courses = [
  [sectionIds[0], 'اختبار الاختراق للمبتدئين', 'مقدمة عملية لأدوات اختبار الاختراق والثغرات الشائعة', 'مبتدئ', 0],
  [sectionIds[0], 'التحقيق الرقمي الجنائي', 'جمع الأدلة الرقمية وتحليلها', 'متوسط', 150],
  [sectionIds[1], 'أساسيات جافاسكريبت', 'من الصفر حتى بناء مشاريع تفاعلية', 'مبتدئ', 0],
  [sectionIds[1], 'قواعد البيانات SQL', 'تصميم واستعلام قواعد البيانات', 'مبتدئ', 0],
  [sectionIds[2], 'مقدمة في الذكاء الاصطناعي', 'مفاهيم التعلم الآلي والشبكات العصبية', 'متقدم', 200],
  [sectionIds[3], 'إدارة المشاريع الاحترافية', 'منهجيات Agile و Scrum', 'مبتدئ', 100],
  [sectionIds[4], 'أساسيات الإسعافات الأولية', 'مهارات إنقاذ الحياة الأساسية', 'مبتدئ', 0],
];
const courseIds = courses.map((c) => insertCourse.run(...c).lastInsertRowid);

// حقول الدورات المحسنة
const courseMeta = [
  [courseIds[0], 12, 'اختبار الاختراق\nفحص الثغرات\nكتابة التقارير', 'أساسيات الشبكات والأنظمة', 'أحمد المدير', 'العربية'],
  [courseIds[1], 20, 'جمع الأدلة\nتحليل البيانات', 'أساسيات الحاسوب', 'أحلام الشمري', 'العربية'],
  [courseIds[2], 8, 'كتابة الأكواد\nبناء مشاريع', 'أساسيات الحاسوب', 'سعد العتيبي', 'العربية'],
  [courseIds[3], 10, 'تصميم قواعد البيانات\nكتابة استعلامات', 'أساسيات البرمجة', 'سعد العتيبي', 'العربية'],
  [courseIds[4], 30, 'فهم التعلم الآلي\nبناء نماذج', 'برمجة بايثون', 'نورة القحطاني', 'العربية'],
  [courseIds[5], 6, 'إدارة الفرق\nاستخدام Agile', 'خبرة عمل', 'أحمد المدير', 'العربية'],
  [courseIds[6], 4, 'إنعاش القلب\nضبط النزيف', 'لا شيء', 'ملاك الممرضة', 'العربية'],
];
const stmtMeta = db.prepare('UPDATE courses SET duration_hours = ?, outcomes = ?, prerequisites = ?, instructor = ?, language = ? WHERE id = ?');
for (const m of courseMeta) stmtMeta.run(m[1], m[2], m[3], m[4], m[5], m[0]);

// الدروس
const lessonData = [
  [courseIds[0], 'ما هو اختبار الاختراق؟', 'مقدمة عن مفهوم اختبار الاختراق والفرق بينه وبين الفحص الأمني.', 'text', 1],
  [courseIds[0], 'جمع المعلومات (Recon)', 'كيفية جمع المعلومات عن الهدف باستخدام أدوات مثل Nmap.', 'text', 2],
  [courseIds[0], 'غرفة تطبيقية: كسر كلمة مرور', 'تطبيق عملي على كسر كلمات المرور الضعيفة.', 'lab', 3],
  [courseIds[1], 'مبادئ التحقيق الجنائي', 'الخطوات الأساسية في جمع الأدلة والحفاظ عليها.', 'text', 1],
  [courseIds[2], 'المتغيرات والأنواع', 'شرح المتغيرات وأنواع البيانات في جافاسكريبت.', 'text', 1],
  [courseIds[2], 'الدوال والكائنات', 'الدوال والكائنات في جافاسكريبت.', 'text', 2],
  [courseIds[2], 'اختبار: أساسيات جافاسكريبت', 'اختبار قصير بعد الدروس.', 'quiz', 3],
  [courseIds[4], 'التعلم الآلي 101', 'المفاهيم الأساسية للتعلم الآلي.', 'text', 1],
];

for (const l of lessonData) insertLesson.run(...l);

// أسئلة الاختبار (للدرس المسمى اختبار: أساسيات جافاسكريبت)
const quizLessonId = db.prepare("SELECT id FROM lessons WHERE title = 'اختبار: أساسيات جافاسكريبت'").get().id;
const insQ = db.prepare('INSERT INTO quiz_questions (lesson_id, question, options, correct_index, order_no) VALUES (?,?,?,?,?)');
insQ.run(quizLessonId, 'ما نوع القيمة المُعاد من الدالة typeof؟', JSON.stringify(['رقم', 'سلسلة نصية', 'قيمة منطقية', 'غير معرّف']), 1, 1);
insQ.run(quizLessonId, 'أي من هذه تُستخدم لتعريف ثابت؟', JSON.stringify(['let', 'var', 'const', 'static']), 2, 2);
insQ.run(quizLessonId, 'ما ناتج 2 + "2" في جافاسكريبت؟', JSON.stringify(['4', '"22"', 'خطأ', 'undefined']), 1, 3);
insQ.run(quizLessonId, 'كيف تُكتب دالة سهمية؟', JSON.stringify(['function(){}', '() => {}', 'def(){}', 'lambda(){}']), 1, 4);

// إعلان تجريبي
db.prepare('INSERT INTO announcements (user_id, title, content) VALUES (?,?,?)')
  .run(mainAdminId, 'مرحباً بكم في منصة MK', 'انطلقت منصة MK التعليمية الجديدة! سجّل في الدورات، شارك في التحديات، وحضر البث المباشر.');

// الشارات المتاحة
const insB = db.prepare('INSERT INTO badges (key, name, icon, description) VALUES (?,?,?,?)');
insB.run('first_course', 'أول دورة مكتملة', '🎓', 'أكملت دورتك الأولى بالكامل');
insB.run('challenge_rookie', 'مخترق مبتدئ', '🏅', 'حللت أول تحدي عملي');
insB.run('challenge_5', 'خبير التحديات', '⚡', 'حللت 5 تحديات');
insB.run('courses_3', 'بطل الدورات', '📚', 'أكملت 3 دورات');

// خطوات معمل تطبيقي (درس كسر كلمة المرور)
const labLessonId = db.prepare("SELECT id FROM lessons WHERE title = 'غرفة تطبيقية: كسر كلمة مرور'").get().id;
const insS = db.prepare('INSERT INTO lab_steps (lesson_id, title, instruction, answer, order_no) VALUES (?,?,?,?,?)');
insS.run(labLessonId, 'فحص المنفذ', 'افحص المنافذ المفتوحة على الهدف. ما رقم منفذ خدمة SSH؟', '22', 1);
insS.run(labLessonId, 'تحليل التجزئة', 'فك هذه التجزئة (MD5): 5f4dcc3b5aa765d61d8327deb882cf99. ما النص الأصلي؟', 'password', 2);
insS.run(labLessonId, 'الدخول', 'استخدم بيانات الدخول المكشوفة. ما اسم المستخدم الافتراضي؟', 'admin', 3);

// تقييم تجريبي على الدورة الأولى
db.prepare('INSERT INTO reviews (user_id, course_id, rating, comment) VALUES (?,?,?,?)').run(student1, courseIds[0], 5, 'دورة ممتازة وواضحة، أنصح بها');

// إشعار تجريبي للطالب الأول
db.prepare("INSERT INTO notifications (user_id, title, content) VALUES (?,?,?)").run(student1, '🎓 شهادة جديدة', 'حصلت على شهادة إتمام: اختبار الاختراق للمبتدئين');

// التحديات
const insCh = db.prepare('INSERT INTO challenges (section_id, title, description, points, flag, difficulty) VALUES (?,?,?,?,?,?)');
const ch = [
  [sectionIds[0], 'فك شفرة أساسية', 'فك شفرة Base64 التالية: bWsuY29t', 100, 'mk.com', 'سهل'],
  [sectionIds[0], 'ثغرة XSS', 'أوجد ثغرة حقن سكربت في صفحة تجريبية وأدخل alert(1)', 200, 'xss_done', 'متوسط'],
  [sectionIds[1], 'قلب سلسلة نصية', 'اكتب دالة تعكس ترتيب أحرف السلسلة', 150, 'reversed', 'سهل'],
];
for (const c of ch) insCh.run(...c);

// قاعة بث تجريبية
db.prepare("INSERT INTO live_rooms (course_id, title, host_id, status, scheduled_at) VALUES (?,?,?,?,datetime('now','+1 day'))").run(courseIds[0], 'جلسة مباشرة: أساسيات أمن الشبكات', mainAdminId, 'scheduled');
db.prepare("INSERT INTO live_rooms (course_id, title, host_id, status, scheduled_at) VALUES (?,?,?,?,datetime('now','+2 hour'))").run(courseIds[2], 'أسئلة وأجوبة: جافاسكريبت', subSec[1], 'scheduled');

// تسجيل الطالب في دورتين + شهادة
db.prepare('INSERT INTO enrollments (user_id, course_id, progress, completed) VALUES (?,?,?,?)').run(student1, courseIds[2], 66, 0);
db.prepare('INSERT INTO enrollments (user_id, course_id, progress, completed) VALUES (?,?,?,?)').run(student1, courseIds[0], 100, 1);
db.prepare('INSERT INTO certificates (user_id, course_id, code) VALUES (?,?,?)').run(student1, courseIds[0], 'CERT-MK-0001');

// إنجاز دروس الدورة الأولى (حتى يظل التقدم 100% متسقاً)
const firstCourseLessons = db.prepare('SELECT id FROM lessons WHERE course_id = ?').all(courseIds[0]);
const insLP = db.prepare('INSERT INTO lesson_progress (user_id, lesson_id, completed) VALUES (?,?,1)');
for (const l of firstCourseLessons) insLP.run(student1, l.id);
// شارة أول دورة للطالب (كما لو أكملها فعلاً)
db.prepare('INSERT INTO user_badges (user_id, badge_id) VALUES (?,?)').run(student1, 1);

// نقاط الطلاب للترتيب
db.prepare('INSERT INTO challenge_submissions (user_id, challenge_id, solved) VALUES (?,?,1)').run(student1, 1);
db.prepare('UPDATE users SET points = points + 100 WHERE id = ?').run(student1);
const mariamId = db.prepare("SELECT id FROM users WHERE email = 'student2@mk.io'").get().id;
db.prepare('INSERT INTO challenge_submissions (user_id, challenge_id, solved) VALUES (?,?,1)').run(mariamId, 2);
db.prepare('UPDATE users SET points = points + 200 WHERE id = ?').run(mariamId);
const aliId = db.prepare("SELECT id FROM users WHERE email = 'ali@mk.io'").get().id;
db.prepare('INSERT INTO challenge_submissions (user_id, challenge_id, solved) VALUES (?,?,1)').run(aliId, 3);
db.prepare('UPDATE users SET points = points + 150 WHERE id = ?').run(aliId);

db.prepare('INSERT INTO audit_log (user_id, action, details) VALUES (?,?,?)').run(mainAdminId, 'بذرة النظام', 'إنشاء البيانات التجريبية');

// ======= حقائب تدريبية =======
const b1 = db.prepare('INSERT INTO bundles (title, description, icon) VALUES (?,?,?)')
  .run('مسار الأمن السيبراني الشامل', 'من الصفر حتى الاحتراف: اختبار الاختراق والتحقيق الجنائي الرقمي', '🛡️').lastInsertRowid;
db.prepare('INSERT INTO bundle_courses (bundle_id, course_id, order_no) VALUES (?,?,?)').run(b1, courseIds[0], 1);
db.prepare('INSERT INTO bundle_courses (bundle_id, course_id, order_no) VALUES (?,?,?)').run(b1, courseIds[1], 2);
const b2 = db.prepare('INSERT INTO bundles (title, description, icon) VALUES (?,?,?)')
  .run('مسار تطوير الويب', 'أساسيات البرمجة وقواعد البيانات حتى بناء مشاريع متكاملة', '💻').lastInsertRowid;
db.prepare('INSERT INTO bundle_courses (bundle_id, course_id, order_no) VALUES (?,?,?)').run(b2, courseIds[2], 1);
db.prepare('INSERT INTO bundle_courses (bundle_id, course_id, order_no) VALUES (?,?,?)').run(b2, courseIds[3], 2);
// الطالب مسجل في الحقيبة الأولى (لديه دورة واحدة مكتملة من 2)
db.prepare('INSERT INTO bundle_enrollments (bundle_id, user_id, progress, completed) VALUES (?,?,?,?)').run(b1, student1, 50, 0);

// ======= محاضرون =======
db.prepare('INSERT INTO instructor_courses (user_id, course_id) VALUES (?,?)').run(mainAdminId, courseIds[0]);
db.prepare('INSERT INTO instructor_courses (user_id, course_id) VALUES (?,?)').run(mainAdminId, courseIds[1]);
db.prepare('INSERT INTO instructor_courses (user_id, course_id) VALUES (?,?)').run(subSec[1], courseIds[2]);
db.prepare('INSERT INTO instructor_courses (user_id, course_id) VALUES (?,?)').run(subSec[1], courseIds[3]);

// ======= درجة يدوية مثال =======
const khalidId = insertUser.run('خالد متدرب', 'khalid@mk.io', hash('student123'), 'student', '👨‍🎓', sectionIds[0]).lastInsertRowid;
db.prepare('INSERT INTO enrollments (user_id, course_id, progress, completed) VALUES (?,?,?,?)').run(khalidId, courseIds[0], 100, 1);
db.prepare('INSERT INTO grades (course_id, user_id, score, max_score, note, graded_by) VALUES (?,?,?,?,?,?)')
  .run(courseIds[0], khalidId, 92, 100, 'اجتاز التقييم العملي بنجاح', mainAdminId);

// ======= امتحان نهائي لدورة اختبار الاختراق =======
const ex1 = db.prepare('INSERT INTO exams (course_id, passing_score, duration_minutes) VALUES (?,?,?)').run(courseIds[0], 60, 30).lastInsertRowid;
const insEQ = db.prepare('INSERT INTO exam_questions (exam_id, question, options, correct_index, order_no) VALUES (?,?,?,?,?)');
insEQ.run(ex1, 'ما المرحلة الأولى في منهجية اختبار الاختراق؟', JSON.stringify(['جمع المعلومات', 'الاستغلال', 'رفع الصلاحيات', 'التقرير']), 0, 1);
insEQ.run(ex1, 'ما الأداة المستخدمة لفحص المنافذ؟', JSON.stringify(['Nmap', 'Burp Suite', 'Wireshark', 'Ghidra']), 0, 2);
insEQ.run(ex1, 'ما الثغرة التي تنفذ نصوصاً في متصفح الضحية؟', JSON.stringify(['SQLi', 'XSS', 'CSRF', 'DDoS']), 1, 3);
insEQ.run(ex1, 'ما المعيار الذي يضمن عدم نكران الإرسال؟', JSON.stringify(['التوقيع الرقمي', 'التجزئة', 'التشفير المتماثل', 'الضغط']), 0, 4);
insEQ.run(ex1, 'بعد اكتشاف ثغرة، ما الخطوة الصحيحة؟', JSON.stringify(['التوثيق والإبلاغ', 'التغطية', 'التجاهل', 'البيع']), 0, 5);

// ======= جدول زمني =======
db.prepare("INSERT INTO schedule_items (title, description, type, starts_at, ends_at, section_id, created_by) VALUES (?,?,?,datetime('now','+1 day','+18 hour'),datetime('now','+1 day','+20 hour'),?,?)")
  .run('محاضرة: أساسيات أمن الشبكات', 'محاضرة مباشرة للمسجلين في دورة اختبار الاختراق', 'محاضرة', sectionIds[0], mainAdminId);
db.prepare("INSERT INTO schedule_items (title, description, type, starts_at, ends_at, section_id, created_by) VALUES (?,?,?,datetime('now','+3 day'),datetime('now','+3 day','+4 hour'),?,?)")
  .run('ورشة: حل تحديات CTF', 'ورشة عملية لحل التحديات', 'ورشة', sectionIds[0], mainAdminId);

// ======= مجموعة دراسية =======
const grp = db.prepare('INSERT INTO study_groups (name, description, section_id, owner_id) VALUES (?,?,?,?)')
  .run('مجموعة أمن سيبراني', 'نتبادل الموارد ونحل التحديات معاً', sectionIds[0], student1).lastInsertRowid;
db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?,?,?)').run(grp, student1, 'owner');
db.prepare('INSERT INTO group_members (group_id, user_id, role) VALUES (?,?,?)').run(grp, khalidId, 'member');
db.prepare('INSERT INTO group_posts (group_id, user_id, content) VALUES (?,?,?)').run(grp, student1, 'مرحباً بالجميع! من يريد التدرب على Nmap اليوم؟');

console.log('✅ تم إنشاء البيانات التجريبية');
console.log('  الأدمن الرئيسي: admin@mk.io / admin123');
console.log('  الأدمن الفرعي: cyber@mk.io / admin123');
console.log('  الطالب:        student@mk.io / student123');
