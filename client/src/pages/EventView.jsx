import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

const TYPE_META = {
  conference: { icon: '🎤', label: 'مؤتمر' },
  workshop: { icon: '🛠️', label: 'ورشة عمل' },
  seminar: { icon: '🧑‍🏫', label: 'ندوة' },
  training: { icon: '📚', label: 'تدريب' },
  competition: { icon: '🏆', label: 'مسابقة' },
  activity: { icon: '🎉', label: 'نشاط' },
};

export default function EventView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api(`/events/${id}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const register = async () => {
    try {
      await api(`/events/${id}/register`, { method: 'POST' });
      setMsg('تم تسجيلك في الفعالية بنجاح 🎟️');
      load();
    } catch (e) { setMsg(e.message); }
  };

  const cancel = async () => {
    try {
      await api(`/events/${id}/register`, { method: 'DELETE' });
      setMsg('تم إلغاء تسجيلك.');
      load();
    } catch (e) { setMsg(e.message); }
  };

  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;
  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  const { event: e, my_registration } = data;
  const meta = TYPE_META[e.type] || { icon: '🎉', label: e.type };
  const full = e.registered_count >= e.capacity;

  return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto' }}>
      <Link to="/events" className="btn btn-secondary btn-sm mb">↩ كل الفعاليات</Link>

      <div className="card mb">
        <div className="row space-between">
          <div>
            <div className="row" style={{ gap: 6 }}>
              <span className="chip">{meta.icon} {meta.label}</span>
              {e.status === 'live' && <span className="chip chip-green">تجري الآن</span>}
              {e.status === 'ended' && <span className="chip">انتهت</span>}
              {e.status === 'upcoming' && <span className="chip chip-blue">قادمة</span>}
            </div>
            <h1 className="page-title" style={{ marginBottom: 6, marginTop: 8 }}>{e.title}</h1>
            <p className="muted">
              {e.speaker && <>🎙️ <strong>{e.speaker}</strong>{' • '}</>}
              {e.starts_at ? new Date(e.starts_at.replace(' ', 'T') + 'Z').toLocaleString('ar-IQ', { dateStyle: 'long', timeStyle: 'short' }) : ''}
            </p>
          </div>
        </div>

        {e.location && (
          <div className="chip mt">📍 {e.location}</div>
        )}

        <p className="mt" style={{ lineHeight: 1.9 }}>{e.description}</p>

        <div className="row mt" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="chip">👥 {e.registered_count}/{e.capacity} مسجل</span>
          {e.ends_at && <span className="chip">ينتهي: {e.ends_at.replace('T', ' ').slice(0, 16)}</span>}
        </div>

        <div className="card mt" style={{ background: 'rgba(108,123,255,0.07)' }}>
          {e.ended || e.status === 'ended' ? (
            <p className="muted">هذه الفعالية انتهت.</p>
          ) : my_registration ? (
            <div className="row space-between">
              <strong>🎟️ أنت مسجل في هذه الفعالية</strong>
              <button className="btn btn-secondary btn-sm" onClick={cancel}>إلغاء التسجيل</button>
            </div>
          ) : full ? (
            <p className="muted">المقاعد ممتلئة. يمكنك متابعة الفعالية من قسم الإعلانات لاحقاً.</p>
          ) : (
            <div>
              <button className="btn btn-success" onClick={register}>🎟️ سجّل في الفعالية</button>
              {e.status === 'live' && <span className="muted"> (الفعالية جارية — يمكنك الانضمام الآن)</span>}
            </div>
          )}
        </div>
      </div>

      {msg && <div className="success-msg mb">{msg}</div>}
    </div>
  );
}