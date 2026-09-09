import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { AdminLayout } from './AdminLayout.jsx';

const TYPE_OPTIONS = [
  ['room', '🏛️ قاعة'],
  ['lab', '🧪 مختبر'],
  ['equipment', '🎥 معدة'],
  ['device', '📺 جهاز'],
  ['training', '📚 مورد تدريبي'],
];

const BOOL_LABEL = {
  pending: ['قيد المراجعة', 'chip-gold'],
  approved: ['مؤكد ✓', 'chip-green'],
  rejected: ['مرفوض', 'chip-red'],
  cancelled: ['ملغي', 'chip'],
  completed: ['مكتمل ✓', 'chip'],
};

const blank = { name: '', type: 'room', description: '', location: '', capacity: 1, requires_approval: 0, active: 1 };

export default function AdminResources() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [bookings, setBookings] = useState(null);

  const load = () => api('/admin/resources').then(setData).catch((e) => setError(e.message));
  useEffect(load, []);

  const save = async () => {
    try {
      if (!form.name) throw new Error('الاسم مطلوب');
      const body = JSON.stringify(form);
      if (editId) await api(`/admin/resources/${editId}`, { method: 'PUT', body });
      else await api('/admin/resources', { method: 'POST', body });
      setShow(false); setForm(blank); setEditId(null); load();
    } catch (e) { setMsg(e.message); }
  };

  const del = async (id) => {
    if (!confirm('حذف المرفق مع كل حجوزاته؟')) return;
    await api(`/admin/resources/${id}`, { method: 'DELETE' });
    load();
  };

  const openBookings = async (r) => {
    setBookings(await api(`/admin/resources/${r.id}/bookings`));
  };

  const setStatus = async (bid, status) => {
    await api(`/admin/resources/${bookings.resource.id}/bookings/${bid}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    openBookings(bookings.resource);
  };

  if (error) return <AdminLayout><div className="error-msg">{error}</div></AdminLayout>;
  if (!data) return <AdminLayout><p className="muted">جارٍ التحميل...</p></AdminLayout>;

  const { resources } = data;

  return (
    <AdminLayout>
      <div className="row space-between mb">
        <h2>🏢 المرافق والقاعات</h2>
        <button className="btn" onClick={() => { setShow(true); setEditId(null); setForm(blank); }}>+ مرفق جديد</button>
      </div>
      {msg && <div className="success-msg mb">{msg}</div>}

      {show && (
        <div className="card mb">
          <h3 className="mb">{editId ? 'تعديل المرفق' : 'مرفق جديد'}</h3>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="input" placeholder="الاسم *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: 220 }} />
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ width: 150 }}>
              {TYPE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input className="input" placeholder="الموقع" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ width: 180 }} />
            <input className="input" type="number" placeholder="السعة" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} style={{ width: 90 }} />
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={form.requires_approval === 1} onChange={(e) => setForm({ ...form, requires_approval: e.target.checked ? 1 : 0 })} /> يتطلب موافقة
            </label>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={form.active === 1} onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })} /> نشط
            </label>
          </div>
          <textarea className="input mt mb" rows={3} placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: '100%' }} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-success" onClick={save}>حفظ</button>
            <button className="btn btn-secondary" onClick={() => setShow(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {bookings && (
        <div className="card mb">
          <div className="row space-between mb">
            <h3>حجوزات: {bookings.resource.name}</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setBookings(null)}>إغلاق</button>
          </div>
          {bookings.bookings.length === 0 && <p className="muted">لا حجوزات بعد.</p>}
          {bookings.bookings.map((b) => {
            const [label, cls] = BOOL_LABEL[b.status] || [b.status, 'chip'];
            return (
              <div key={b.id} className="row space-between" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
                <div>
                  <strong>{b.user_avatar} {b.user_name}</strong>
                  <span className="muted" style={{ fontSize: 12 }} dir="ltr"> {b.user_email}</span>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {b.booked_from ? `${b.booked_from.slice(0, 16)} → ${b.booked_until ? b.booked_until.slice(11, 16) : ''}` : '—'}
                    {b.purpose && ` • ${b.purpose.slice(0, 40)}`}
                  </div>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <span className={`chip ${cls}`}>{label}</span>
                  {b.status === 'pending' && (
                    <>
                      <button className="btn btn-success btn-sm" onClick={() => setStatus(b.id, 'approved')}>موافقة</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setStatus(b.id, 'rejected')}>رفض</button>
                    </>
                  )}
                  {b.status === 'approved' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setStatus(b.id, 'completed')}>إكمال</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>المرفق</th><th>النوع</th><th>الموقع</th><th>السعة</th><th>الحجوزات</th><th></th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{r.requires_approval ? 'يتطلب موافقة' : 'حجز فوري'}</div>
                </td>
                <td>{TYPE_OPTIONS.find(([k]) => k === r.type)?.[1] || r.type}</td>
                <td>{r.location || '—'}</td>
                <td>{r.capacity}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openBookings(r)}>
                    {r.bookings_count} {r.pending_count > 0 ? `(${r.pending_count} معلقة)` : ''}
                  </button>
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => { setEditId(r.id); setForm({ name: r.name, type: r.type, description: r.description, location: r.location, capacity: r.capacity, requires_approval: r.requires_approval, active: r.active }); setShow(true); }}>تعديل</button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(r.id)}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {resources.length === 0 && <p className="muted">لا توجد مرافق بعد.</p>}
      </div>
    </AdminLayout>
  );
}