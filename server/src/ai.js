// محرك "المساعد الذكي" — يولّد أسئلة اختبار وأفكار تحديات ومخططات دورات
// من الكلمات المفتاحية في العنوان، بقاعدة معرفة محلية (يعمل بدون مفتاح API).

const BANK = {
  'اختبار الاختراق': {
    title: 'اختبار الاختراق',
    questions: [
      { question: 'ما هي المرحلة الأولى في منهجية اختبار الاختراق؟', options: ['جمع المعلومات', 'الاستغلال', 'رفع الصلاحيات', 'التقرير النهائي'], correct: 0 },
      { question: 'ما الأمر الذي يُستخدم لفحص المنافذ المفتوحة؟', options: ['nmap', 'ping', 'whoami', 'traceroute'], correct: 0 },
      { question: 'ما هي تقنية استغلال تجاوز سعة المخزن المؤقت؟', options: ['Buffer Overflow', 'Phishing', 'SQL Injection', 'XSS'], correct: 0 },
      { question: 'ما أداة التقاط الحزم على الشبكة؟', options: ['Wireshark', 'Burp Suite', 'Metasploit', 'Nessus'], correct: 0 },
      { question: 'بعد اكتشاف الثغرة، ما الخطوة التالية مباشرة؟', options: ['الاستغلال', 'التغطية', 'رفع التقارير', 'التدريب'], correct: 0 },
      { question: 'ما فحص يساعد على اكتشاف الأجهزة الحية في الشبكة؟', options: ['Ping Sweep', 'Port Scan', 'DNS Enum', 'Web Crawl'], correct: 0 }
    ],
    challenge: { title: 'اكتشف المنفذ المخفي', description: 'قام الخصم بفتح منفذ على الخادم لتوصيل برنامج خبيث. افحص الشبكة باستخدام nmap واعثر على المنفذ المفتوح غير المعتاد، ثم اقرأ العلامة المثبتة عليه.', difficulty: 'متوسط', points: 150, flag: 'MK{N0_H1DD3N_P0RT}' },
  },
  'تشفير': {
    title: 'التشفير',
    questions: [
      { question: 'أي الخوارزميات تعتبر تشفيراً غير متماثل؟', options: ['RSA', 'AES', 'DES', 'RC4'], correct: 0 },
      { question: 'كم طول مفتاح AES الأكثر استخداماً؟', options: ['256 بت', '128 بايت', '64 بت', '512 بت'], correct: 0 },
      { question: 'ما دالة التجزئة المستخدمة في تخزين كلمات المرور؟', options: ['bcrypt', 'Base64', 'XOR', 'CRC32'], correct: 0 },
      { question: 'ما الغاية من الملح Salt في التجزئة؟', options: ['منع جداول قوس قزح', 'تسريع التشفير', 'ضغط البيانات', 'تبادل المفاتيح'], correct: 0 },
      { question: 'ما المفهوم الذي يضمن عدم نكران الإرسال؟', options: ['التوقيع الرقمي', 'التشفير المتماثل', 'الضغط', 'الترميز'], correct: 0 }
    ],
    challenge: { title: 'فك رسالة سرية', description: 'اعترضنا رسالة مشفرة بتشفير قيصر. المفتاح هو عدد الحروف الإنجليزية (26). فك الرسالة واحصل على العلم.', difficulty: 'سهل', points: 100, flag: 'MK{C43S4R_BR34K}' },
  },
  'شبكة': {
    title: 'الشبكات',
    questions: [
      { question: 'أي بروتوكول يعمل في الطبقة الرابعة للنقل؟', options: ['TCP', 'IP', 'ARP', 'HTTP'], correct: 0 },
      { question: 'ما المنفذ الافتراضي لبروتوكول HTTPS؟', options: ['443', '80', '8080', '21'], correct: 0 },
      { question: 'ما عنوان البث العام لشبكة /24؟', options: ['عنوان IP ينتهي بـ 255', '0.0.0.0', '127.0.0.1', '255.255.255.255 فقط'], correct: 0 },
      { question: 'ما البروتوكول المسؤول عن ترجمة الأسماء إلى عناوين؟', options: ['DNS', 'DHCP', 'FTP', 'SMTP'], correct: 0 },
      { question: 'ما الفرق بين TCP و UDP؟', options: ['TCP مضمون UDP غير مضمون', 'كلاهما مضمون', 'UDP أبطأ', 'لا فرق'], correct: 0 }
    ],
    challenge: { title: 'تحليل حزمة مشبوهة', description: 'لدينا ملف pcap يحتوي على حزمة مشبوهة. استخدم Wireshark لتصفية الطلبات واعثر على سلسلة العلم المخفية داخل الحمولة.', difficulty: 'متوسط', points: 120, flag: 'MK{PCAP_SN1FF}' },
  },
  'جافاسكريبت': {
    title: 'البرمجة (جافاسكريبت)',
    questions: [
      { question: 'ما الناتج من typeof []؟', options: ['object', 'array', 'undefined', 'string'], correct: 0 },
      { question: 'أي كلمة مفتاحية تعرّف ثابتاً في ES6؟', options: ['const', 'var', 'let', 'static'], correct: 0 },
      { question: 'ما دالة تحويل النص إلى رقم صحيح؟', options: ['parseInt', 'toNumber', 'castInt', 'Numberize'], correct: 0 },
      { question: 'ما نتيجة 1 + "2" في جافاسكريبت؟', options: ['"12"', '3', 'NaN', 'خطأ'], correct: 0 },
      { question: 'أي من الآتي طريقة لإضافة عنصر لنهاية مصفوفة؟', options: ['push', 'append', 'add', 'insert'], correct: 0 }
    ],
    challenge: { title: 'صحّح الكود المكسور', description: 'نشر المطور كوداً فيه خطأ منطقي يسبب حلقة لا نهائية. اقرأ الكود، اكتشف الخطأ، وأرسل العلامة.', difficulty: 'سهل', points: 80, flag: 'MK{FIX_THE_LOOP}' },
  },
  'قاعدة بيانات': {
    title: 'قواعد البيانات',
    questions: [
      { question: 'أي لغة تُستخدم للتعامل مع قواعد البيانات العلائقية؟', options: ['SQL', 'HTML', 'XML', 'JSON'], correct: 0 },
      { question: 'ما الأمر لاسترجاع البيانات من جدول؟', options: ['SELECT', 'GET', 'FETCH', 'READ'], correct: 0 },
      { question: 'ما القيد الذي يضمن تفرد القيم في عمود؟', options: ['UNIQUE', 'PRIMARY', 'NOT NULL', 'INDEX'], correct: 0 },
      { question: 'ما نوع هجوم SQL الذي يدخل كوداً عبر الإدخال؟', options: ['SQL Injection', 'XSS', 'CSRF', 'DoS'], correct: 0 },
      { question: 'ما الأمر لحذف جدول نهائياً؟', options: ['DROP TABLE', 'DELETE TABLE', 'REMOVE TABLE', 'CLEAR TABLE'], correct: 0 }
    ],
    challenge: { title: 'تجاوز التحقق عبر SQL Injection', description: 'صفحة تسجيل دخول ضعيفة تحوي ثغرة SQL Injection. أدخل حمولة تتجاوز التحقق من كلمة المرور واقرأ العلم.', difficulty: 'متوسط', points: 130, flag: 'MK{SQL_INJ3CT}' },
  },
  'ويب': {
    title: 'أمن الويب',
    questions: [
      { question: 'ما الثغرة التي تنفّذ نصوصاً برمجية في متصفح الضحية؟', options: ['XSS', 'SQLi', 'RCE', 'XXE'], correct: 0 },
      { question: 'ما آلية حماية من طلبات CSRF؟', options: ['Token عشوائي', 'HTTPS فقط', 'CORS', 'إخفاء الأزرار'], correct: 0 },
      { question: 'ما رأس الأمان الذي يمنع تصفح الأطر؟', options: ['X-Frame-Options', 'X-Powered-By', 'Server', 'Content-Length'], correct: 0 },
      { question: 'ما ترميز البيانات المرسلة بين الصفحة والخادم؟', options: ['JSON', 'Base64', 'UTF-16', 'BMP'], correct: 0 },
      { question: 'ما أداة اختبار طلبات الويب؟', options: ['Burp Suite', 'Wireshark', 'Ghidra', 'Kali'], correct: 0 }
    ],
    challenge: { title: 'تخمين رمز الجلسة', description: 'موقع تجريبي يرسل رمز جلسة قصيراً يمكن تخمينه. تتبّع الطلبات واعثر على رمز الجلسة المسؤول ثم اقرأ لوحة المسؤول للحصول على العلم.', difficulty: 'صعب', points: 200, flag: 'MK{S3SSI0N_GU3SS}' },
  },
  'نظام تشغيل': {
    title: 'أنظمة التشغيل',
    questions: [
      { question: 'ما الأمر في لينكس لعرض الملفات؟', options: ['ls', 'dir', 'show', 'listfiles'], correct: 0 },
      { question: 'ما الأمر لرفع الصلاحيات في لينكس؟', options: ['sudo', 'root', 'admin', 'chmod'], correct: 0 },
      { question: 'ما الملف الذي يحتوي حسابات المستخدمين؟', options: ['/etc/passwd', '/etc/hosts', '/var/log', '/home/config'], correct: 0 },
      { question: 'ما الأذونات الرقمية 755؟', options: ['r-xr-xr-x', 'rwxrwxrwx', 'rw-r--r--', 'rwxr-x---'], correct: 0 },
      { question: 'ما الأمر لعرض العمليات الجارية؟', options: ['ps', 'ls -p', 'show-proc', 'jobs -a'], correct: 0 }
    ],
    challenge: { title: 'رفع صلاحيات محلي', description: 'لديك وصول محدود لخادم لينكس. اكتشف البرنامج الذي يعمل بصلاحيات root وبه ثغرة لرفع الصلاحيات ثم اقرأ الملف السري.', difficulty: 'صعب', points: 180, flag: 'MK{PR1V3SC_AH0Y}' },
  }
};

