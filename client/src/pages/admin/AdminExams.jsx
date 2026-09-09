import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api } from '../../api.js';

export default function AdminExams() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [settings, setSettings] = useState({ title: 'الامتحان النهائي', passing_score: 60, duration_minutes: 30 });
  const [qForm, setQForm] = useState({ question: '', options: ['', '', '', ''], correct_index: 0 });

  const loadCourses = () => api('/admin/courses').then((d) => setCourses(d.courses)).catch((e) => setError(e.message));
  useEffect(() => { loadCourses(); }, []);

  const loadExam = async (cid) => {
    if (!cid) { setExam(null); setQuestions([]); return; }
    try {
      const d = await api(`/admin/courses/${cid}/exam`);
      setExam(d.exam);
      setQuestions(d.questions);
      if (d.exam) setSettings({ title: d.exam.title, passing_score: d.exam.passing_score, duration_minutes: d.exam.duration_minutes });
    } catch (e) { setError(e.message); }
  };

  const selectCourse = (cid) => {
    setCourseId(cid);
    loadExam(cid);
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      await api(`/admin/courses/${courseId}/exam`, { method: 'POST', body: JSON.stringify(settings) });
      setMsg('حُفظت إعدادات الامتحان ✓');
      loadExam(courseId);
    } catch (err) { setError(err.message); }
  };

  const generateAI = async () => {
    try {
      await api(`/admin/courses/${courseId}/exam/generate`, { method: 'POST' });
      setMsg('تم توليد الأسئلة بالذكاء الاصطناعي ✓');
      loadExam(courseId);
    } catch (err) { setError(err.message); }
  };

  const addQuestion = async (e) => {
    e.preventDefault();
    if (!exam) { setError('أنشئ الامتحان أولاً'); return; }
    try {
      await api(`/admin/exam/${exam.id}/questions`, { method: 'POST', body: JSON.stringify(qForm) });
      setQForm({ question: '', options: ['', '', '', ''], correct_index: 0 });
      loadExam(courseId);
    } catch (err) { setError(err.message); }
  };

  const removeQuestion = async (q) => {
    if (!confirm('حذف هذا السؤال؟')) return;
    try {
      await api(`/admin/exam/questions/${q.id}`, { method: 'DELETE' });
      loadExam(courseId);
    } catch (err) { setError(err.message); }
  };

  return (
    <AdminLayout>
      <h1 className="page-title">📝 الامتحانات النهائية</h1>
      <p className="page-sub">حدد امتحاناً نهائياً لكل دورة مع نسبة النجاح — أو ولّده تلقائياً</p>
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg mb">{msg}</div>}

      <div className="card mb">
        <label className="label">اختر الدورة:</label>
        <select className="select" value={courseId} onChange={(e) => selectCourse(e.target.value)}>
          <option value="">— اختر دورة —</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      {courseId && (
        <>
          <form onSubmit={saveSettings} className="card mb">
            <h3 className="mb">إعدادات الامتحان</h3>
            <div className="row mb">
              <input className="input" placeholder="عنوان الامتحان" value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} style={{ flex: 1 }} />
              <input className="input" type="number" placeholder="نسبة النجاح %" value={settings.passing_score} onChange={(e) => setSettings({ ...settings, passing_score: Number(e.target.value) })} style={{ width: 120 }} />
              <input className="input" type="number" placeholder="المدة (دقيقة)" value={settings.duration_minutes} onChange={(e) => setSettings({ ...settings, duration_minutes: Number(e.target.value) })} style={{ width: 120 }} />
            </div>
            <div className="row">
              <button className="btn btn-success">حفظ الإعدادات</button>
              <button type="button" className="btn btn-secondary" onClick={generateAI}>✨ توليد 5 أسئلة بالذكاء الاصطناعي</button>
            </div>
          </form>

          <form onSubmit={addQuestion} className="card mb">
            <h3 className="mb">سؤال جديد</h3>
            <input className="input mb" placeholder="نص السؤال" value={qForm.question} onChange={(e) => setQForm({ ...qForm, question: e.target.value })} required />
            {qForm.options.map((opt, i) => (
              <div key={i} className="row mb">
                <input type="radio" checked={qForm.correct_index === i} onChange={() => setQForm({ ...qForm, correct_index: i })} />
                <input className="input" placeholder={`الخيار ${i + 1}`} value={opt} onChange={(e) => setQForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? e.target.value : o)) }))} style={{ flex: 1 }} />
                {qForm.correct_index === i && <span className="chip chip-green">صحيح</span>}
              </div>
            ))}
            <button className="btn">إضافة السؤال</button>
          </form>

          <h3 className="mb">الأسئلة ({questions.length})</h3>
          {questions.map((q, qi) => (
            <div key={q.id} className="card mb" style={{ background: 'var(--bg-2)' }}>
              <div className="row space-between mb">
                <strong>{qi + 1}. {q.question}</strong>
                <button className="btn btn-danger btn-sm" onClick={() => removeQuestion(q)}>حذف</button>
              </div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {q.options.map((o, i) => (
                  <span key={i} className={`chip ${i === q.correct_index ? 'chip-green' : ''}`}>{i === q.correct_index ? '✓ ' : ''}{o}</span>
                ))}
              </div>
            </div>
          ))}
          {questions.length === 0 && <p className="muted">لا توجد أسئلة بعد — ولّدها بالذكاء الاصطناعي أو أضفها يدوياً.</p>}
        </>
      )}
    </AdminLayout>
  );
}
