import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api } from '../../api.js';

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [scenario, setScenario] = useState({ x2: false, x3: false, x5: false });

  useEffect(() => { api('/admin/analytics').then(setData).catch((e) => setError(e.message)); }, []);

  if (error) return <AdminLayout><div className="error-msg">{error}</div></AdminLayout>;
  if (!data) return <AdminLayout><p className="muted">جارٍ التحميل...</p></AdminLayout>;

  const k = data.kpis;
  const maxLogin = Math.max(...data.growth.loginsByDay.map((d) => d.n), 1);
  const maxHour = Math.max(...data.growth.byHour.map((h) => h.n), 1);
  const totalE = data.ecosystem;

  const factor = scenario.x5 ? 5 : scenario.x3 ? 3 : scenario.x2 ? 2 : 1;
  const proj = {
    students: k.students * factor,
    lessons: k.progressDone * factor,
    loginsDay: Math.round((k.active7d / 7) * factor),
    jtokens: k.active30d * factor,
    audit: k.auditAll * factor,
    dbRows: Math.round((k.students * 25 + k.auditAll * 3 + k.examsAttempts * 2) * factor / 1000),
  };

  const kpiCards = [
    { label: 'الطلاب', value: k.students, icon: '🎓', accent: 'var(--accent)' },
    { label: 'جدد (30 يوم)', value: k.newStudents30d, icon: '🌟', accent: 'var(--green)' },
    { label: 'نشطون (7 أيام)', value: k.active7d, icon: '⚡', accent: 'var(--accent-2)' },
    { label: 'نسبة الاحتفاظ 7ي', value: k.retention7d + '%', icon: '📈', accent: 'var(--green)' },
    { label: 'نسبة الاحتفاظ 30ي', value: k.retention30d + '%', icon: '📊', accent: 'var(--accent-2)' },
    { label: 'إتمام دروس', value: k.progressDone, icon: '✅', accent: 'var(--green)' },
    { label: 'إتمام دورات', value: k.enrollmentsDone, icon: '📚', accent: 'var(--accent)' },
    { label: 'شهادات', value: k.certifications, icon: '📜', accent: 'var(--gold)' },
    { label: 'محاولات امتحان', value: k.examsAttempts, icon: '📋', accent: 'var(--accent-2)' },
    { label: 'تحديات محلولة', value: k.challengesSolved, icon: '🏆', accent: 'var(--gold)' },
    { label: 'إجمالي XP', value: (k.totalXP / 1000).toFixed(1) + 'k', icon: '✨', accent: 'var(--accent)' },
    { label: 'سجل تدقيق', value: k.auditAll, icon: '🛡️', accent: 'var(--accent-2)' },
  ];

  const ecoCards = [
    ['🎪', 'الفعاليات', totalE.events, totalE.eventRegs, 'تسجيل'],
    ['💼', 'الفرص', totalE.opportunities, totalE.oppApps, 'تقديم'],
    ['🏢', 'المرافق', totalE.resources, totalE.bookings, 'حجز'],
    ['🤝', 'التطوع', totalE.volunteers, totalE.volunteerApps, 'طلب'],
    ['👥', 'المجموعات', totalE.groups, totalE.groupMembers, 'عضو'],
    ['🎥', 'قاعات البث', totalE.liveRooms, totalE.liveAttendance, 'حضور'],
    ['💬', 'الرسائل', totalE.messages, totalE.qaPosts, 'نقاشات'], 
  ];

  return (
    <AdminLayout>
      <div className="row space-between mb">
        <div>
          <h2>📊 التحليلات التنفيذية</h2>
          <p className="muted">مؤشرات الأداء الرئيسية ونمو المنصة واستخدام الوحدات</p>
        </div>
      </div>

      <div className="stats-grid">
        {kpiCards.map((c) => (
          <div key={c.label} className="stat-card">
            <div style={{ fontSize: 20 }}>{c.icon}</div>
            <div className="stat-value" style={{ color: c.accent }}>{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 className="mb">عمليات الدخول (آخر 14 يوماً)</h3>
          <div className="row" style={{ alignItems: 'flex-end', height: 130, gap: 4 }}>
            {data.growth.loginsByDay.map((d) => (
              <div key={d.full} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ background: 'var(--accent-2)', borderRadius: '4px 4px 0 0', width: '100%', height: (d.n / maxLogin) * 100 + '%', minHeight: 3 }} />
                <span className="muted" style={{ fontSize: 10, marginTop: 3 }}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="mb">ساعات الذروة (توزيع عمليات الدخول)</h3>
          <div className="muted mb" style={{ fontSize: 12 }}>فترة النشاط الأعلى على مدار اليوم</div>
          {data.growth.byHour.filter((h) => h.n > 0).length === 0 && <p className="muted">لا بيانات بعد</p>}
          {data.growth.byHour.map((h) => (
            <div key={h.hour} className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 2 }}>
              <span style={{ width: 34, fontSize: 11 }} className="muted">{String(h.hour).padStart(2, '0')}:00</span>
              <div style={{ flex: 1, background: '#0e1024', height: 9, borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(90deg,var(--accent),var(--accent-2))', height: '100%', width: (h.n / maxHour) * 100 + '%' }} />
              </div>
              <span className="muted" style={{ fontSize: 11, width: 22, textAlign: 'left' }}>{h.n}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 className="mb">الحرارة: توزيع الطلاب على الأقسام</h3>
          {data.heatmap.length === 0 && <p className="muted">لا طلاب بعد</p>}
          <table className="table">
            <thead><tr><th>القسم</th><th>الطلاب</th><th>جدد 30 يوم</th></tr></thead>
            <tbody>
              {data.heatmap.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>
                    <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 12 }}>{s.students}</span>
                      <div style={{ flex: 1, background: '#0e1024', height: 8, borderRadius: 5, overflow: 'hidden', maxWidth: 120 }}>
                        <div style={{ background: 'var(--accent)', height: '100%', width: Math.min(100, (s.students / (data.heatmap[0].students || 1)) * 100) + '%' }} />
                      </div>
                    </div>
                  </td>
                  <td>{s.new30 || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="mb">إتمام الدورات (الأعلى تسجيلاً)</h3>
          {data.content.topCourses.length === 0 && <p className="muted">لا دورات بعد</p>}
          {data.content.topCourses.map((c) => (
            <div key={c.title} className="mb">
              <div className="row space-between" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>{c.title}</span>
                <span className="muted">{c.done}/{c.enrolled} • {c.completion}%</span>
              </div>
              <div style={{ background: '#0e1024', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(90deg, var(--accent), var(--green))', height: '100%', width: c.completion + '%' }} />
              </div>
            </div>
          ))}
          <h3 className="mt mb" style={{ marginTop: 16 }}>الدورات حسب المستوى</h3>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {data.content.coursesByLevel.map((l) => (
              <span key={l.level} className="chip">{l.level}: {l.n}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="mb">🌍 النظام البيئي للوحدات</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {ecoCards.map(([icon, name, count, usage, usageLabel]) => (
            <div key={name} className="row space-between" style={{ padding: '8px 10px', background: 'rgba(159,108,255,.06)', borderRadius: 10 }}>
              <div>
                <span style={{ fontSize: 18 }}>{icon}</span> <strong>{name}</strong>
                <div className="muted" style={{ fontSize: 12 }}>{count} عنصر • {usage} {usageLabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="mb">🔮 محاكي السيناريو (ماذا لو تضاعف المستخدمون؟)</h3>
        <p className="muted mb">اختر عامل نمو لرؤية التقديرات التقريبية للحجم المطلوب:</p>
        <div className="row mb" style={{ gap: 6 }}>
          {[['x2', 'ضعف'], ['x3', 'ثلاثة أضعاف'], ['x5', 'خمسة أضعاف']].map(([key, label]) => (
            <button key={key} className={`btn btn-sm ${scenario[key] ? '' : 'btn-secondary'}`} onClick={() => setScenario({ x2: key === 'x2', x3: key === 'x3', x5: key === 'x5' })}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          {[
            ['الطلاب المتوقعون', proj.students],
            ['أحداث إتمام دروس', proj.lessons],
            ['عمليات دخول يومية', proj.loginsDay],
            ['عنوان جلسة نشطة', proj.jtokens],
            ['إدخالات سجل التدقيق', proj.audit],
            ['حجم البيانات تقريباً', (proj.dbRows * 1.1).toFixed(1) + ' MB'],
          ].map(([l, v]) => (
            <div key={l} className="row space-between" style={{ padding: '8px 10px', background: 'rgba(108,123,255,.06)', borderRadius: 10 }}>
              <span className="muted" style={{ fontSize: 13 }}>{l}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <p className="muted mt" style={{ fontSize: 12, lineHeight: 1.7 }}>
          💡 عند 5 أضعاف المستخدمين يُنصح بالانتقال إلى توكنات جلسات موزّعة (Redis) وتقسيم سجل التدقيق شهرياً، حيث
          يصل سجل التدقيق إلى <strong>{proj.audit.toLocaleString()}</strong> إدخال وتقارب الحسومات انتهاء صلاحيات التخزين.
        </p>
      </div>
    </AdminLayout>
  );
}