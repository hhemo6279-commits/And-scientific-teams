import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { AdminLayout } from './AdminLayout.jsx';

const TYPE_OPTIONS = [
  ['campaign', '📢 حملة'],
  ['initiative', '💡 مبادرة'],
  ['activity', '🎉 نشاط'],
  ['relief', '🤝 إغاثة'],
];

const APP_LABEL = {
  pending: ['قيد المراجعة', 'chip-gold'],
  approved: ['مقبول ✓', 'chip-green'],
  rejected: ['مرفوض', 'chip-red'],
  withdrawn: ['مسحوب', 'chip'],
  attended: ['حضر ✓', 'chip-green'],
  completed: ['مكتمل', 'chip'],
};

const blank = { title: '', type: 'campaign', description: '', location: '', starts_at: '', ends_at: '', required_skills: '', spots: 20, active: 1 };

export default function AdminVolunteers() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [apps, setApps] = useState(null);

  const load = () => api('/admin/volunteers').then(setData).catch((e) => setError(e.message));
  useEffect(load, []);

  const save = async () => {
    try {
      if (!form.title) throw new Error('العنوان مطلوب');
      const body = JSON.stringify(form);
      if (editId) await api(`/admin/volunteers/${editId}`, { method: 'PUT', body });
      else await api('/admin/volunteers', { method: 'POST', body });
      setShow(false); setForm(blank); setEditId(null); load();
    } catch (e) { setMsg(e.message); }
  };

  const del = async (id) => {
    if (!confirm('حذف البرنامج مع كل الطلبات؟')) return;
    await api(`/admin/volunteers/${id}`, { method: 'DELETE' });
    load();
  };

  const openApps = async (p) => {
    setApps(await api(`/admin/volunteers/${p.id}/applications`));
  };

  const setStatus = async (aid, status, hours) => {
    const body = hours !== undefined ? JSON.stringify({ status, hours_logged: hours }) : JSON.stringify({ status });
    await api(`/admin/volunteers/${apps.program.id}/applications/${aid}`, { method: 'PUT', body });
    openApps(apps.program);
  };

  if (error) return <AdminLayout><div className="error-msg">{error}</div></AdminLayout>;
  if (!data) return <AdminLayout><p className="muted">جارٍ التحميل...</p></AdminLayout>;

  const { programs } = data;

  return (
    <AdminLayout>
      <div className="row space-between mb">
        <h2>🤝 العمل التطوعي</h2>
        <button className="btn" onClick={() => { setShow(true); setEditId(null); setForm(blank); }}>+ برنامج جديد</button>
      </div>
      {msg && <div className="success-msg mb">{msg}</div>}

      {show && (
        <div className="card mb">
          <h3 className="mb">{editId ? 'تعديل البرنامج' : 'برنامج تطوعي جديد'}</h3>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="input" placeholder="العنوان *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ width: 240 }} />
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ width: 140 }}>
              {TYPE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input className="input" placeholder="الموقع" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ width: 170 }} />
            <input className="input" type="number" placeholder="المقاعد" value={form.spots} onChange={(e) => setForm({ ...form, spots: e.target.value })} style={{ width: 90 }} />
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
            <div className="mb" style={{ alignSelf: 'flex-end' }}>
              <label className="row" style={{ gap: 6 }}>
                <input type="checkbox" checked={form.active === 1} onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })} /> نشط
              </label>
            </div>
          </div>
          <input className="input mb" placeholder="المهارات المطلوبة (مفصولة بفواصل)" value={form.required_skills} onChange={(e) => setForm({ ...form, required_skills: e.target.value })} style={{ width: '100%' }} />
          <textarea className="input mb" rows={3} placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: '100%' }} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-success" onClick={save}>حفظ</button>
            <button className="btn btn-secondary" onClick={() => setShow(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {apps && (
        <div className="card mb">
          <div className="row space-between mb">
            <h3>المتطوعون: {apps.program.title}</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setApps(null)}>إغلاق</button>
          </div>
          {apps.applications.length === 0 && <p className="muted">لا متطوعين بعد.</p>}
          {apps.applications.map((a) => {
            const [label, cls] = APP_LABEL[a.status] || [a.status, 'chip'];
            const [al, ac] = [a.hours_logged, a.skills];
            return (
              <div key={a.id} className="row space-between" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
                <div>
                  <strong>{a.user_avatar} {a.user_name}</strong>
                  <span className="muted" style={{ fontSize: 12 }} dir="ltr"> {a.user_email}</span>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {a.skills && `المهارات: ${a.skills.slice(0, 60)}`} {a.hours_committed ? ` • ملتزم: ${a.hours_committed} ساعة` : ''}
                  </div>
                </div>
                <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                  <span className={`chip ${cls}`}>{label}{al > 0 ? ` (${al} ساعة)` : ''}</span>
                  {a.status === 'pending' && (
                    <>
                      <button className="btn btn-success btn-sm" onClick={() => setStatus(a.id, 'approved')}>قبول</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setStatus(a.id, 'rejected')}>رفض</button>
                    </>
                  )}
                  {['approved'].includes(a.status) && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setStatus(a.id, 'attended', a.hours_committed)}>تسجيل حضوره</button>
                  )}
                  {['attended'].includes(a.status) && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setStatus(a.id, 'completed', a.hours_committed)}>إكمال</button>
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
              <th>البرنامج</th><th>النوع</th><th>الموعد</th><th>المتطوعون</th><th>الطلبات</th><th>الساعات</th><th></th>
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.title}</strong></td>
                <td>{TYPE_OPTIONS.find(([k]) => k === p.type)?.[1] || p.type}</td>
                <td>{p.starts_at ? p.starts_at.slice(0, 10) : '—'}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openApps(p)}>
                    {p.applications_count} {p.pending_count > 0 ? `(${p.pending_count} معلقة)` : ''}
                  </button>
                </td>
                <td>{p.applications_count}/{p.spots}</td>
                <td>{p.hours_sum} ساعة</td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => { setEditId(p.id); setForm({ title: p.title, type: p.type, description: p.description, location: p.location, starts_at: p.starts_at || '', ends_at: p.ends_at || '', required_skills: p.required_skills, spots: p.spots, active: p.active }); setShow(true); }}>تعديل</button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(p.id)}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {programs.length === 0 && <p className="muted">لا توجد برامج بعد.</p>}
      </div>
    </AdminLayout>
  );
}