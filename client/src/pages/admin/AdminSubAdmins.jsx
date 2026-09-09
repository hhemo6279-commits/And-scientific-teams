import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api } from '../../api.js';

export default function AdminSubAdmins() {
  const [subAdmins, setSubAdmins] = useState([]);
  const [allSections, setAllSections] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', sectionIds: [] });
  const [editing, setEditing] = useState(null);

  const load = () => {
    api('/admin/subadmins').then((d) => {
      setSubAdmins(d.subAdmins);
      setAllSections(d.allSections);
    }).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, []);

  const toggleSection = (sid) => {
    setForm((f) => {
      const has = f.sectionIds.includes(sid);
      return { ...f, sectionIds: has ? f.sectionIds.filter((x) => x !== sid) : [...f.sectionIds, sid] };
    });
  };

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/subadmins', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm({ name: '', email: '', password: '', sectionIds: [] });
      setMsg('تم إنشاء الأدمن الفرعي ✓');
      load();
    } catch (err) { setError(err.message); }
  };

  const update = async (e) => {
    e.preventDefault();
    try {
      await api(`/admin/subadmins/${editing.id}`, { method: 'PUT', body: JSON.stringify({ name: form.name, active: form.active, sectionIds: form.sectionIds }) });
      setEditing(null);
      setShowForm(false);
      setMsg('تم تحديث الأدمن الفرعي ✓');
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (s) => {
    if (!confirm(`حذف الأدمن الفرعي "${s.name}"؟`)) return;
    try {
      await api(`/admin/subadmins/${s.id}`, { method: 'DELETE' });
      load();
    } catch (err) { setError(err.message); }
  };

  const startEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, active: s.active, sectionIds: s.sections.map((x) => x.id), email: s.email, password: '' });
    setShowForm(true);
  };

  const sectionChips = (sections) =>
    sections.length ? sections.map((s) => <span key={s.id} className="chip mb">{s.icon} {s.name}</span>)
      : <span className="chip chip-red">بدون أقسام</span>;

  return (
    <AdminLayout>
      <div className="space-between">
        <div>
          <h1 className="page-title">إدارة الأدمن الفرعي</h1>
          <p className="page-sub">فقط الأدمن الرئيسي يصل هنا — حدد الأقسام التي يديرها كل أدمن فرعي</p>
        </div>
        <button className="btn" onClick={() => { setEditing(null); setForm({ name: '', email: '', password: '', sectionIds: [] }); setShowForm((v) => !v); }}>
          {showForm ? 'إغلاق' : '+ أدمن فرعي جديد'}
        </button>
      </div>
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg mb">{msg}</div>}

      {showForm && (
        <form onSubmit={editing ? update : create} className="card mb">
          <h3 className="mb">{editing ? 'تعديل أدمن فرعي' : 'أدمن فرعي جديد'}</h3>
          <div className="row mb">
            <input className="input" placeholder="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ flex: 1 }} />
            <input className="input" type="email" placeholder="البريد" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={{ flex: 1 }} />
            {!editing && <input className="input" type="password" placeholder="كلمة المرور" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required style={{ flex: 1 }} />}
          </div>
          <label className="label mb">الأقسام المسموح له بإدارتها:</label>
          <div className="row mb">
            {allSections.map((s) => (
              <label key={s.id} className="chip" style={{ cursor: 'pointer', background: form.sectionIds.includes(s.id) ? '#4a55c9' : '#232a4d', color: form.sectionIds.includes(s.id) ? '#fff' : '#aab0d0' }}>
                <input type="checkbox" checked={form.sectionIds.includes(s.id)} onChange={() => toggleSection(s.id)} style={{ display: 'none' }} />
                {s.icon} {s.name}
              </label>
            ))}
          </div>
          <button className="btn btn-success">{editing ? 'حفظ التعديلات' : 'إنشاء الأدمن الفرعي'}</button>
        </form>
      )}

      <table className="table">
        <thead><tr><th>الاسم</th><th>البريد</th><th>الأقسام المسموحة</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>
          {subAdmins.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td className="muted">{s.email}</td>
              <td>{sectionChips(s.sections)}</td>
              <td>{s.active ? <span className="chip chip-green">مفعل</span> : <span className="chip chip-red">معطل</span>}</td>
              <td>
                <div className="row">
                  <button className="btn btn-secondary btn-sm" onClick={() => startEdit(s)}>تعديل</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(s)}>حذف</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminLayout>
  );
}