// أداة توليد أسئلة عامة لأي موضوع (قالب عام عند عدم التطابق)
const GENERIC_QUESTIONS = [
  { t: (topic) => `ما المقصود بمصطلح "${topic}" في مجاله؟`, o: ['المفهوم الأساسي له', 'اسم جهاز', 'بروتوكول شبكة', 'لغة برمجة'], c: 0 },
  { t: (topic) => `أي مما يلي يرتبط ارتباطاً وثيقاً بـ "${topic}"؟`, o: ['المفاهيم والتقنيات المرتبطة به', 'أنواع الأطعمة', 'مكونات السيارة', 'أنواع الرياضة'], c: 0 },
  { t: (topic) => `ما أفضل طريقة لبدء تعلم "${topic}"؟`, o: ['من الأساسيات ثم التطبيق العملي', 'بحفظ كل شيء غيباً', 'تجنب التطبيق', 'البدء بالأصعب مباشرة'], c: 0 },
  { t: (topic) => `ما الأداة/الأدوات الشائعة في "${topic}"؟`, o: ['الأدوات المتخصصة في المجال', 'أدوات المطبخ', 'أدوات الحدائق', 'لا توجد أدوات'], c: 0 },
  { t: (topic) => `ما أفضل ممارسة عند العمل في "${topic}"؟`, o: ['الممارسة الآمنة والموثقة', 'تجاهل الأخطاء', 'عدم التوثيق', 'التخمين العشوائي'], c: 0 }
];

