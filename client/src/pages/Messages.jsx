import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api, getUser } from '../api.js';

function Chat({ userId, onBack }) {
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const me = getUser();
  const endRef = useRef(null);

  const load = () => api(`/me/conversations/${userId}`).then(setData).catch(() => {});
  useEffect(() => { load(); }, [userId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [data]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await api(`/me/conversations/${userId}`, { method: 'POST', body: JSON.stringify({ content: text }) });
      setText('');
      load();
    } catch {}
  };

  if (!data) return <p className="muted">جارٍ التحميل...</p>;

  return (
    <div className="card chat-card">
      <div className="row space-between" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}>
        <div className="row">
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginLeft: 8 }}>→</button>
          <span className="avatar" style={{ marginLeft: 8 }}>{data.other.avatar || '👤'}</span>
          <strong>{data.other.name}</strong>
        </div>
      </div>

      <div className="chat-scroll">
        {data.messages.map((m) => {
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div className={mine ? 'chat-bubble mine' : 'chat-bubble'}>
                {m.content}
                <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>{m.created_at.slice(11, 16)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="row" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <input className="input" placeholder="اكتب رسالة..." value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} />
        <button className="btn">إرسال</button>
      </form>
    </div>
  );
}

export default function Messages() {
  const { userId } = useParams();
  const [convs, setConvs] = useState([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [users, setUsers] = useState([]);

  const load = () => api('/me/conversations').then((d) => { setConvs(d.conversations); setUnreadTotal(d.unreadTotal); }).catch(() => {});
  useEffect(() => { load(); }, []);

  const openNew = async () => {
    setShowNew(true);
    try { const d = await api('/me/users'); setUsers(d.users); } catch {}
  };

  if (userId) return <Chat userId={userId} onBack={() => (window.location.href = '/messages')} />;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="row space-between mb">
        <div>
          <h1 className="page-title">💬 الرسائل</h1>
          <p className="page-sub">محادثاتك الخاصة</p>
        </div>
        <button className="btn" onClick={openNew}>+ محادثة جديدة</button>
      </div>

      {unreadTotal > 0 && <div className="success-msg mb">لديك {unreadTotal} رسالة غير مقروءة</div>}

      {showNew && (
        <div className="card mb">
          <h3 className="mb">بدء محادثة مع:</h3>
          <div className="grid">
            {users.map((u) => (
              <button key={u.id} className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}
                onClick={() => (window.location.href = `/messages/${u.id}`)}>
                {u.avatar || '👤'} {u.name} {u.role !== 'student' && <span className="chip">أدمن</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {convs.map((c) => (
        <a key={c.other_id} href={`/messages/${c.other_id}`} className="card mb conv-item" style={{ textDecoration: 'none' }}>
          <div className="row space-between">
            <div className="row">
              <span className="avatar" style={{ marginLeft: 10 }}>{c.other_avatar || '👤'}</span>
              <div>
                <strong>{c.other_name}</strong>
                <div className="muted" style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.last_message}</div>
              </div>
            </div>
            <div className="row">
              {c.unread > 0 && <span className="chip chip-red">{c.unread} جديد</span>}
              <span className="muted">{c.last_at?.slice(11, 16) || ''}</span>
            </div>
          </div>
        </a>
      ))}

      {convs.length === 0 && <p className="muted">لا توجد محادثات بعد. ابدأ محادثة جديدة!</p>}
    </div>
  );
}
