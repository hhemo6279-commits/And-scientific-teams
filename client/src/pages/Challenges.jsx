import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Challenges() {
  const [challenges, setChallenges] = useState([]);
  const [flag, setFlag] = useState({});
  const [msg, setMsg] = useState('');
  const [points, setPoints] = useState(0);

  useEffect(() => {
    api('/challenges').then((d) => {
      setChallenges(d.challenges);
      setPoints(d.challenges.filter((c) => c.solved).reduce((s, c) => s + c.points, 0));
    }).catch((e) => setMsg(e.message));
  }, []);

  const submit = async (ch) => {
    try {
      const d = await api(`/challenges/${ch.id}/submit`, { method: 'POST', body: JSON.stringify({ flag: flag[ch.id] }) });
      setMsg(d.message);
      if (d.ok) {
        setChallenges((list) => list.map((c) => (c.id === ch.id ? { ...c, solved: true } : c)));
        setPoints((p) => p + d.points);
      }
    } catch (e) {
      setMsg(e.message);
    }
  };

  const diff = (d) =>
    d === 'سهل' ? <span className="chip chip-green">{d}</span> : d === 'متوسط' ? <span className="chip chip-gold">{d}</span> : <span className="chip chip-red">{d}</span>;

  return (
    <div className="page">
      <div className="space-between">
        <div>
          <h1 className="page-title">🏆 التحديات العملية</h1>
          <p className="page-sub">حل التحديات واجمع النقاط وارتقِ في قائمة الترتيب</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="stat-value">{points}</div>
          <div className="stat-label">نقطتك</div>
        </div>
      </div>

      {msg && <div className="success-msg mb">{msg}</div>}

      <div className="grid">
        {challenges.map((c) => (
          <div key={c.id} className="card">
            <div className="space-between">
              <h3>{c.title}</h3>
              {c.solved ? <span className="chip chip-green">تم الحل ✓</span> : diff(c.difficulty)}
            </div>
            <p className="muted mb">{c.description}</p>
            <div className="row space-between mb">
              <span className="chip">{c.section_name}</span>
              <span className="chip chip-gold">+{c.points} نقطة</span>
            </div>
            {!c.solved && (
              <div className="row">
                <input className="input" placeholder="أدخل العلم (Flag)" value={flag[c.id] || ''}
                  onChange={(e) => setFlag((f) => ({ ...f, [c.id]: e.target.value }))} style={{ flex: 1 }} />
                <button className="btn btn-sm" onClick={() => submit(c)}>تحقق</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
