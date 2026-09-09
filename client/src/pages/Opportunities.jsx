import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const TYPE_META = {
  internship: { icon: '💼', label: 'تدريب' },
  job: { icon: '🧑‍💻', label: 'وظيفة' },
  scholarship: { icon: '🎓', label: 'منحة' },
  competition: { icon: '🏆', label: 'مسابقة' },
  program: { icon: '📚', label: 'برنامج' },
};

export default function Opportunities() {
  const [data, setData] = useState(null);
  const [apps, setApps] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('all');

  const load = () => {
    api('/opportunities').then(setData).catch((e) => setError(e.message));
    api('/opportunities/mine/applications').then((d) => setApps(d.applications)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const apply = async (id) => {
    try {
      await api(`/opportunities/${id}/apply`, { method: 'POST' });
      setMsg('تم تقديم طلبك بنجاح ✅');
      load();
    } catch (e) { setMsg(e.message); }
  };

  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;
  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  const list = filter === 'all' ? data.opportunities : data.opportunities.filter((o) => o.type === filter);

  return (
    <div className="page">
      <div className="card mb" style={{ background: 'linear-gradient(120deg,rgba(39,174,96,.12),rgba(108,123,255,.12))' }}>
        <div className="row space-between">
          <div>
            <h1 className="page-title" style={{ marginBottom: 6 }}>💼 الفرص</h1>
            <p className="muted" style={{ lineHeight: 1.8 }}>
              تدريب، وظائف، منح، مسابقات وبرامج. نظام التطابق يقيس توافقك مع كل فرصة حسب
              دوراتك المكتملة وتحدياتك وشهاداتك.
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-value">{data.profile.score}</div>
            <div className="stat-label">توافقك العام %</div>
          </div>
        </div>
      </div>

      {msg && <div className="success-msg mb">{msg}</div>}

      <div className="row mb" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${filter === 'all' ? '' : 'btn-secondary'}`} onClick={() => setFilter('all')}>الكل</button>
        {Object.entries(TYPE_META).map(([k, v]) => (
          <button key={k} className={`btn btn-sm ${filter === k ? '' : 'btn-secondary'}`} onClick={() => setFilter(k)}>{v.icon} {v.label}</button>
        ))}
      </div>

      {list.length === 0 && <p className="muted">لا توجد فرص متاحة حالياً.</p>}

      <div className="grid">
        {list.map((o) => {
          const meta = TYPE_META[o.type] || { icon: '💼', label: o.type };
          const app = o.my_application;
          return (
            <div key={o.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="row space-between" style={{ marginBottom: 6 }}>
                <span className="chip">{meta.icon} {meta.label}</span>
                <span className="chip chip-gold">توافق {o.fit}%</span>
              </div>
              <h3 style={{ marginBottom: 4 }}>{o.title}</h3>
              {o.organization && <p className="muted mb" style={{ fontSize: 13 }}>🏢 {o.organization}{o.location ? ` • 📍 ${o.location}` : ''}</p>}
              <p className="muted mb" style={{ lineHeight: 1.7, flex: 1 }}>{(o.description || '').slice(0, 140)}{(o.description || '').length > 140 ? '...' : ''}</p>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <span className="chip">{o.applicants_count} متقدم</span>
                {o.deadline && <span className="chip">الموعد: {o.deadline.slice(0, 10)}</span>}
              </div>
              <div className="row mt" style={{ gap: 8 }}>
                <Link to={`/opportunities/${o.id}`} className="btn btn-sm">التفاصيل</Link>
                {!app && <button className="btn btn-success btn-sm" onClick={() => apply(o.id)}>تقديم طلب</button>}
                {app && <span className="chip chip-green">تم التقديم ✓</span>}
              </div>
            </div>
          );
        })}
      </div>

      {apps.length > 0 && (
        <>
          <h2 className="mb mt">📋 طلباتي</h2>
          <div className="card">
            {apps.map((a) => (
              <div key={a.id} className="row space-between" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
                <div>
                  <Link to={`/opportunities/${a.opportunity_id}`}><strong>{a.title}</strong></Link>
                  <div className="muted" style={{ fontSize: 12 }}>{a.organization} • {a.created_at}</div>
                </div>
                <span className={`chip ${a.status === 'accepted' ? 'chip-green' : a.status === 'rejected' ? 'chip-red' : 'chip-gold'}`}>
                  {a.status === 'accepted' ? 'مقبول ✓' : a.status === 'rejected' ? 'مرفوض ✗' : 'قيد المراجعة'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}