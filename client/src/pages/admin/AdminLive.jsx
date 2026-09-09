import React, { useEffect, useState } from 'react';
import { AdminLayout } from './AdminLayout.jsx';
import { api } from '../../api.js';

export default function AdminLive() {
  const [rooms, setRooms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ course_id: '', title: '', scheduled_at: '' });
  const [attendance, setAttendance] = useState(null);

  const load = () => {
    api('/live').then((d) => setRooms(d.rooms)).catch((e) => setError(e.message));
    api('/admin/courses').then((d) => setCourses(d.courses)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const showAttendance = async (r) => {
    try {
      const d = await api(`/admin/live/${r.id}/attendance`);
      setAttendance({ room: r, ...d });
    } catch (err) { setError(err.message); }
  };

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/live', { method: 'POST', body: JSON.stringify(form) });
      setMsg('تم إنشاء قاعة البث ✓');
      setShowForm(false);
      setForm({ course_id: '', title: '', scheduled_at: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const setStatus = async (r, status) => {
    try {
      await api(`/live/${r.id}`, { method: 'PUT', body: JSON.stringify({ status }) });
      load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (r) => {
    if (!confirm(`حذف قاعة "${r.title}"؟`)) return;
    try {
      await api(`/live/${r.id}`, { method: 'DELETE' });
      load();
    } catch (err) { setError(err.message); }
  };

  const statusLabel = (s) =>
    s === 'live' ? <span className="chip chip-red">مباشر</span> : s === 'scheduled' ? <span className="chip chip-gold">مجدول</span> : <span className="chip">انتهى</span>;

  return (
    <AdminLayout>
      <div className="space-between">
        <div>
          <h1 className="page-title">قاعات البث المباشر</h1>
          <p className="page-sub">إنشاء وإدارة قاعات تتسع حتى 3000 مشاهد</p>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>{showForm ? 'إغلاق' : '+ قاعة جديدة'}</button>
      </div>
      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg mb">{msg}</div>}

      {showForm && (
        <form onSubmit={create} className="card mb">
          <div className="row mb">
            <input className="input" placeholder="عنوان الجلسة" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required style={{ flex: 1 }} />
            <select className="select" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} style={{ width: 220 }}>
              <option value="">بدون دورة</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <input className="input" type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} style={{ width: 220 }} />
          </div>
          <button className="btn btn-success">إنشاء القاعة</button>
        </form>
      )}

      <table className="table">
        <thead><tr><th>العنوان</th><th>الدورة</th><th>المضيف</th><th>المشاهدون</th><th>الحالة</th><th>إجراءات</th></tr></thead>
        <tbody>
          {rooms.map((r) => (
            <tr key={r.id}>
              <td>{r.title}</td>
              <td className="muted">{r.course_title || '—'}</td>
              <td>{r.host_name || '—'}</td>
              <td>{r.participant_count}</td>
              <td>{statusLabel(r.status)}</td>
              <td>
                <div className="row">
                  {r.status === 'scheduled' && <button className="btn btn-sm" onClick={() => setStatus(r, 'live')}>بدء البث</button>}
                  {r.status === 'live' && <button className="btn btn-danger btn-sm" onClick={() => setStatus(r, 'ended')}>إنهاء</button>}
                  <button className="btn btn-secondary btn-sm" onClick={() => showAttendance(r)}>الحضور</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => remove(r)}>حذف</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {attendance && (
        <div className="card mt">
          <div className="row space-between" style={{ marginBottom: 12 }}>
            <h3>📋 سجل حضور: {attendance.room.title}</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setAttendance(null)}>إغلاق</button>
          </div>
          <p className="muted mb">إجمالي الحضور: <strong>{attendance.count}</strong></p>
          <table className="table">
            <thead><tr><th>الطالب</th><th>القسم</th><th>وقت الدخول</th></tr></thead>
            <tbody>
              {attendance.attendees.map((a, i) => (
                <tr key={i}>
                  <td>{a.user_name}</td>
                  <td className="muted">{a.section_name || '—'}</td>
                  <td>{a.joined_at}</td>
                </tr>
              ))}
              {attendance.attendees.length === 0 && <tr><td colSpan="3" className="muted">لم يسجل أي حضور بعد</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
