import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

const TYPE_META = {
  campaign: { icon: '📢', label: 'حملة' },
  initiative: { icon: '💡', label: 'مبادرة' },
  activity: { icon: '🎉', label: 'نشاط' },
  relief: { icon: '🤝', label: 'إغاثة' },
};

export default function VolunteerView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [skills, setSkills] = useState('');
  const [hours, setHours] = useState(2);

  const load = () => api(`/volunteers/${id}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const apply = async () => {
    try {
      await api(`/volunteers/${id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ skills, hours_committed: hours }),
      });
      setMsg('أُرسل طلب مشاركتك وسيُراجع من الإدارة 🤝');
      setSkills(''); setHours(2); load();
    } catch (e) { setMsg(e.message); }
  };

  const withdraw = async () => {
    if (!confirm('سحب طلب المشاركة؟')) return;
    await api(`/volunteers/${id}/apply`, { method: 'DELETE' });
    setMsg('تم سحب الطلب.');
    load();
  };

  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;
  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  const { program: p, my_application, applicants_count } = data;
  const meta = TYPE_META[p.type] || { icon: '🎉', label: p.type };
  const full = applicants_count >= p.spots;

  return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto' }}>
      <Link to="/volunteers" className="btn btn-secondary btn-sm mb">↩ كل البرامج التطوعية</Link>

      <div className="card mb">
        <div className="row space-between">
          <div>
            <div className="row" style={{ gap: 6 }}>
              <span className="chip">{meta.icon} {meta.label}</span>
              {p.status === 'open' && <span className="chip chip-green">مفتوحة للمشاركة</span>}
              {p.status === 'ended' && <span className="chip">انتهت</span>}
              {p.status === 'upcoming' && <span className="chip chip-blue">قادمة</span>}
            </div>
            <h1 className="page-title" style={{ marginBottom: 6, marginTop: 8 }}>{p.title}</h1>
            <p className="muted">
              {p.location && <>📍 <strong>{p.location}</strong>{' • '}</>}
              {p.starts_at ? `من ${p.starts_at.replace('T', ' ').slice(0, 16)}` : ''}
              {p.ends_at ? ` إلى ${p.ends_at.replace('T', ' ').slice(11, 16)}` : ''}
            </p>
          </div>
        </div>

        <div className="row mt" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="chip">👥 {applicants_count}/{p.spots} متطوع</span>
          {p.required_skills && <span className="chip">🎯 المهارات المطلوبة: {p.required_skills}</span>}
        </div>

        <p className="mt" style={{ lineHeight: 1.9 }}>{p.description}</p>

        <div className="card mt" style={{ background: 'rgba(52,211,153,0.07)' }}>
          {p.ended || p.status === 'ended' ? (
            <p className="muted">انتهى هذا البرنامج.</p>
          ) : my_application ? (
            <div>
              <div className="row space-between">
                <strong>
                  {['pending', 'approved', 'attended', 'completed'].includes(my_application.status) ? '🤝 طلبك مسجل' : ''}
                </strong>
                {!['attended', 'completed'].includes(my_application.status) && (
                  <button className="btn btn-secondary btn-sm" onClick={withdraw}>سحب الطلب</button>
                )}
              </div>
              <div className="muted mt">{my_application.skills ? `مهاراتك: ${my_application.skills}` : 'بدون مهارات مسجلة'}</div>
            </div>
          ) : full ? (
            <p className="muted">المقاعد ممتلئة في هذا البرنامج.</p>
          ) : (
            <div>
              <h3 className="mb">أسجل التطوع</h3>
              <input className="input" placeholder="مهاراتك ذات الصلة (اختياري)" value={skills} onChange={(e) => setSkills(e.target.value)} style={{ width: '100%' }} />
              <div className="row mt mb" style={{ alignItems: 'center', gap: 8 }}>
                <label className="muted">ساعات ملتزم بها:</label>
                <input className="input" type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} style={{ width: 90 }} />
              </div>
              <button className="btn btn-success" onClick={apply}>🤝 تقديم المشاركة</button>
            </div>
          )}
        </div>
      </div>

      {msg && <div className="success-msg mb">{msg}</div>}
    </div>
  );
}