import React, { useEffect, useState } from 'react';
import { api, getUser } from '../api.js';

export default function InstructorDashboard() {
  const user = getUser();
  const [dashboard, setDashboard] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [notes, setNotes] = useState({});
  const [annForm, setAnnForm] = useState({ title: '', content: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadCourses = () => {
    api('/instructor/courses').then((d) => setCourses(d.courses)).catch((e) => setError(e.message));
    api('/instructor/dashboard').then(setDashboard).catch(() => {});
  };
  useEffect(() => { loadCourses(); }, []);

  const selectCourse = async (c) => {
    setSelected(c);
    try {
      const d = await api(`/instructor/courses/${c.id}/students`);
      setStudents(d.students);
      const g = {};
      const n = {};
      d.students.forEach((s) => { g[s.id] = s.score ?? ''; n[s.id] = s.note || ''; });
      setGrades(g);
      setNotes(n);
    } catch (e) { setError(e.message); }
  };

  const saveGrade = async (s) => {
    try {
      await api(`/instructor/courses/${selected.id}/grades/${s.id}`, {
        method: 'PUT',
        body: JSON.stringify({ score: Number(grades[s.id]), note: notes[s.id] }),
      });
      setMsg(`حُفظت درجة ${s.name} ✓`);
    } catch (e) { setError(e.message); }
  };

  const announce = async (e) => {
    e.preventDefault();
    try {
      const d = await api(`/instructor/courses/${selected.id}/announce`, { method: 'POST', body: JSON.stringify(annForm) });
      setMsg(`أُرسل الإعلان إلى ${d.studentsNotified} طالب ✓`);
      setAnnForm({ title: '', content: '' });
    } catch (err) { setError(err.message); }
  };

  if (!dashboard) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  return (
    <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 className="page-title">👨‍🏫 لوحة المحاضر</h1>
      <p className="page-sub">مرحباً {dashboard.profile.name} {dashboard.profile.level.icon} {dashboard.profile.level.title}</p>
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg mb">{msg}</div>}

      <div className="stats-grid mb">
        <div className="stat-card"><div className="stat-value">{dashboard.coursesCount}</div><div className="stat-label">دورات أدرّسها</div></div>
        <div className="stat-card"><div className="stat-value">{dashboard.totalStudents}</div><div className="stat-label">إجمالي الطلاب</div></div>
        <div className="stat-card"><div className="stat-value">{dashboard.profile.points}</div><div className="stat-label">XP</div></div>
      </div>

      <h3 className="mb">دوراتي</h3>
      <div className="grid mb">
        {courses.map((c) => (
          <button key={c.id} className="card report-card" onClick={() => selectCourse(c)} style={{ textAlign: 'right' }}>
            <h3 className="mb">{c.title}</h3>
            <div className="row" style={{ gap: 6 }}>
              <span className="chip">{c.section_name}</span>
              <span className="chip chip-gold">{c.students_count} طالب</span>
            </div>
          </button>
        ))}
        {courses.length === 0 && <p className="muted">لا توجد دورات مسندة إليك بعد.</p>}
      </div>

      {selected && (
        <>
          <h2 className="mb mt">📋 طلاب: {selected.title}</h2>
          <table className="table mb">
            <thead><tr><th>الطالب</th><th>التقدم</th><th>الدرجة (من 100)</th><th>ملاحظات</th><th>حفظ</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="avatar">{s.avatar || '👤'}</span> {s.name}
                    <div className="muted" style={{ fontSize: 11 }}>{s.email} · {s.points} XP</div>
                  </td>
                  <td><span className={s.completed ? 'chip chip-green' : 'chip'}>{s.progress}%</span></td>
                  <td style={{ width: 120 }}>
                    <input className="input" type="number" min="0" max="100" dir="ltr"
                      value={grades[s.id]} onChange={(e) => setGrades((x) => ({ ...x, [s.id]: e.target.value }))} />
                  </td>
                  <td><input className="input" placeholder="ملاحظة..." value={notes[s.id]} onChange={(e) => setNotes((x) => ({ ...x, [s.id]: e.target.value }))} /></td>
                  <td><button className="btn btn-sm" onClick={() => saveGrade(s)}>حفظ</button></td>
                </tr>
              ))}
              {students.length === 0 && <tr><td colSpan="5" className="muted">لا يوجد طلاب مسجلون بعد</td></tr>}
            </tbody>
          </table>

          <div className="card">
            <h3 className="mb">📢 إعلان لطلاب {selected.title}</h3>
            <form onSubmit={announce}>
              <input className="input mb" placeholder="عنوان الإعلان" value={annForm.title} onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })} />
              <textarea className="textarea mb" placeholder="محتوى الإعلان..." value={annForm.content} onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })} />
              <button className="btn btn-success">إرسال كإشعار للطلاب</button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
