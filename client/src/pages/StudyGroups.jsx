import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function StudyGroups() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const load = () => api('/groups').then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api('/groups', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      setForm({ name: '', description: '' });
      load();
    } catch (err) { setError(err.message); }
  };

  const join = async (g) => {
    try {
      await api(`/groups/${g.id}/join`, { method: 'POST' });
      load();
    } catch (err) { setError(err.message); }
  };

  const leave = async (g) => {
    if (!confirm(`مغادرة "${g.name}"؟`)) return;
    try {
      await api(`/groups/${g.id}/leave`, { method: 'POST' });
      load();
    } catch (err) { setError(err.message); }
  };

  const GroupCard = ({ g, isMember }) => (
    <div className="card">
      <div className="row space-between" style={{ marginBottom: 6 }}>
        <h3 style={{ marginBottom: 0 }}>{g.name}</h3>
        {g.is_member > 0 && <span className="chip chip-green">عضو</span>}
      </div>
      {g.description && <p className="muted mb">{g.description}</p>}
      <div className="row mb" style={{ gap: 6 }}>
        <span className="chip">👥 {g.members_count}</span>
        <span className="chip">💬 {g.posts_count}</span>
        <span className="chip">{g.owner_avatar} {g.owner_name}</span>
      </div>
      <div className="row">
        {isMember ? (
          <>
            <Link to={`/groups/${g.id}`} className="btn btn-sm">فتح المجموعة</Link>
            <button className="btn btn-secondary btn-sm" onClick={() => leave(g)}>مغادرة</button>
          </>
        ) : (
          <button className="btn btn-sm" onClick={() => join(g)}>انضمام</button>
        )}
      </div>
    </div>
  );

  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  return (
    <div className="page" style={{ maxWidth: 820, margin: '0 auto' }}>
      <div className="row space-between mb">
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>👥 المجموعات الدراسية</h1>
          <p className="page-sub">أنشئ مجموعات وتبادلوا الأسئلة والموارد مع زملائك</p>
        </div>
        <button className="btn" onClick={() => setShowForm((v) => !v)}>{showForm ? 'إغلاق' : '+ مجموعة جديدة'}</button>
      </div>
      {error && <div className="error-msg">{error}</div>}

      {showForm && (
        <form onSubmit={create} className="card mb">
          <h3 className="mb">مجموعة جديدة</h3>
          <input className="input mb" placeholder="اسم المجموعة" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <textarea className="textarea mb" placeholder="وصف المجموعة..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="btn btn-success">إنشاء المجموعة</button>
        </form>
      )}

      <h3 className="mb">مجموعاتي</h3>
      <div className="grid mb">
        {data.myGroups.map((g) => <GroupCard key={g.id} g={g} isMember />)}
        {data.myGroups.length === 0 && <p className="muted">لم تنضم لأي مجموعة بعد.</p>}
      </div>

      {data.suggested.length > 0 && (
        <>
          <h3 className="mb mt">مجموعات مقترحة من قسمك</h3>
          <div className="grid">
            {data.suggested.map((g) => <GroupCard key={g.id} g={g} isMember={false} />)}
          </div>
        </>
      )}
    </div>
  );
}
