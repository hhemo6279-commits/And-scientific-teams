import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { requireAuth } from './auth.js';
import { rateLimit } from './security.js';
import { isMaintenanceMode } from './settings.js';
import jwt from 'jsonwebtoken';

// تحميل متغيرات البيئة من server/.env إن وُجد
const __dirnameEnv = path.dirname(fileURLToPath(import.meta.url));
try {
  const envPath = path.join(__dirnameEnv, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {} // تجاهل أي خطأ في تحميل .env

import authRoutes from './routes/auth.js';
import sectionRoutes from './routes/sections.js';
import courseRoutes from './routes/courses.js';
import adminRoutes from './routes/admin.js';
import liveRoutes from './routes/live.js';
import challengeRoutes from './routes/challenges.js';
import meRoutes from './routes/me.js';
import publicRoutes from './routes/public.js';
import bundleRoutes from './routes/bundles.js';
import instructorRoutes from './routes/instructor.js';
import groupRoutes from './routes/groups.js';
import academyRoutes from './routes/academy.js';
import opportunityRoutes from './routes/opportunities.js';
import eventRoutes from './routes/events.js';
import resourceRoutes from './routes/resources.js';
import volunteerRoutes from './routes/volunteers.js';
import adminAnalyticsRoutes from './routes/adminAnalytics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// ======= ترويسات أمنية أساسية =======
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' blob:; connect-src 'self' https: http://localhost:* ws://localhost:*; font-src 'self' data:; media-src 'self' blob:"
  );
  next();
});

// ======= الحد من معدل الطلبات =======
// عام: حد مرتفع لكل IP حتى لا يكسر البث والتفاعلات
app.use('/api', rateLimit({ windowMs: 60000, max: 240 }));
// صارم: واجهات المصادقة (منع هجمات التخمين) — لكل IP
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40 });

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'MK Platform' }));

// ======= وضع الصيانة: حجب الواجهات عن الجميع عدا الأدمن الرئيسي =======
app.use('/api', (req, res, next) => {
  if (!isMaintenanceMode()) return next();
  const p = req.path;
  if (p === '/health' || p.startsWith('/public')) return next();
  if (p.startsWith('/auth/login') || p.startsWith('/auth/refresh') || p.startsWith('/auth/mfa/login')) return next();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'mk-platform-secret-change-me');
      const admin = db.prepare('SELECT role, active FROM users WHERE id = ?').get(payload.id);
      if (admin && admin.active && admin.role === 'main_admin') return next();
    } catch { /* تجاهل */ }
  }
  return res.status(503).json({ error: 'المنصة في وضع الصيانة حالياً، حاول لاحقاً' });
});

app.use('/api/public', publicRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/me', requireAuth, meRoutes);
app.use('/api/sections', requireAuth, sectionRoutes);
app.use('/api/courses', requireAuth, courseRoutes);
app.use('/api/admin', requireAuth, adminRoutes);
app.use('/api/live', requireAuth, liveRoutes);
app.use('/api/challenges', requireAuth, challengeRoutes);
app.use('/api/bundles', requireAuth, bundleRoutes);
app.use('/api/instructor', requireAuth, instructorRoutes);
app.use('/api/groups', requireAuth, groupRoutes);
app.use('/api/academy', requireAuth, academyRoutes);
app.use('/api/opportunities', requireAuth, opportunityRoutes);
app.use('/api/events', requireAuth, eventRoutes);
app.use('/api/resources', requireAuth, resourceRoutes);
app.use('/api/volunteers', requireAuth, volunteerRoutes);
app.use('/api/admin/analytics', requireAuth, adminAnalyticsRoutes);

// خدمة الواجهة المبنية (dist)
app.use('/api', (req, res) => res.status(404).json({ error: 'الواجهة غير موجودة' }));
const distPath = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'خطأ في الخادم' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
});
