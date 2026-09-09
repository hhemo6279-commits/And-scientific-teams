import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api } from '../../api.js';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [annForm, setAnnForm] = useState({ title: '', content: '' });

  const load = () => {
    api('/admin/dashboard').then((d) => setStats(d)).catch((e) => setError(e.message));
    api('/admin/announcements').then((d) => setAnnouncements(d.announcements)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const postAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/announcements', { method: 'POST', body: JSON.stringify(annForm) });
      setAnnForm({ title: '', content: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const deleteAnnouncement = async (a) => {
    try {
      await api(`/admin/announcements/${a.id}`, { method: 'DELETE' });
      load();
    } catch (err) { setError(err.message); }
  };

  if (!stats) return <AdminLayout><p className="muted">جارٍ التحميل...</p></AdminLayout>;

  const cards = [
    { label: 'الطلاب', value: stats.stats.students, icon: '🎓' },
    { label: 'الدورات', value: stats.stats.courses, icon: '📚' },
    { label: 'الأقسام', value: stats.stats.sections, icon: '🗂️' },
    { label: 'التحديات', value: stats.stats.challenges, icon: '🏆' },
    { label: 'قاعات البث', value: stats.stats.liveRooms, icon: '🎥' },
    { label: 'الأدمن الفرعي', value: stats.stats.subAdmins, icon: '👥' },
  ];

  // حساب النسب المئوية في المخططات
  const distTotal = stats.sectionDist.reduce((s, d) => s + d.n, 0) || 1;
  const maxSignup = Math.max(...stats.monthlySignups.map((m) => m.n), 1);
  const maxPoints = Math.max(...stats.topStudents.map((t) => t.points), 1);

  return (
    <AdminLayout>
      <h1 className="page-title">نظرة عامة</h1>
      <p className="page-sub">
        {stats.role === 'main_admin' ? 'أنت الأدمن الرئيسي — ترى المنصة كلها' : 'أنت أدمن فرعي — ترى أقسامك المخصصة فقط'}
      </p>
      {error && <div className="error-msg">{error}</div>}

      <div className="stats-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <div style={{ fontSize: 22 }}>{c.icon}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 className="mb">توزيع الطلاب على الأقسام</h3>
          {stats.sectionDist.length === 0 && <p className="muted">لا توجد بيانات بعد</p>}
          {stats.sectionDist.map((d) => (
            <div key={d.name} className="mb">
              <div className="row space-between" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 13 }}>{d.name}</span>
                <span className="muted">{d.n} طالب</span>
              </div>
              <div style={{ background: '#0e1024', borderRadius: 8, height: 12, overflow: 'hidden' }}>
                <div style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', height: '100%', width: (d.n / distTotal) * 100 + '%' }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="mb">تسجيلات الطلاب (آخر 6 أشهر)</h3>
          <div className="row" style={{ alignItems: 'flex-end', height: 140, gap: 8 }}>
            {stats.monthlySignups.map((m) => (
              <div key={m.year + m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <div style={{ background: 'var(--accent-2)', borderRadius: '6px 6px 0 0', width: '100%', height: (m.n / maxSignup) * 100 + '%', minHeight: 4 }} />
                <span className="muted" style={{ fontSize: 11, marginTop: 4 }}>{m.month}/{m.year.slice(2)}</span>
              </div>
            ))}
          </div>
          {stats.monthlySignups.length === 0 && <p className="muted">لا توجد تسجيلات حديثة</p>}
        </div>
      </div>

      <div className="card">
        <h3 className="mb">🏆 أفضل 5 طلاب بالنقاط</h3>
        {stats.topStudents.map((t, i) => (
          <div key={i} className="row space-between" style={{ marginBottom: 10 }}>
            <div className="row">
              <span className="chip" style={{ minWidth: 36, textAlign: 'center' }}>#{i + 1}</span>
              <span className="avatar" style={{ margin: '0 8px' }}>{t.avatar || '👤'}</span>
              <span>{t.name}</span>
              <span className="chip" style={{ marginRight: 8 }}>{t.level.icon} {t.level.title}</span>
            </div>
            <span className="chip chip-gold">{t.points} XP</span>
          </div>
        ))}
        {stats.topStudents.length === 0 && <p className="muted">لا يوجد طلاب بعد</p>}
      </div>

      <h3 className="mb">أحدث الدورات</h3>
      <table className="table mb">
        <thead><tr><th>الدورة</th><th>القسم</th><th>المستوى</th></tr></thead>
        <tbody>
          {stats.latestCourses.map((c) => (
            <tr key={c.id}><td>{c.title}</td><td>{c.section_name}</td><td>{c.level}</td></tr>
          ))}
        </tbody>
      </table>

      <h3 className="mb">آخر النشاطات</h3>
      <table className="table">
        <thead><tr><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th><th>الوقت</th></tr></thead>
        <tbody>
          {stats.recentAudit.map((a) => (
            <tr key={a.id}><td>{a.user_name || '—'}</td><td>{a.action}</td><td className="muted">{a.details}</td><td className="muted">{a.created_at}</td></tr>
          ))}
        </tbody>
      </table>

      <h3 className="mb mt">📢 الإعلانات</h3>
      <form onSubmit={postAnnouncement} className="card mb">
        <div className="row mb">
          <input className="input" placeholder="عنوان الإعلان" value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} required style={{ flex: 1 }} />
        </div>
        <textarea className="textarea mb" placeholder="نص الإعلان..." value={annForm.content} onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })} />
        <button className="btn btn-success">نشر الإعلان</button>
      </form>
      {announcements.map((a) => (
        <div key={a.id} className="card mb">
          <div className="row space-between">
            <strong>{a.title}</strong>
            <div className="row">
              <span className="muted">{a.created_at}</span>
              <button className="btn btn-danger btn-sm" onClick={() => deleteAnnouncement(a)}>حذف</button>
            </div>
          </div>
          <p className="muted mt">{a.content}</p>
        </div>
      ))}
    </AdminLayout>
  );
}
