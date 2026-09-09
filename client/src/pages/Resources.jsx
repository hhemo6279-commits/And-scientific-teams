import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const TYPE_META = {
  room: { icon: '🏛️', label: 'قاعة' },
  lab: { icon: '🧪', label: 'مختبر' },
  equipment: { icon: '🎥', label: 'معدة' },
  device: { icon: '📺', label: 'جهاز' },
  training: { icon: '📚', label: 'مورد تدريبي' },
};

const STATUS_LABEL = {
  pending: { label: 'قيد المراجعة', cls: 'chip-gold' },
  approved: { label: 'مؤكد ✓', cls: 'chip-green' },
  rejected: { label: 'مرفوض', cls: 'chip-red' },
  cancelled: { label: 'ملغي', cls: 'chip' },
  completed: { label: 'مكتمل ✓', cls: 'chip' },
};

export default function Resources() {
  const [data, setData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const load = () => {
    api('/resources').then(setData).catch((e) => setError(e.message));
    api('/resources/mine/bookings').then((d) => setBookings(d.bookings)).catch(() => {});
  };
  useEffect(load, []);

  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;
  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  const list = filter === 'all' ? data.resources : data.resources.filter((r) => r.type === filter);

  const cancel = async (bid) => {
    if (!confirm('إلغاء هذا الحجز؟')) return;
    await api(`/resources/bookings/${bid}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="page">
      <div className="card mb" style={{ background: 'linear-gradient(120deg,rgba(108,123,255,.14),rgba(52,211,153,.12))' }}>
        <h1 className="page-title" style={{ marginBottom: 6 }}>🏢 المرافق والقاعات</h1>
        <p className="muted" style={{ lineHeight: 1.8 }}>
          احجز قاعات الدراسة والمختبرات والمعدات لفترات محددة. الحجوزات تُؤكد فوراً أو تنتظر موافقة الإدارة حسب المرفق.
        </p>
      </div>

      <div className="row mb" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${filter === 'all' ? '' : 'btn-secondary'}`} onClick={() => setFilter('all')}>الكل</button>
        {Object.entries(TYPE_META).map(([k, v]) => (
          <button key={k} className={`btn btn-sm ${filter === k ? '' : 'btn-secondary'}`} onClick={() => setFilter(k)}>{v.icon} {v.label}</button>
        ))}
      </div>

      {list.length === 0 && <p className="muted">لا توجد مرافق متاحة حالياً.</p>}

      <div className="grid">
        {list.map((r) => {
          const meta = TYPE_META[r.type] || { icon: '🏛️', label: r.type };
          return (
            <Link key={r.id} to={`/resources/${r.id}`} style={{ color: 'inherit' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="row space-between" style={{ marginBottom: 6 }}>
                  <span className="chip">{meta.icon} {meta.label}</span>
                  <span className="chip">{r.requires_approval ? 'يتطلب موافقة' : 'حجز فوري'}</span>
                </div>
                <h3 style={{ marginBottom: 4 }}>{r.name}</h3>
                <p className="muted mb" style={{ lineHeight: 1.7, flex: 1 }}>{(r.description || '').slice(0, 110)}{(r.description || '').length > 110 ? '...' : ''}</p>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {r.location && <span className="chip">📍 {r.location}</span>}
                  <span className="chip">سعة {r.capacity}</span>
                  {r.active_bookings > 0 && <span className="chip chip-gold">{r.active_bookings} حجز نشط</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {bookings.length > 0 && (
        <>
          <h2 className="mb mt">🗓️ حجوزاتي</h2>
          <div className="card">
            {bookings.map((b) => {
              const s = STATUS_LABEL[b.status] || { label: b.status, cls: 'chip' };
              return (
                <div key={b.id} className="row space-between" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
                  <div>
                    <Link to={`/resources/${b.resource_id}`}><strong>{b.resource_name}</strong></Link>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {b.booked_from ? `${b.booked_from.slice(0, 16)} → ${b.booked_until ? b.booked_until.slice(11, 16) : ''}` : '—'}
                      {b.purpose && ` • ${b.purpose.slice(0, 40)}`}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className={`chip ${s.cls}`}>{s.label}</span>
                    {['pending', 'approved'].includes(b.status) && (
                      <button className="btn btn-secondary btn-sm" onClick={() => cancel(b.id)}>إلغاء</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}