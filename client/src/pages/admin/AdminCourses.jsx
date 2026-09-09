import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api, getUser } from '../../api.js';

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ section_id: '', title: '', description: '', level: 'مبتدئ', price: 0, duration_hours: 0, outcomes: '', prerequisites: '', instructor: '', language: 'العربية' });
  const isMain = getUser()?.role === 'main_admin';

  const load = () => {
    api('/admin/courses').then((d) => setCourses(d.courses)).catch((e) => setError(e.message));
    api('/admin/sections').then((d) => setSections(d.sections)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/courses', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (c) => {
    if (!confirm(`حذف دورة "${c.title}"؟`)) return;
    try {
      await api(`/admin/courses/${c.id}`, { method: 'DELETE' });
      load();
    } catch (err) { setError(err.message); }
  };

  const [aiLoading, setAiLoading] = useState(false);

  const aiGenerate = async (e) => {
    e.preventDefault();
    if (!form.title) { setError('اكتب عنوان الدورة أولاً ليُولّد المخطط'); return; }
    setAiLoading(true);
    setError('');
    try {
      const d = await api('/admin/ai/course-plan', { method: 'POST', body: JSON.stringify({ title: form.title, section_name: sections.find((s) => String(s.id) === String(form.section_id))?.name }) });
      const p = d.plan;
      setForm((f) => ({ ...f, description: f.description || p.description, outcomes: f.outcomes || p.outcomes.join('\n'), prerequisites: f.prerequisites || p.prerequisites }));
      alert('✨ تم توليد المخطط! أضف الدروس يدوياً من صفحة الدروس، أو فعّل التوليد التلقائي هناك.');
    } catch (err) { setError(err.message); }
    setAiLoading(false);
  };

  return (
    <AdminLayout>
      <div className="space-between">
        <div>
          <h1 className="page-title">الدورات</h1>
          <p className="page-sub">{isMain ? 'إدارة جميع الدورات' : 'دورات أقسامك فقط'}</p>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>{showForm ? 'إغلاق' : '+ دورة جديدة'}</button>
      </div>
      {error && <div className="error-msg">{error}</div>}

      {showForm && (
        <form onSubmit={create} className="card mb">
          <div className="row mb">
            <select className="select" value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })} required>
              <option value="">اختر القسم</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
            <input className="input" placeholder="عنوان الدورة" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={{ flex: 1 }} />
          </div>
          <button type="button" className="btn btn-secondary btn-sm mb" onClick={aiGenerate} disabled={aiLoading}>
            ✨ {aiLoading ? 'جارٍ التوليد...' : 'توليد مخطط بالذكاء الاصطناعي'}
          </button>
          <div className="row mb">
            <select className="select" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} style={{ width: 140 }}>
              <option>مبتدئ</option><option>متوسط</option><option>متقدم</option>
            </select>
            <input className="input" type="number" placeholder="السعر ($)" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} style={{ width: 120 }} />
            <input className="input" type="number" placeholder="المدة (ساعة)" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: Number(e.target.value) })} style={{ width: 140 }} />
            <input className="input" placeholder="اللغة" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} style={{ width: 120 }} />
          </div>
          <input className="input mb" placeholder="المدرب/المدرس" value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} />
          <textarea className="textarea mb" placeholder="مخرجات التعلم (كل مخرج في سطر)" value={form.outcomes} onChange={(e) => setForm({ ...form, outcomes: e.target.value })} />
          <input className="input mb" placeholder="المتطلبات المسبقة" value={form.prerequisites} onChange={(e) => setForm({ ...form, prerequisites: e.target.value })} />
          <textarea className="textarea mb" placeholder="الوصف" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="btn btn-success">حفظ الدورة</button>
        </form>
      )}

      <table className="table">
        <thead><tr><th>الدورة</th><th>القسم</th><th>المستوى</th><th>السعر</th>{isMain && <th>إجراءات</th>}</tr></thead>
        <tbody>
          {courses.map((c) => (
            <tr key={c.id}>
              <td>{c.title}</td>
              <td>{c.section_name}</td>
              <td>{c.level}</td>
              <td>{c.price > 0 ? c.price + '$' : <span className="chip chip-green">مجاني</span>}</td>
              {isMain && <td><button className="btn btn-danger btn-sm" onClick={() => remove(c)}>حذف</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </AdminLayout>
  );
}