function pickQuestions(topic, count = 5) {
  const key = findKey(topic);
  if (key) return BANK[key].questions.slice(0, count);
  const qs = GENERIC_QUESTIONS.slice(0, count).map((g) => ({
    question: g.t(topic), options: g.o, correct: g.c
  }));
  return qs;
}

function findKey(topic) {
  const t = topic.trim();
  for (const key of Object.keys(BANK)) {
    if (t.includes(key) || key.includes(t) || t.split(/\s+/).some((w) => w.length > 3 && key.includes(w))) return key;
  }
  return null;
}

// توليد اختبار كامل لدرس
export function generateQuiz(topic, count = 5) {
  return pickQuestions(topic, count).map((q, i) => ({
    question: q.question,
    options: q.options,
    correct_index: q.correct
  }));
}

// توليد اقتراح تحدي
export function generateChallenge(topic) {
  const key = findKey(topic);
  const c = key ? BANK[key].challenge : {
    title: `تحدي ${topic}`,
    description: `تحدٍّ عملي حول ${topic}: طبّق ما تعلمته واعثر على العلم المخفي داخل الهدف.`,
    difficulty: 'متوسط',
    points: 100,
    flag: `MK{GEN_${topic.replace(/\s+/g, '_').toUpperCase().slice(0, 20)}}`
  };
  return { ...c };
}

// توليد مخطط دورة كامل من العنوان
export function generateCoursePlan(title, sectionName = '') {
  const key = findKey(title);
  const topic = key || title;
  const lessons = [
    `مقدمة إلى ${topic}`,
    `أساسيات ${topic}`,
    `المفاهيم المتقدمة في ${topic}`,
    ...(key ? BANK[key].questions.map((q) => q.question.replace(/\?.*$/, '').trim()).slice(0, 4) : ['تطبيقات عملية', 'دراسة حالات', 'مشروع نهائي'])
  ].slice(0, 7);
  return {
    title,
    description: `دورة تدريبية شاملة في ${topic}${sectionName ? ` ضمن قسم ${sectionName}` : ''}، من الأساسيات وحتى المستوى المتقدم مع تطبيقات عملية.`,
    outcomes: [`فهم المفاهيم الأساسية في ${topic}`,'تطبيق المهارات عملياً على مشاريع حقيقية','إعداد مشروع ختامي متكامل','الاستعداد لسوق العمل بشهادات معتمدة'],
    prerequisites: 'معرفة أساسية بالحاسوب والإنترنت',
    lessons,
    suggestedQuizCount: Math.min(5, (BANK[key] || { questions: GENERIC_QUESTIONS }).questions.length || 5)
  };
}

export default { generateQuiz, generateChallenge, generateCoursePlan };
