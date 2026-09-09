import React, { useEffect, useState } from 'react';
import { api, getUser } from '../api.js';

export default function Leaderboard() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const user = getUser();

  useEffect(() => {
    api('/me/leaderboard').then((d) => setRows(d.leaderboard)).catch((e) => setError(e.message));
  }, []);

  const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`);

  return (
    <div className="page">
      <h1 className="page-title">🏆 قائمة الترتيب</h1>
      <p className="page-sub">اكسب XP بحل التحديات وإكمال الدورات وحضور البث المباشر وترقَّ في المستويات</p>
      {error && <div className="error-msg">{error}</div>}

      <table className="table">
        <thead><tr><th>المركز</th><th>الطالب</th><th>المستوى</th><th>XP</th><th>دورات مكتملة</th><th>تحديات</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={user && r.id === user.id ? { background: 'rgba(108,123,255,0.12)' } : {}}>
              <td style={{ fontSize: 18 }}>{medal(r.rank)}</td>
              <td>
                <span className="avatar">{r.avatar || '🎓'}</span>{' '}
                {r.name} {user && r.id === user.id && <span className="chip">أنت</span>}
              </td>
              <td><span className="chip">{r.level.icon} {r.level.title}</span></td>
              <td><strong style={{ color: '#f5c86e' }}>{r.points}</strong></td>
              <td>{r.courses_done}</td>
              <td>{r.challenges_solved}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan="6" className="muted" style={{ textAlign: 'center' }}>لا يوجد طلاب بعد</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
