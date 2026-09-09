import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api } from '../../api.js';

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ section_id: '', title: '', description: '', points: 100, flag: '', difficulty: 'سهل' });

  const load = () => {
    api('/admin/challenges').then((d) => setChallenges(d.challenges)).catch((e) => setError(e.message));
    api('/admin/sections').then((d) => setSections(d.sections)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/challenges', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm({ section_id: '', title: '', description: '', points: 100, flag: '', difficulty: 'سهل' });
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (c) => {
    if (!confirm(`حذف تحدي "${c.title}"؟`)) return;
    try {
      await api(`/admin/challenges/${c.id}`, { method: 'DELETE' });
      load();
    } catch (err) { setError(err.message); }
  };

  const [aiLoading, setAiLoading] = useState(false);
  const aiGenerate = async () => {
    const topic = form.title || '';
    if (!topic) { setError('اكتب موضوعاً (مثل: تشفير، شبكات، قاعدة بيانات) ثم ولّد'); return; }
    setAiLoading(true);
    setError('');
    try {
      const d = await api('/admin/ai/challenge', { method: 'POST', body: JSON.stringify({ topic }) });
      const c = d.challenge;
      setForm((f) => ({ ...f, title: f.title || c.title, description: c.description, difficulty: c.difficulty, points: c.points, flag: c.flag }));
    } catch (err) { setError(err.message); }
    setAiLoading(false);
  };

  return (
    <AdminLayout>
      <div className="space-between">
        <div>
          <h1 className="page-title">التحديات</h1>
          <p className="page-sub">تحديات عملية بأسلوب TryHackMe — FLAG للتحقق</p>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>{showForm ? 'إغلاق' : '+ تحدي جديد'}</button>
      </div>
      {error && <div className="error-msg">{error}</div>}

      {showForm && (
        <form onSubmit={create} className="card mb">
          <div className="row mb">
            <select className="select" value={form.section_id} onChange={(e) => setForm({ ...form, section_id: e.target.value })} required>
              <option value="">اختر القسم</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
            <input className="input" placeholder="عنوان التحدي" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={{ flex: 1 }} />
          </div>
          <button type="button" className="btn btn-secondary btn-sm mb" onClick={aiGenerate} disabled={aiLoading}>
            ✨ {aiLoading ? 'جارٍ التوليد...' : 'توليد تحدي بالذكاء الاصطناعي من العنوان'}
          </button>
          <div className="row mb">
            <input className="input" type="number" placeholder="النقاط" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} style={{ width: 120 }} />
            <select className="select" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} style={{ width: 120 }}>
              <option>سهل</option><option>متوسط</option><option>صعب</option>
            </select>
            <input className="input" placeholder="الـ FLAG (الإجابة الصحيحة)" value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value })} style={{ flex: 1 }} />
          </div>
          <textarea className="textarea mb" placeholder="وصف التحدي" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="btn btn-success">حفظ التحدي</button>
        </form>
      )}

      <table className="table">
        <thead><tr><th>التحدي</th><th>القسم</th><th>النقاط</th><th>الصعوبة</th><th>FLAG</th><th>إجراءات</th></tr></thead>
        <tbody>
          {challenges.map((c) => (
            <tr key={c.id}>
              <td>{c.title}</td>
              <td>{c.section_name}</td>
              <td className="chip chip-gold">+{c.points}</td>
              <td>{c.difficulty}</td>
              <td className="muted" dir="ltr">{c.flag}</td>
              <td><button className="btn btn-danger btn-sm" onClick={() => remove(c)}>حذف</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminLayout>
  );
}
