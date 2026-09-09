import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getUser } from '../api.js';

export default function StudentDashboard() {
  const [sections, setSections] = useState([]);
  const [selected, setSelected] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [error, setError] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const user = getUser();

  useEffect(() => {
    api('/sections').then((d) => setSections(d.sections)).catch((e) => setError(e.message));
    api('/me/announcements').then((d) => setAnnouncements(d.announcements)).catch(() => {});
  }, []);

  const openSection = async (sec) => {
    setSelected(sec);
    setLoadingCourses(true);
    try {
      const d = await api(`/sections/${sec.id}/courses`);
      setCourses(d.courses);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingCourses(false);
    }
  };

  return (
    <div className="page">
      <div className="space-between">
        <div>
          <h1 className="page-title">مرحباً، {user?.name} 👋</h1>
          <p className="page-sub">اختر قسمك وابدأ رحلتك التعليمية</p>
        </div>
        <div className="row">
          <Link to="/live" className="btn">🎥 البث المباشر</Link>
          <Link to="/challenges" className="btn btn-secondary">🏆 التحديات</Link>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {announcements.length > 0 && (
        <div className="card mb" style={{ borderColor: 'var(--accent)' }}>
          <h3 className="mb">📢 إعلانات المنصة</h3>
          {announcements.slice(0, 3).map((a) => (
            <div key={a.id} className="chat-msg">
              <strong>{a.title}:</strong> {a.content}
              <span className="muted"> — {a.created_at}</span>
            </div>
          ))}
        </div>
      )}

      {!selected && (
        <div className="grid">
          {sections.map((s) => (
            <button key={s.id} onClick={() => openSection(s)} className="card" style={{ textAlign: 'right', borderTop: `4px solid ${s.color || '#7c8cff'}`, background: '#161a33', border: `1px solid #2a2f55` }}>
              <span className="section-icon">{s.icon}</span>
              <h3>{s.name}</h3>
              <p className="muted mb">{s.description}</p>
              <span className="chip">{s.course_count} دورة</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="space-between">
            <h2>{selected.icon} {selected.name}</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>↩ رجوع للأقسام</button>
          </div>
          {loadingCourses && <p className="muted">جارٍ التحميل...</p>}
          <div className="grid">
            {courses.map((c) => (
              <Link key={c.id} to={`/course/${c.id}`} style={{ color: 'inherit' }}>
                <div className="card">
                  <h3>{c.title}</h3>
                  <p className="muted mb">{c.description}</p>
                  <div className="row">
                    <span className="chip">{c.level}</span>
                    <span className="chip">{c.lesson_count} درس</span>
                    {c.price > 0 ? <span className="chip chip-gold">{c.price}$</span> : <span className="chip chip-green">مجاني</span>}
                  </div>
                </div>
              </Link>
            ))}
            {!loadingCourses && courses.length === 0 && <p className="muted">لا توجد دورات بعد.</p>}
          </div>
        </>
      )}
    </div>
  );
}
