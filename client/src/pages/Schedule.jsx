import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const TYPE_ICON = { 'محاضرة': '🎥', 'ورشة': '🛠️', 'اختبار': '📝', 'لقاء': '🤝' };

export default function Schedule() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api('/me/schedule').then((d) => setItems(d.items)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const remind = async (it) => {
    try {
      const d = await api(`/me/schedule/${it.id}/remind`, { method: 'POST' });
      if (d.ok) setMsg(`⏰ تم ضبط تذكير "${it.title}" — سنرسل لك إشعاراً`);
      else setMsg(d.message);
    } catch (e) { setError(e.message); }
  };

  const formatDate = (s) => {
    const d = new Date(s.replace(' ', 'T') + 'Z');
    return d.toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' }) + ' ' + d.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
  };

  const upcoming = items.filter((it) => it.hoursLeft >= 0);
  const past = items.filter((it) => it.hoursLeft < 0);

  return (
    <div className="page" style={{ maxWidth: 780, margin: '0 auto' }}>
      <h1 className="page-title">📅 الجدول الزمني</h1>
      <p className="page-sub">محاضراتك وورشك القادمة — اضبط تذكيرات ولن تفوتك أي جلسة</p>
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg mb">{msg}</div>}

      <h3 className="mb">🔼 الأحداث القادمة</h3>
      {upcoming.length === 0 && <p className="muted mb">لا توجد أحداث قادمة.</p>}
      {upcoming.map((it) => (
        <div key={it.id} className="card mb" style={{ borderRight: it.hoursLeft < 24 ? '4px solid #f39c12' : '4px solid #6c7bff' }}>
          <div className="row space-between">
            <div>
              <h3 className="mb" style={{ marginBottom: 4 }}>{TYPE_ICON[it.type] || '📌'} {it.title}</h3>
              <p className="muted mb" style={{ marginBottom: 4 }}>{formatDate(it.starts_at)}</p>
              {it.description && <p className="muted mb" style={{ fontSize: 13 }}>{it.description}</p>}
              <div className="row" style={{ gap: 6 }}>
                {it.section_name && <span className="chip">{it.section_name}</span>}
                {it.course_title && <span className="chip chip-gold">{it.course_title}</span>}
                <span className="chip">{it.type}</span>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              {it.hoursLeft >= 0 && it.hoursLeft < 24
                ? <span className="chip chip-red">{it.hoursLeft < 1 ? 'خلال دقائق' : `بعد ${it.hoursLeft} ساعة`}</span>
                : <span className="chip">{it.hoursLeft >= 0 ? `بعد ${Math.floor(it.hoursLeft / 24)} يوم` : ''}</span>}
              <div className="mt"><button className="btn btn-secondary btn-sm" onClick={() => remind(it)}>⏰ تذكيرني</button></div>
            </div>
          </div>
        </div>
      ))}

      {past.length > 0 && (
        <>
          <h3 className="mb mt">🔽 أحداث سابقة</h3>
          {past.map((it) => (
            <div key={it.id} className="card mb" style={{ opacity: 0.6 }}>
              <strong>{it.title}</strong>
              <div className="muted" style={{ fontSize: 12 }}>{formatDate(it.starts_at)}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
