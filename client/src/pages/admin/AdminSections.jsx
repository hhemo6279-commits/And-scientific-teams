import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api, getUser } from '../../api.js';

export default function AdminSections() {
  const [sections, setSections] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', icon: '📁', color: '#7c8cff' });
  const isMain = getUser()?.role === 'main_admin';

  const load = () => api('/admin/sections').then((d) => setSections(d.sections)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/sections', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm({ name: '', description: '', icon: '📁', color: '#7c8cff' });
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (s) => {
    if (!confirm(`حذف قسم "${s.name}"؟`)) return;
    try {
      await api(`/admin/sections/${s.id}`, { method: 'DELETE' });
      load();
    } catch (err) { setError(err.message); }
  };

  return (
    <AdminLayout>
      <div className="space-between">
        <div>
          <h1 className="page-title">الأقسام</h1>
          <p className="page-sub">{isMain ? 'أضف وقم بإدارة جميع الأقسام' : 'الأقسام المخصصة لك فقط — لا ترى بقية المنصة'}</p>
        </div>
        {isMain && <button className="btn" onClick={() => setShowForm((v) => !v)}>{showForm ? 'إغلاق' : '+ قسم جديد'}</button>}
      </div>
      {error && <div className="error-msg">{error}</div>}

      {showForm && (
        <form onSubmit={create} className="card mb">
          <div className="row">
            <input className="input" placeholder="اسم القسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="input" placeholder="الأيقونة" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} style={{ width: 90 }} />
            <input className="input" placeholder="اللون" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: 90 }} />
          </div>
          <div className="mt">
            <textarea className="textarea" placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button className="btn btn-success mt">حفظ القسم</button>
        </form>
      )}

      <table className="table">
        <thead><tr><th>الأيقونة</th><th>الاسم</th><th>الوصف</th><th>الحالة</th>{isMain && <th>إجراءات</th>}</tr></thead>
        <tbody>
          {sections.map((s) => (
            <tr key={s.id}>
              <td>{s.icon}</td>
              <td>{s.name}</td>
              <td className="muted">{s.description}</td>
              <td>{s.active ? <span className="chip chip-green">مفعل</span> : <span className="chip chip-red">معطل</span>}</td>
              {isMain && <td><button className="btn btn-danger btn-sm" onClick={() => remove(s)}>حذف</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </AdminLayout>
  );
}
