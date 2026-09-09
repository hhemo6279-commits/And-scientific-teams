import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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

export default function ResourceView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [purpose, setPurpose] = useState('');

  const load = () => api(`/resources/${id}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const book = async () => {
    try {
      await api(`/resources/${id}/book`, {
        method: 'POST',
        body: JSON.stringify({ from, until, purpose }),
      });
      setMsg(data.resource.requires_approval ? 'أُرسل طلب الحجز وسيُراجع من الإدارة 📋' : 'تم تأكيد حجزك بنجاح ✅');
      setFrom(''); setUntil(''); setPurpose('');
      load();
    } catch (e) { setMsg(e.message); }
  };

  const cancel = async (bid) => {
    if (!confirm('إلغاء هذا الحجز؟')) return;
    await api(`/resources/bookings/${bid}`, { method: 'DELETE' });
    setMsg('تم إلغاء الحجز.');
    load();
  };

  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;
  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  const { resource: r, my_bookings } = data;
  const meta = TYPE_META[r.type] || { icon: '🏛️', label: r.type };

  return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto' }}>
      <Link to="/resources" className="btn btn-secondary btn-sm mb">↩ كل المرافق</Link>

      <div className="card mb">
        <div className="row space-between">
          <div>
            <div className="row" style={{ gap: 6 }}>
              <span className="chip">{meta.icon} {meta.label}</span>
              <span className="chip">{r.requires_approval ? 'يتطلب موافقة الإدارة' : 'حجز فوري'}</span>
            </div>
            <h1 className="page-title" style={{ marginBottom: 6, marginTop: 8 }}>{r.name}</h1>
            <p className="muted">{r.location ? `📍 ${r.location}` : ''} • سعة {r.capacity}</p>
          </div>
        </div>
        <p className="mt" style={{ lineHeight: 1.9 }}>{r.description}</p>

        <div className="card mt" style={{ background: 'rgba(108,123,255,0.07)' }}>
          <h3 className="mb">حجز فترة</h3>
          <div className="row" style={{ gap: 8 }}>
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>من</label>
              <input className="input" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>إلى</label>
              <input className="input" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
          </div>
          <input className="input mt" placeholder="الغرض من الحجز (اختياري)" value={purpose} onChange={(e) => setPurpose(e.target.value)} style={{ width: '100%' }} />
          <button className="btn btn-success mt" onClick={book}>📅 احجز الآن</button>
        </div>
      </div>

      {msg && <div className="success-msg mb">{msg}</div>}

      <div className="card">
        <h3 className="mb">حجوزاتي على هذا المرفق</h3>
        {my_bookings.length === 0 && <p className="muted">لا توجد حجوزات بعد.</p>}
        {my_bookings.map((b) => {
          const s = STATUS_LABEL[b.status] || { label: b.status, cls: 'chip' };
          return (
            <div key={b.id} className="row space-between" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
              <div>
                <strong>{b.booked_from ? `${b.booked_from.slice(0, 16)} → ${b.booked_until ? b.booked_until.slice(11, 16) : ''}` : '—'}</strong>
                {b.purpose && <div className="muted" style={{ fontSize: 12 }}>{b.purpose}</div>}
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
    </div>
  );
}