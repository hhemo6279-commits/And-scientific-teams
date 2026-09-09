import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { AdminLayout } from './AdminLayout.jsx';

const TYPE_OPTIONS = [
  ['conference', '🎤 مؤتمر'],
  ['workshop', '🛠️ ورشة عمل'],
  ['seminar', '🧑‍🏫 ندوة'],
  ['training', '📚 تدريب'],
  ['competition', '🏆 مسابقة'],
  ['activity', '🎉 نشاط'],
];

const blank = { title: '', type: 'workshop', description: '', location: '', starts_at: '', ends_at: '', capacity: 50, speaker: '', active: 1 };

export default function AdminEvents() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [regs, setRegs] = useState(null);

  const load = () => api('/admin/events').then(setData).catch((e) => setError(e.message));
  useEffect(load, []);

  const save = async () => {
    try {
      if (!form.title) throw new Error('العنوان مطلوب');
      const body = JSON.stringify(form);
      if (editId) await api(`/admin/events/${editId}`, { method: 'PUT', body });
      else await api('/admin/events', { method: 'POST', body });
      setShow(false); setForm(blank); setEditId(null); load();
    } catch (e) { setMsg(e.message); }
  };

  const del = async (id) => {
    if (!confirm('حذف الفعالية مع تسجيلاتها؟')) return;
    await api(`/admin/events/${id}`, { method: 'DELETE' });
    load();
  };

  const openRegs = async (e) => {
    setRegs(await api(`/admin/events/${e.id}/registrations`));
  };

  const toggleAttendance = async (regId, attended) => {
    await api(`/admin/events/${regs.event.id}/registrations/${regId}`, {
      method: 'PUT',
      body: JSON.stringify({ attended: !attended }),
    });
    openRegs(regs.event);
  };

  if (error) return <AdminLayout><div className="error-msg">{error}</div></AdminLayout>;
  if (!data) return <AdminLayout><p className="muted">جارٍ التحميل...</p></AdminLayout>;

  const { events } = data;

  return (
    <AdminLayout>
      <div className="row space-between mb">
        <h2>🎪 الفعاليات والمؤتمرات</h2>
        <button className="btn" onClick={() => { setShow(true); setEditId(null); setForm(blank); }}>+ فعالية جديدة</button>
      </div>
      {msg && <div className="success-msg mb">{msg}</div>}

      {show && (
        <div className="card mb">
          <h3 className="mb">{editId ? 'تعديل الفعالية' : 'فعالية جديدة'}</h3>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="input" placeholder="العنوان *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ width: 220 }} />
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ width: 150 }}>
              {TYPE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input className="input" placeholder="المكان" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ width: 160 }} />
            <input className="input" placeholder="المتحدث" value={form.speaker} onChange={(e) => setForm({ ...form, speaker: e.target.value })} style={{ width: 160 }} />
            <input className="input" type="number" placeholder="السعة" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} style={{ width: 90 }} />
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })} /> نشطة
            </label>
          </div>
          <div className="row mt" style={{ gap: 8 }}>
            <div className="mb">
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>البداية</label>
              <input className="input" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
            </div>
            <div className="mb">
              <label className="muted" style={{ display: 'block', marginBottom: 4 }}>النهاية</label>
              <input className="input" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
            </div>
          </div>
          <textarea className="input mb" rows={3} placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: '100%' }} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-success" onClick={save}>حفظ</button>
            <button className="btn btn-secondary" onClick={() => setShow(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {regs && (
        <div className="card mb">
          <div className="row space-between mb">
            <h3>المسجلون: {regs.event.title} <span className="chip">{regs.registrations.length} مسجل</span></h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setRegs(null)}>إغلاق</button>
          </div>
          {regs.registrations.length === 0 && <p className="muted">لا تسجيلات بعد.</p>}
          {regs.registrations.map((r) => (
            <div key={r.id} className="row space-between" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
              <div>
                <strong>{r.user_avatar} {r.user_name}</strong>
                <span className="muted" style={{ fontSize: 12 }}> {r.section_name ? `• ${r.section_name}` : ''}</span>
                <div className="muted" style={{ fontSize: 12 }} dir="ltr">{r.user_email} • سجل: {r.created_at}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <span className={`chip ${r.attended ? 'chip-green' : 'chip-gold'}`}>{r.attended ? 'حضر ✓' : 'لم يحضر'}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => toggleAttendance(r.id, r.attended)}>
                  {r.attended ? 'إلغاء الحضور' : 'تسجيل حضور'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>الفعالية</th><th>النوع</th><th>الموعد</th><th>المقاعد</th><th>الحضور</th><th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.title}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{e.speaker && `🎙️ ${e.speaker}`}</div>
                </td>
                <td>{TYPE_OPTIONS.find(([k]) => k === e.type)?.[1] || e.type}</td>
                <td>{e.starts_at ? e.starts_at.slice(0, 16).replace(' ', ' / ') : '—'}</td>
                <td>{e.registered_count}/{e.capacity}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openRegs(e)}>{e.attended_count} حضر</button>
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => { setEditId(e.id); setForm({ title: e.title, type: e.type, description: e.description, location: e.location, starts_at: e.starts_at || '', ends_at: e.ends_at || '', capacity: e.capacity, speaker: e.speaker, active: e.active }); setShow(true); }}>تعديل</button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(e.id)}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && <p className="muted">لا توجد فعاليات بعد.</p>}
      </div>
    </AdminLayout>
  );
}