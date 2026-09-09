import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from './AdminLayout.jsx';
import { api } from '../../api.js';

export default function StudentTracking() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/admin/users/${id}/tracking`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <AdminLayout><div className="error-msg">{error}</div></AdminLayout>;
  if (!data) return <AdminLayout><p className="muted">جارٍ التحميل...</p></AdminLayout>;

  const { student, enrollments, quizResults, attendance, solvedChallenges, reviews, stats } = data;

  return (
    <AdminLayout>
      <Link to="/admin/users" className="btn btn-secondary btn-sm mb">↩ رجوع</Link>
      <div className="card mb">
        <div className="row space-between">
          <div className="row">
            <span className="avatar" style={{ width: 56, height: 56, fontSize: 30 }}>{student.avatar || '🎓'}</span>
            <div>
              <h1 className="page-title" style={{ marginBottom: 0 }}>{student.name}</h1>
              <p className="muted">{student.email}</p>
              {student.section && <span className="chip" style={{ marginTop: 6 }}>{student.section.icon} قسم {student.section.name}</span>}{' '}
              <span className="chip">{student.active ? <span className="chip-green">مفعل</span> : <span className="chip-red">معطل</span>}</span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-value">{student.points}</div>
            <div className="stat-label">XP</div>
          </div>
        </div>
        <div className="mt" style={{ background: 'rgba(108,123,255,0.12)', borderRadius: 12, padding: 14 }}>
          <div className="row space-between" style={{ marginBottom: 8 }}>
            <strong>{student.level.icon} المستوى {student.level.level}: {student.level.title}</strong>
            <span className="chip chip-gold">{student.level.progress}% للتالي</span>
          </div>
          <div style={{ background: '#0e1024', borderRadius: 8, height: 10, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#6c7bff,#9f6cff)', height: '100%', width: student.level.progress + '%' }} />
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{stats.coursesDone}</div><div className="stat-label">دورات مكتملة</div></div>
        <div className="stat-card"><div className="stat-value">{stats.averageQuiz !== null ? stats.averageQuiz + '%' : '—'}</div><div className="stat-label">متوسط الاختبارات</div></div>
        <div className="stat-card"><div className="stat-value">{stats.attendanceCount}</div><div className="stat-label">حضور بث</div></div>
        <div className="stat-card"><div className="stat-value">{stats.challengesSolved}</div><div className="stat-label">تحديات محلولة</div></div>
      </div>

      <h2 className="mb mt">📚 الدورات المسجل بها</h2>
      {enrollments.length === 0 && <p className="muted">لم يسجل في أي دورة</p>}
      <table className="table mb">
        <thead><tr><th>الدورة</th><th>القسم</th><th>التقدم</th><th>الحالة</th><th>تاريخ التسجيل</th></tr></thead>
        <tbody>
          {enrollments.map((e) => (
            <tr key={e.id}>
              <td>{e.course_title}</td>
              <td className="muted">{e.section_icon} {e.section_name}</td>
              <td>
                <div style={{ background: '#0e1024', borderRadius: 6, height: 8, width: 120, overflow: 'hidden' }}>
                  <div style={{ background: '#6c7bff', height: '100%', width: e.progress + '%' }} />
                </div>
                <span className="muted" style={{ fontSize: 11 }}>{e.progress}%</span>
              </td>
              <td>{e.completed ? <span className="chip chip-green">مكتمل ✓</span> : <span className="chip">قيد التقدم</span>}</td>
              <td className="muted">{e.enrolled_at}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid-2">
        <div className="card">
          <h3 className="mb">📝 نتائج الاختبارات</h3>
          {quizResults.length === 0 && <p className="muted">لا توجد نتائج</p>}
          {quizResults.map((q, i) => (
            <div key={i} className="chat-msg">
              <strong>{q.lesson_title}</strong> ({q.course_title})
              <div className="row space-between">
                <span className={q.passed ? 'chip chip-green' : 'chip chip-red'}>{q.score}/{q.total}</span>
                <span className="muted">{q.created_at}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="mb">🎥 حضور البث المباشر</h3>
          {attendance.length === 0 && <p className="muted">لم يحضر أي بث</p>}
          {attendance.map((a, i) => (
            <div key={i} className="chat-msg">
              <strong>{a.room_title}</strong>
              <div className="muted">{a.joined_at}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 className="mb">🏆 التحديات المحلولة</h3>
          {solvedChallenges.length === 0 && <p className="muted">لا توجد تحديات محلولة</p>}
          {solvedChallenges.map((s, i) => (
            <div key={i} className="chat-msg">
              <strong>{s.title}</strong>
              <span className="chip chip-gold">+{s.points}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="mb">⭐ التقييمات التي كتبها</h3>
          {reviews.length === 0 && <p className="muted">لا توجد تقييمات</p>}
          {reviews.map((r, i) => (
            <div key={i} className="chat-msg">
              <strong>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</strong> {r.course_title}
              <div className="muted">{r.comment || 'بدون تعليق'}</div>
            </div>
          ))}
        </div>
      </div>

      {data.messages.length > 0 && (
        <div className="card mt">
          <h3 className="mb">💬 آخر المحادثات</h3>
          {data.messages.map((m, i) => (
            <div key={i} className="chat-msg">
              <strong>{m.other_name}:</strong> {m.content}
              <span className="muted" style={{ fontSize: 11, marginRight: 6 }}>{m.created_at}</span>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
