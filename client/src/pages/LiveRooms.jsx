import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function LiveRooms() {
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/live').then((d) => setRooms(d.rooms)).catch((e) => setError(e.message));
  }, []);

  const statusLabel = (s) =>
    s === 'live' ? <span className="chip chip-red">مباشر الآن</span> : s === 'scheduled' ? <span className="chip chip-gold">مجدول</span> : <span className="chip">انتهى</span>;

  return (
    <div className="page">
      <h1 className="page-title">🎥 البث المباشر</h1>
      <p className="page-sub">قاعات تفاعلية تتسع لآلاف الطلاب — المدرب يبث والطلاب يشاركون بالأسئلة والاستطلاعات</p>
      {error && <div className="error-msg">{error}</div>}
      <div className="grid">
        {rooms.map((r) => (
          <div key={r.id} className="card">
            <div className="space-between" style={{ marginBottom: 8 }}>
              <h3>{r.title}</h3>
              {statusLabel(r.status)}
            </div>
            <p className="muted mb">المضيف: {r.host_name} {r.course_title ? '— ' + r.course_title : ''}</p>
            <div className="row space-between">
              <span className="chip">{r.participant_count} مشاهد</span>
              <Link to={`/live/${r.id}`} className="btn btn-sm">
                {r.status === 'live' ? 'دخول مباشر' : r.status === 'scheduled' ? 'التفاصيل' : 'التسجيل'}
              </Link>
            </div>
          </div>
        ))}
        {rooms.length === 0 && <p className="muted">لا توجد قاعات بث حالياً.</p>}
      </div>
    </div>
  );
}
