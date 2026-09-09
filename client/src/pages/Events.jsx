import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const TYPE_META = {
  conference: { icon: '🎤', label: 'مؤتمر' },
  workshop: { icon: '🛠️', label: 'ورشة عمل' },
  seminar: { icon: '🧑‍🏫', label: 'ندوة' },
  training: { icon: '📚', label: 'تدريب' },
  competition: { icon: '🏆', label: 'مسابقة' },
  activity: { icon: '🎉', label: 'نشاط' },
};

const STATUS_META = {
  upcoming: { label: 'قادمة', cls: 'chip-blue' },
  live: { label: 'تجري الآن', cls: 'chip-green' },
  ended: { label: 'انتهت', cls: 'chip' },
};

export default function Events() {
  const [data, setData] = useState(null);
  const [regs, setRegs] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('all');

  const load = () => {
    api('/events').then(setData).catch((e) => setError(e.message));
    api('/events/mine/registrations').then((d) => setRegs(d.registrations)).catch(() => {});
  };
  useEffect(load, []);

  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;
  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  const list = filter === 'all' ? data.events : data.events.filter((e) => e.type === filter);

  return (
    <div className="page">
      <div className="card mb" style={{ background: 'linear-gradient(120deg,rgba(159,108,255,.14),rgba(108,123,255,.14))' }}>
        <h1 className="page-title" style={{ marginBottom: 6 }}>🎪 الفعاليات والمؤتمرات</h1>
        <p className="muted" style={{ lineHeight: 1.8 }}>
          مؤتمرات، ورش عمل، ندوات، ومسابقات. سجّل لحجز مقعدك، وستؤكد لوحة الاستقبال حضورك يوم الفعالية.
        </p>
      </div>

      {msg && <div className="success-msg mb">{msg}</div>}

      <div className="row mb" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${filter === 'all' ? '' : 'btn-secondary'}`} onClick={() => setFilter('all')}>الكل</button>
        {Object.entries(TYPE_META).map(([k, v]) => (
          <button key={k} className={`btn btn-sm ${filter === k ? '' : 'btn-secondary'}`} onClick={() => setFilter(k)}>{v.icon} {v.label}</button>
        ))}
      </div>

      {list.length === 0 && <p className="muted">لا توجد فعاليات متاحة حالياً.</p>}

      <div className="grid">
        {list.map((e) => {
          const meta = TYPE_META[e.type] || { icon: '🎉', label: e.type };
          const st = STATUS_META[e.status] || { label: e.status, cls: 'chip' };
          const full = e.registered_count >= e.capacity;
          return (
            <Link key={e.id} to={`/events/${e.id}`} style={{ color: 'inherit' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="row space-between" style={{ marginBottom: 6 }}>
                  <span className="chip">{meta.icon} {meta.label}</span>
                  <span className={`chip ${e.status === 'ended' ? '' : 'chip-green'}`}>{st.label}</span>
                </div>
                <h3 style={{ marginBottom: 4 }}>{e.title}</h3>
                <p className="muted mb" style={{ fontSize: 13 }}>
                  {e.speaker ? `🎙️ ${e.speaker} • ` : ''}{e.starts_at ? e.starts_at.slice(0, 16).replace('T', ' ') : ''}
                </p>
                <p className="muted mb" style={{ lineHeight: 1.7, flex: 1 }}>{(e.description || '').slice(0, 120)}{(e.description || '').length > 120 ? '...' : ''}</p>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {e.location && <span className="chip">📍 {e.location}</span>}
                  <span className="chip">{e.registered_count}/{e.capacity} مسجل</span>
                  {full && <span className="chip chip-red">ممتلئ</span>}
                  {e.my_registration && <span className="chip chip-green">مسجل ✓</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {regs.length > 0 && (
        <>
          <h2 className="mb mt">🎟️ فعالياتي</h2>
          <div className="card">
            {regs.map((r) => (
              <div key={r.id} className="row space-between" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
                <div>
                  <Link to={`/events/${r.event_id}`}><strong>{r.title}</strong></Link>
                  <div className="muted" style={{ fontSize: 12 }}>{r.starts_at ? r.starts_at.slice(0, 10) : ''} • {r.location}</div>
                </div>
                <span className={`chip ${r.attended ? 'chip-green' : 'chip-gold'}`}>{r.attended ? 'حضرت ✓' : 'لم يحضر بعد'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}