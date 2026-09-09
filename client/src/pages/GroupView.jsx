import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function GroupView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [content, setContent] = useState('');

  const load = () => api(`/groups/${id}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const post = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await api(`/groups/${id}/posts`, { method: 'POST', body: JSON.stringify({ content }) });
      setContent('');
      load();
    } catch (err) { setError(err.message); }
  };

  const leave = async () => {
    if (!confirm('مغادرة المجموعة؟')) return;
    try {
      await api(`/groups/${id}/leave`, { method: 'POST' });
      window.location.href = '/groups';
    } catch (err) { setError(err.message); }
  };

  if (error) return <div className="page"><div className="error-msg">{error}</div><Link to="/groups" className="btn btn-sm mt">↩ المجموعات</Link></div>;
  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  const { group, members, posts } = data;

  return (
    <div className="page" style={{ maxWidth: 820, margin: '0 auto' }}>
      <Link to="/groups" className="btn btn-secondary btn-sm mb">↩ كل المجموعات</Link>
      <div className="card mb">
        <div className="row space-between">
          <div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>👥 {group.name}</h1>
            {group.description && <p className="muted mt">{group.description}</p>}
            <div className="row mt" style={{ gap: 6 }}>
              <span className="chip">👥 {members.length} أعضاء</span>
              <span className="chip chip-gold">{group.owner_name} (المالك)</span>
            </div>
          </div>
          {!group.isOwner && <button className="btn btn-secondary btn-sm" onClick={leave}>مغادرة</button>}
        </div>
      </div>

      <div className="grid-2 mb">
        <div>
          <h3 className="mb">💬 لوحة النقاش</h3>
          <form onSubmit={post} className="card mb">
            <textarea className="textarea mb" placeholder="اكتب منشوراً... سؤال، مورد، فكرة" value={content} onChange={(e) => setContent(e.target.value)} />
            <button className="btn btn-success btn-sm">نشر</button>
          </form>
          {posts.map((p) => (
            <div key={p.id} className="card mb" style={{ background: 'var(--bg-2)' }}>
              <div className="row space-between mb" style={{ marginBottom: 6 }}>
                <strong>{p.user_avatar} {p.user_name}</strong>
                <span className="muted" style={{ fontSize: 11 }}>{p.created_at}</span>
              </div>
              <p style={{ lineHeight: 1.8 }}>{p.content}</p>
            </div>
          ))}
          {posts.length === 0 && <p className="muted">لا توجد منشورات بعد — ابدأ النقاش!</p>}
        </div>

        <div>
          <h3 className="mb">👥 الأعضاء</h3>
          <div className="card">
            {members.map((m) => (
              <div key={m.id} className="row space-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span>
                  <span className="avatar">{m.avatar || '👤'}</span> {m.name}
                  <span className="muted" style={{ fontSize: 11 }}> · {m.points} XP</span>
                </span>
                {m.role === 'owner' ? <span className="chip chip-gold">المالك</span> : <span className="chip">عضو</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
