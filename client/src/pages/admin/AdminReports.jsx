import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api, getToken } from '../../api.js';

export default function AdminReports() {
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/live').then((d) => setRooms(d.rooms)).catch((e) => setError(e.message));
  }, []);

  const download = (path) => {
    const token = getToken();
    fetch(path, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = path.split('/').pop();
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError('تعذر تصدير التقرير'));
  };

  return (
    <AdminLayout>
      <h1 className="page-title">التقارير</h1>
      <p className="page-sub">تصدير البيانات بتنسيق Excel/CSV</p>
      {error && <div className="error-msg">{error}</div>}

      <div className="grid">
        <button className="card report-card" onClick={() => download('/api/admin/export/students')}>
          <div style={{ fontSize: 30 }}>🎓</div>
          <h3 className="mt mb">قائمة الطلاب</h3>
          <p className="muted">الأسماء، الأقسام، النقاط، الدورات المكتملة، الشهادات</p>
          <span className="btn btn-sm mt">⬇ تصدير CSV</span>
        </button>

        <button className="card report-card" onClick={() => download('/api/admin/export/reviews')}>
          <div style={{ fontSize: 30 }}>⭐</div>
          <h3 className="mt mb">تقييمات الدورات</h3>
          <p className="muted">كل التقييمات والتعليقات مع أسماء الطلاب</p>
          <span className="btn btn-sm mt">⬇ تصدير CSV</span>
        </button>

        <button className="card report-card" onClick={() => download('/api/admin/export/challenges')}>
          <div style={{ fontSize: 30 }}>🏆</div>
          <h3 className="mt mb">التحديات المحلولة</h3>
          <p className="muted">الطلاب الذين حلوا التحديات مع نقاطهم</p>
          <span className="btn btn-sm mt">⬇ تصدير CSV</span>
        </button>

        <button className="card report-card" onClick={() => download('/api/admin/export/quiz-results')}>
          <div style={{ fontSize: 30 }}>📝</div>
          <h3 className="mt mb">نتائج الاختبارات</h3>
          <p className="muted">درجات الطلاب في كل اختبار مع النجاح/الفشل</p>
          <span className="btn btn-sm mt">⬇ تصدير CSV</span>
        </button>
      </div>

      <h3 className="mb mt">تقارير الحضور</h3>
      {rooms.length === 0 && <p className="muted">لا توجد قاعات بث بعد</p>}
      <div className="grid">
        {rooms.map((r) => (
          <button key={r.id} className="card report-card" onClick={() => download(`/api/admin/export/attendance/${r.id}`)}>
            <div className="row space-between" style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 24 }}>🎥</div>
              <span className="chip">{r.participant_count} مشارك</span>
            </div>
            <strong>{r.title}</strong>
            <p className="muted mt">{r.course_title || 'بدون دورة'}</p>
            <span className="btn btn-sm mt">⬇ تصدير CSV</span>
          </button>
        ))}
      </div>
    </AdminLayout>
  );
}
