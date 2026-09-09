import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { AdminLayout } from './AdminLayout.jsx';

const TYPE_OPTIONS = [
  ['internship', '💼 تدريب'],
  ['job', '🧑‍💻 وظيفة'],
  ['scholarship', '🎓 منحة'],
  ['competition', '🏆 مسابقة'],
  ['program', '📚 برنامج'],
];

const blank = { title: '', type: 'internship', organization: '', description: '', location: '', deadline: '', eligibility: '', spots: 1, active: 1 };

export default function AdminOpportunities() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [applicants, setApplicants] = useState(null);

  const load = () => api('/admin/opportunities').then(setData).catch((e) => setError(e.message));
  useEffect(load, []);

  const save = async () => {
    try {
      if (!form.title) throw new Error('العنوان مطلوب');
      const body = JSON.stringify(form);
      if (editId) await api(`/admin/opportunities/${editId}`, { method: 'PUT', body });
      else await api('/admin/opportunities', { method: 'POST', body });
      setShow(false); setForm(blank); setEditId(null); load();
    } catch (e) { setMsg(e.message); }
  };

  const del = async (id) => {
    if (!confirm('حذف الفرصة مع جميع الطلبات؟')) return;
    await api(`/admin/opportunities/${id}`, { method: 'DELETE' });
    load();
  };

  const openApplicants = async (o) => {
    setApplicants(await api(`/admin/opportunities/${o.id}/applications`));
  };

  const decide = async (appId, status) => {
    await api(`/admin/opportunities/${applicants.opportunity.id}/applications/${appId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    openApplicants(applicants.opportunity);
  };

  if (error) return <AdminLayout><div className="error-msg">{error}</div></AdminLayout>;
  if (!data) return <AdminLayout><p className="muted">جارٍ التحميل...</p></AdminLayout>;

  const { opportunities } = data;

  return (
    <AdminLayout>
      <div className="row space-between mb">
        <h2>💼 الفرص</h2>
        <button className="btn" onClick={() => { setShow(true); setEditId(null); setForm(blank); }}>+ فرصة جديدة</button>
      </div>
      {msg && <div className="success-msg mb">{msg}</div>}

      {show && (
        <div className="card mb">
          <h3 className="mb">{editId ? 'تعديل الفرصة' : 'فرصة جديدة'}</h3>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input className="input" placeholder="العنوان *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ width: 220 }} />
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ width: 140 }}>
              {TYPE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input className="input" placeholder="الجهة" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} style={{ width: 160 }} />
            <input className="input" placeholder="الموقع" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={{ width: 140 }} />
            <input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} style={{ width: 150 }} />
            <input className="input" type="number" placeholder="المقاعد" value={form.spots} onChange={(e) => setForm({ ...form, spots: e.target.value })} style={{ width: 90 }} />
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })} /> نشطة
            </label>
          </div>
          <div className="mt">
            <input className="input mb" placeholder="شروط الأهلية" value={form.eligibility} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} style={{ width: '100%' }} />
            <textarea className="input mb" rows={3} placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-success" onClick={save}>حفظ</button>
            <button className="btn btn-secondary" onClick={() => setShow(false)}>إلغاء</button>
          </div>
        </div>
      )}

      {applicants && (
        <div className="card mb">
          <div className="row space-between mb">
            <h3>المتقدمون: {applicants.opportunity.title}</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setApplicants(null)}>إغلاق</button>
          </div>
          {applicants.applicants.length === 0 && <p className="muted">لا متقدمين بعد.</p>}
          {applicants.applicants.map((a) => (
            <div key={a.id} className="row space-between" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
              <div>
                <strong>{a.user_avatar} {a.user_name}</strong>
                <div className="muted" style={{ fontSize: 12 }} dir="ltr">{a.user_email}</div>
                <div className="muted" style={{ fontSize: 12 }}>توافق {a.fit}% • {a.courses_done} دورات • {a.challenges_solved} تحديات • {a.certificates_count} شهادات</div>
                {a.note && <div className="muted" style={{ fontSize: 12 }}>📝 {a.note}</div>}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <span className={`chip ${a.status === 'accepted' ? 'chip-green' : a.status === 'rejected' ? 'chip-red' : 'chip-gold'}`}>
                  {a.status === 'accepted' ? 'مقبول' : a.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                </span>
                {a.status !== 'accepted' && <button className="btn btn-success btn-sm" onClick={() => decide(a.id, 'accepted')}>قبول</button>}
                {a.status !== 'rejected' && <button className="btn btn-danger btn-sm" onClick={() => decide(a.id, 'rejected')}>رفض</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>الفرصة</th><th>النوع</th><th>الجهة</th><th>الموعد</th><th>متقدمون</th><th>الحالة</th><th></th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((o) => (
              <tr key={o.id}>
                <td><strong>{o.title}</strong></td>
                <td>{TYPE_OPTIONS.find(([k]) => k === o.type)?.[1] || o.type}</td>
                <td>{o.organization}</td>
                <td>{o.deadline ? o.deadline.slice(0, 10) : '—'}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openApplicants(o)}>{o.applicants_count} متقدم</button>
                </td>
                <td><span className={o.active ? 'chip chip-green' : 'chip'}>{o.active ? 'نشطة' : 'معطلة'}</span></td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => { setEditId(o.id); setForm({ title: o.title, type: o.type, organization: o.organization, description: o.description, location: o.location, deadline: o.deadline || '', eligibility: o.eligibility, spots: o.spots, active: o.active }); setShow(true); }}>تعديل</button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(o.id)}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {opportunities.length === 0 && <p className="muted">لا توجد فرص بعد.</p>}
      </div>
    </AdminLayout>
  );
}