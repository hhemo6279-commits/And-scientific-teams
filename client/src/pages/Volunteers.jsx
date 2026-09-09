import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const TYPE_META = {
  campaign: { icon: '📢', label: 'حملة' },
  initiative: { icon: '💡', label: 'مبادرة' },
  activity: { icon: '🎉', label: 'نشاط' },
  relief: { icon: '🤝', label: 'إغاثة' },
};

const STATUS_META = {
  upcoming: { label: 'قادمة', cls: 'chip-blue' },
  open: { label: 'مفتوحة للمشاركة', cls: 'chip-green' },
  ended: { label: 'انتهت', cls: 'chip' },
};

const APP_LABEL = {
  pending: { label: 'قيد المراجعة', cls: 'chip-gold' },
  approved: { label: 'مقبول ✓', cls: 'chip-green' },
  rejected: { label: 'مرفوض', cls: 'chip-red' },
  withdrawn: { label: 'مسحوب', cls: 'chip' },
  attended: { label: 'حضرت ✓', cls: 'chip-green' },
  completed: { label: 'مكتمل', cls: 'chip' },
};

export default function Volunteers() {
  const [data, setData] = useState(null);
  const [mine, setMine] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const load = () => {
    api('/volunteers').then(setData).catch((e) => setError(e.message));
    api('/volunteers/mine/applications').then(setMine).catch(() => {});
  };
  useEffect(load, []);

  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;
  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  const list = filter === 'all' ? data.programs : data.programs.filter((p) => p.type === filter);

  return (
    <div className="page">
      <div className="card mb" style={{ background: 'linear-gradient(120deg,rgba(52,211,153,.14),rgba(52,211,153,.06))' }}>
        <h1 className="page-title" style={{ marginBottom: 6 }}>🤝 العمل التطوعي</h1>
        <p className="muted" style={{ lineHeight: 1.8 }}>
          ساهم في الحملات والمبادرات التي تنظمها المنصة، وسجّل ساعات تطوعك وشهاداتك في ملفك الشخصي.
          {mine && <strong style={{ display: 'block', marginTop: 6 }}>⏱️ إجمالي ساعاتك: {mine.total_hours} ساعة عبر {mine.activities_done} نشاط</strong>}
        </p>
      </div>

      <div className="row mb" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button className={`btn btn-sm ${filter === 'all' ? '' : 'btn-secondary'}`} onClick={() => setFilter('all')}>الكل</button>
        {Object.entries(TYPE_META).map(([k, v]) => (
          <button key={k} className={`btn btn-sm ${filter === k ? '' : 'btn-secondary'}`} onClick={() => setFilter(k)}>{v.icon} {v.label}</button>
        ))}
      </div>

      {list.length === 0 && <p className="muted">لا توجد برامج تطوعية متاحة حالياً.</p>}

      <div className="grid">
        {list.map((p) => {
          const meta = TYPE_META[p.type] || { icon: '🎉', label: p.type };
          const st = STATUS_META[p.status] || { label: p.status, cls: 'chip' };
          const app = p.my_application ? (APP_LABEL[p.my_application.status] || { label: p.my_application.status, cls: 'chip' }) : null;
          return (
            <Link key={p.id} to={`/volunteers/${p.id}`} style={{ color: 'inherit' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="row space-between" style={{ marginBottom: 6 }}>
                  <span className="chip">{meta.icon} {meta.label}</span>
                  <span className={`chip ${st.cls}`}>{st.label}</span>
                </div>
                <h3 style={{ marginBottom: 4 }}>{p.title}</h3>
                <p className="muted mb" style={{ fontSize: 13 }}>
                  {p.starts_at ? p.starts_at.slice(0, 16).replace('T', ' ') : ''} {p.location ? ` • 📍 ${p.location}` : ''}
                </p>
                <p className="muted mb" style={{ lineHeight: 1.7, flex: 1 }}>{(p.description || '').slice(0, 110)}{(p.description || '').length > 110 ? '...' : ''}</p>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <span className="chip">{p.applicants_count}/{p.spots} متطوع</span>
                  {p.required_skills && <span className="chip">🎯 {p.required_skills}</span>}
                  {app && <span className={`chip ${app.cls}`}>حالتي: {app.label}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {mine && mine.applications.length > 0 && (
        <>
          <h2 className="mb mt">🗂️ سجل تطوعي</h2>
          <div className="card">
            {mine.applications.map((a) => {
              const [label, cls] = [APP_LABEL[a.status]?.label || a.status, APP_LABEL[a.status]?.cls || 'chip'];
              return (
                <div key={a.id} className="row space-between" style={{ padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
                  <div>
                    <Link to={`/volunteers/${a.program_id}`}><strong>{a.title}</strong></Link>
                    <div className="muted" style={{ fontSize: 12 }}>{a.starts_at ? a.starts_at.slice(0, 10) : ''} • {a.skills ? `المهارات: ${a.skills}` : 'بدون مهارات'}</div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    {(a.status === 'attended' || a.status === 'completed') && <span className="chip chip-green">⏱️ {a.hours_logged} ساعة</span>}
                    <span className={`chip ${cls}`}>{label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}