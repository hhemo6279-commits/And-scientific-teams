import { request } from 'node:http';

const BASE = 'http://localhost:4000';
const TOTAL = parseInt(process.argv[2] || '3000', 10);
const CONCURRENCY = parseInt(process.argv[3] || '200', 10);

const stats = { ok: 0, fail: 0, ms: [] };

function req(method, path, token, body) {
  return new Promise((resolve) => {
    const start = Date.now();
    const u = new URL(BASE + path);
    const r = request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          stats.ms.push(Date.now() - start);
          res.statusCode < 400 ? stats.ok++ : stats.fail++;
          resolve({ status: res.statusCode, body: data });
        });
      }
    );
    r.on('error', () => { stats.fail++; resolve({ status: 0, body: '' }); });
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function run() {
  // تسجيل دخول أحد الطلاب للحصول على رمز
  const login = await req('POST', '/api/auth/login', null, { email: 'student@mk.io', password: 'student123' });
  let token = null;
  try { token = JSON.parse(login.body).token; } catch {}
  if (!token) { console.log('فشل تسجيل الدخول'); process.exit(1); }

  // جلب قائمة القاعات
  const rooms = await req('GET', '/api/live', token);
  let roomId = null;
  try { const rs = JSON.parse(rooms.body).rooms; roomId = rs.length ? rs[0].id : null; } catch {}

  console.log(`بدأ اختبار تحميل ${TOTAL} مستخدم (تزامن ${CONCURRENCY})...`);
  const startTime = Date.now();

  let done = 0;
  const targets = [];

  for (let i = 0; i < TOTAL; i++) {
    const action = i % 10;
    if (action < 6) targets.push(() => req('GET', '/api/live', token));
    else if (action < 8) targets.push(() => req('GET', '/api/courses/1', token));
    else if (action < 9 && roomId) targets.push(() => req('POST', `/api/live/${roomId}/join`, token, {}));
    else if (roomId) targets.push(() => req('GET', '/api/live', token));
    else targets.push(() => req('GET', '/api/live', token));
  }

  // تشغيل بحلقات من السلة
  let idx = 0;
  async function worker() {
    while (idx < targets.length) {
      const t = targets[idx++];
      await t();
      done++;
      if (done % 500 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (done / elapsed).toFixed(0);
        console.log(`  ${done}/${TOTAL} - ${rate} req/s`);
      }
    }
  }

  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) workers.push(worker());
  await Promise.all(workers);

  const elapsedMs = Date.now() - startTime;
  const sorted = [...stats.ms].sort((a, b) => a - b);
  const avg = (stats.ms.reduce((a, b) => a + b, 0) / Math.max(stats.ms.length, 1)).toFixed(0);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

  console.log('\n===== نتيجة اختبار التحميل =====');
  console.log(`الطلبات الناجحة: ${stats.ok}`);
  console.log(`الطلبات الفاشلة: ${stats.fail}`);
  console.log(`المدة الإجمالية: ${(elapsedMs / 1000).toFixed(1)} ثانية`);
  console.log(`معدل الطلبات: ${(stats.ok / (elapsedMs / 1000)).toFixed(0)} req/s`);
  console.log(`متوسط زمن الاستجابة: ${avg} ms`);
  console.log(`P95: ${p95} ms`);
  console.log(`P99: ${p99} ms`);
  console.log('==============================');
}

run();
