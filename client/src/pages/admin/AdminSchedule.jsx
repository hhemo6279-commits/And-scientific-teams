import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api } from '../../api.js';

export default function AdminSchedule() {
  const [items, setItems] = useState([]);
  const [sections, setSections] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ title: '', description: '', type: 'محاضرة', starts_at: '', ends_at: '', section_id: '', course_id: '' });

  const load = () => {
    api('/admin/schedule').then((d) => setItems(d.items)).catch((e) => setError(e.message));
    api('/admin/sections').then((d) => setSections(d.sections)).catch(() => {});
    api('/admin/courses').then((d) => setCourses(d.courses)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/schedule', { method: 'POST', body: JSON.stringify({ ...form, section_id: form.section_id || null, course_id: form.course_id || null }) });
      setMsg('أُضيف الحدث إلى الجدول ✓');
      setForm({ title: '', description: '', type: 'محاضرة', starts_at: '', ends_at: '', section_id: '', course_id: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (it) => {
    if (!confirm(`حذف "${it.title}"؟`)) return;
    try {
      await api(`/admin/schedule/${it.id}`, { method: 'DELETE' });
      load();
    } catch (err) { setError(err.message); }
  };

  return (
    <AdminLayout>
      <h1 className="page-title">📅 الجدول الزمني</h1>
      <p className="page-sub">أضف محاضرات وورشاً واختبارات — يراها الطلاب مع تذكيرات</p>
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg mb">{msg}</div>}

      <form onSubmit={create} className="card mb">
        <h3 className="mb">حدث جديد</h3>
        <div className="row mb">
          <input className="input" placeholder="عنوان الحدث" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={{ flex: 1 }} />
          <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ width: 120 }}>
            <option>محاضرة</option><option>ورشة</option><option>اختبار</option><option>لقاء</option>
          </select>
        </div>
        <div className="row mb">
          <label className="label">يبدأ</label>
          <input className="input" type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} required dir="ltr" />
          <label className="label">ينتهي</label>
          <input className="input" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} dir="ltr" />
        </div>
        <div className="row mb">
          <select className="select" value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })}>
            <option value="">لكل الأقسام</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
          <select className="select" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
            <option value="">بدون دورة</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <textarea className="textarea mb" placeholder="وصف الحدث" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="btn btn-success">إضافة الحدث</button>
      </form>

      <table className="table">
        <thead><tr><th>الحدث</th><th>النوع</th><th>القسم/الدورة</th><th>الوقت</th><th>إجراءات</th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>
                <strong>{it.title}</strong>
                {it.description && <div className="muted" style={{ fontSize: 11 }}>{it.description}</div>}
              </td>
              <td><span className="chip">{it.type}</span></td>
              <td>{it.section_name || it.course_title || <span className="muted">الكل</span>}</td>
              <td dir="ltr" style={{ fontSize: 12 }}>{it.starts_at}</td>
              <td><button className="btn btn-danger btn-sm" onClick={() => remove(it)}>حذف</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminLayout>
  );
}
