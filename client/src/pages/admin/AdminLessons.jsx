import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api } from '../../api.js';

const EMPTY_QUESTIONS = [{ question: '', options: ['', '', '', ''], correct_index: 0 }];

export default function AdminLessons() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', type: 'text', order_no: 0, quizQuestions: JSON.parse(JSON.stringify(EMPTY_QUESTIONS)) });

  const loadCourses = () => api('/admin/courses').then((d) => setCourses(d.courses)).catch((e) => setError(e.message));
  useEffect(() => { loadCourses(); }, []);

  const loadLessons = (cid) => {
    if (!cid) { setLessons([]); return; }
    api(`/admin/courses/${cid}/lessons`).then((d) => setLessons(d.lessons)).catch((e) => setError(e.message));
  };

  const selectCourse = (cid) => {
    setCourseId(cid);
    setLessons([]);
    loadLessons(cid);
  };

  const startAdd = () => {
    setForm({ title: '', content: '', type: 'text', order_no: lessons.length + 1, quizQuestions: JSON.parse(JSON.stringify(EMPTY_QUESTIONS)) });
    setShowForm(true);
  };

  const startEdit = (l) => {
    setForm({
      title: l.title,
      content: l.content,
      type: l.type,
      order_no: l.order_no,
      quizQuestions: (l.quizQuestions || []).length ? l.quizQuestions.map((q) => ({ question: q.question, options: JSON.parse(q.options), correct_index: q.correct_index })) : JSON.parse(JSON.stringify(EMPTY_QUESTIONS)),
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form };
      if (form.type === 'quiz') payload.quizQuestions = form.quizQuestions;
      await api(`/admin/courses/${courseId}/lessons`, { method: 'POST', body: JSON.stringify(payload) });
      setMsg('تمت إضافة الدرس ✓');
      setShowForm(false);
      loadLessons(courseId);
    } catch (err) { setError(err.message); }
  };

  const remove = async (l) => {
    if (!confirm(`حذف درس "${l.title}"؟`)) return;
    try {
      await api(`/admin/lessons/${l.id}`, { method: 'DELETE' });
      loadLessons(courseId);
    } catch (err) { setError(err.message); }
  };

  const setQ = (qi, key, value) => {
    setForm((f) => {
      const qs = f.quizQuestions.map((q, i) => (i === qi ? { ...q, [key]: value } : q));
      return { ...f, quizQuestions: qs };
    });
  };

  const setQOption = (qi, oi, value) => {
    setForm((f) => {
      const qs = f.quizQuestions.map((q, i) => {
        if (i !== qi) return q;
        const opts = q.options.map((o, j) => (j === oi ? value : o));
        return { ...q, options: opts };
      });
      return { ...f, quizQuestions: qs };
    });
  };

  const [aiLoading, setAiLoading] = useState(false);
  const aiGenerate = async () => {
    const topic = form.title || (form.content || '').slice(0, 60);
    if (!topic) { setError('اكتب عنوان الدرس أولاً ليولّد منه الأسئلة'); return; }
    setAiLoading(true);
    setError('');
    try {
      const d = await api('/admin/ai/quiz', { method: 'POST', body: JSON.stringify({ topic }) });
      setForm((f) => ({ ...f, quizQuestions: d.questions }));
    } catch (err) { setError(err.message); }
    setAiLoading(false);
  };

  return (
    <AdminLayout>
      <div className="space-between">
        <div>
          <h1 className="page-title">إدارة الدروس</h1>
          <p className="page-sub">أضف وعدّل واحذف دروس كل دورة — بما فيها الاختبارات التفاعلية</p>
        </div>
      </div>
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
          <div className="space-between">
            <h3>{lessons.length} درس</h3>
            <button className="btn" onClick={startAdd}>+ درس جديد</button>
          </div>

          {showForm && (
            <form onSubmit={save} className="card mb">
              <h3 className="mb">درس جديد</h3>
              <div className="row mb">
                <input className="input" placeholder="عنوان الدرس" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={{ flex: 1 }} />
                <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={{ width: 140 }}>
                  <option value="text">نظري</option>
                  <option value="video">فيديو</option>
                  <option value="lab">غرفة تطبيقية</option>
                  <option value="quiz">اختبار</option>
                </select>
              </div>
              {form.type !== 'quiz' && (
                <textarea className="textarea mb" placeholder="محتوى الدرس" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              )}

              {form.type === 'quiz' && (
                <>
                  <button type="button" className="btn btn-secondary btn-sm mb" onClick={aiGenerate} disabled={aiLoading}>
                    ✨ {aiLoading ? 'جارٍ التوليد...' : 'توليد أسئلة بالذكاء الاصطناعي من العنوان'}
                  </button>
                  {form.quizQuestions.map((q, qi) => (
                    <div key={qi} className="card mb" style={{ background: 'var(--bg-2)' }}>
                      <div className="row space-between mb">
                        <strong>سؤال {qi + 1}</strong>
                        <button type="button" className="btn btn-danger btn-sm"
                          onClick={() => setForm((f) => ({ ...f, quizQuestions: f.quizQuestions.filter((_, i) => i !== qi) }))}
                          disabled={form.quizQuestions.length === 1}>حذف</button>
                      </div>
                      <input className="input mb" placeholder="نص السؤال" value={q.question} onChange={(e) => setQ(qi, 'question', e.target.value)} />
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="row mb">
                          <input type="radio" checked={q.correct_index === oi} onChange={() => setQ(qi, 'correct_index', oi)} />
                          <input className="input" placeholder={`الخيار ${oi + 1}`} value={opt} onChange={(e) => setQOption(qi, oi, e.target.value)} style={{ flex: 1 }} />
                          {q.correct_index === oi && <span className="chip chip-green">صحيح</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary btn-sm mb"
                    onClick={() => setForm((f) => ({ ...f, quizQuestions: [...f.quizQuestions, { question: '', options: ['', '', '', ''], correct_index: 0 }] }))}>
                    + سؤال إضافي
                  </button>
                </>
              )}

              <button className="btn btn-success">حفظ الدرس</button>
            </form>
          )}

          <table className="table">
            <thead><tr><th>الترتيب</th><th>العنوان</th><th>النوع</th><th>الأسئلة</th><th>إجراءات</th></tr></thead>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.id}>
                  <td>{l.order_no}</td>
                  <td>{l.title}</td>
                  <td><span className="chip">{l.type === 'quiz' ? 'اختبار' : l.type === 'lab' ? 'تطبيقي' : 'نظري'}</span></td>
                  <td>{l.type === 'quiz' ? l.quizQuestions.length : '—'}</td>
                  <td>
                    <div className="row">
                      <button className="btn btn-secondary btn-sm" onClick={() => startEdit(l)}>تعديل</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(l)}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </AdminLayout>
  );
}
