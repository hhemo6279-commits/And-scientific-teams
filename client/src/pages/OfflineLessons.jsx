import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { loadOfflineLessons, removeLessonOffline } from '../offline.js';

export default function OfflineLessons() {
  const [saved, setSaved] = useState(() => loadOfflineLessons());
  const list = Object.values(saved).sort((a, b) => b.saved_at.localeCompare(a.saved_at));

  return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto' }}>
      <h1 className="page-title">📴 الدروس دون اتصال</h1>
      <p className="page-sub">الدروس المحفوظة متاحة للقراءة حتى بدون إنترنت</p>

      {list.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 50 }}>📥</div>
          <h3>لا توجد دروس محفوظة</h3>
          <p className="muted mb">افتح أي درس واختر "حفظ للقراءة دون اتصال" لتجده هنا.</p>
          <Link to="/" className="btn">تصفح الدورات</Link>
        </div>
      )}

      {list.map((l) => (
        <div key={`${l.course_id}:${l.lesson_id}`} className="card mb">
          <div className="row space-between" style={{ marginBottom: 8 }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>{l.lesson_title}</h3>
              <span className="chip">{l.course_title}</span>{' '}
              <span className="muted">حُفظ: {new Date(l.saved_at).toLocaleString('ar')}</span>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => { removeLessonOffline(l.course_id, l.lesson_id); setSaved(loadOfflineLessons()); }}>حذف</button>
          </div>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 2 }}>{l.content}</p>
          <Link to={`/course/${l.course_id}`} className="btn btn-secondary btn-sm mt">فتح الدورة</Link>
        </div>
      ))}
    </div>
  );
}
