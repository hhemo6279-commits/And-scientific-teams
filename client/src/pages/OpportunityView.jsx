import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

const TYPE_META = {
  internship: { icon: '💼', label: 'تدريب' },
  job: { icon: '🧑‍💻', label: 'وظيفة' },
  scholarship: { icon: '🎓', label: 'منحة' },
  competition: { icon: '🏆', label: 'مسابقة' },
  program: { icon: '📚', label: 'برنامج' },
};

export default function OpportunityView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');

  const load = () => api(`/opportunities/${id}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const apply = async () => {
    try {
      await api(`/opportunities/${id}/apply`, { method: 'POST', body: JSON.stringify({ note }) });
      setMsg('تم تقديم طلبك بنجاح ✅');
      load();
    } catch (e) { setMsg(e.message); }
  };

  const withdraw = async () => {
    try {
      await api(`/opportunities/${id}/apply`, { method: 'DELETE' });
      setMsg('تم سحب الطلب.');
      load();
    } catch (e) { setMsg(e.message); }
  };

  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;
  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  const { opportunity: o, my_application, profile } = data;
  const meta = TYPE_META[o.type] || { icon: '💼', label: o.type };

  return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto' }}>
      <Link to="/opportunities" className="btn btn-secondary btn-sm mb">↩ كل الفرص</Link>

      <div className="card mb">
        <div className="row space-between">
          <div>
            <div className="row" style={{ gap: 6 }}>
              <span className="chip">{meta.icon} {meta.label}</span>
              {o.active === 1 && <span className="chip chip-green">مفتوحة للتقديم</span>}
            </div>
            <h1 className="page-title" style={{ marginBottom: 6, marginTop: 8 }}>{o.title}</h1>
            {o.organization && <p className="muted">🏢 {o.organization}{o.location ? ` • 📍 ${o.location}` : ''}</p>}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-value">{o.fit ?? Math.min(100, profile.score)}</div>
            <div className="stat-label">توافقك %</div>
          </div>
        </div>

        <p className="mt" style={{ lineHeight: 1.9 }}>{o.description}</p>

        <div className="row mt" style={{ gap: 6, flexWrap: 'wrap' }}>
          {o.deadline && <span className="chip">📅 آخر موعد: {o.deadline.slice(0, 10)}</span>}
          <span className="chip">👥 {o.applicants_count} متقدم</span>
          <span className="chip">🪑 {o.accepted_count}/{o.spots} مقاعد</span>
        </div>

        {o.eligibility && (
          <div className="card mt" style={{ background: 'rgba(108,123,255,0.08)' }}>
            <strong className="mb">✅ شروط الأهلية</strong>
            <p className="muted mt" style={{ lineHeight: 1.8, marginTop: 6 }}>{o.eligibility}</p>
          </div>
        )}

        <div className="card mt" style={{ background: 'rgba(39,174,96,.06)' }}>
          <div className="row space-between mb">
            <strong>ملف مهاراتك</strong>
            <span className="chip chip-gold">توافق {o.fit ?? profile.score}%</span>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="chip">📚 {profile.coursesDone} دورات مكتملة</span>
            <span className="chip">🏆 {profile.challenges} تحديات محلولة</span>
            <span className="chip">🎓 {profile.certs} شهادات</span>
          </div>
        </div>

        <div className="mt">
          {!my_application ? (
            <div className="card" style={{ background: 'rgba(108,123,255,0.06)' }}>
              <label className="label">رسالة للمراجعة (اختياري)</label>
              <textarea className="input mb" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="لماذا تريد الانضمام؟" />
              <button className="btn btn-success" onClick={apply}>تقديم الطلب</button>
            </div>
          ) : (
            <div className={`card ${my_application.status === 'accepted' ? 'chip-green-bg' : my_application.status === 'rejected' ? 'chip-red-bg' : ''}`}>
              <div className="row space-between">
                <div>
                  <strong>
                    {my_application.status === 'accepted' ? '🎉 تم قبولك في هذه الفرصة' : my_application.status === 'rejected' ? 'لم يُقبل طلبك' : '⏳ طلبك قيد المراجعة'}
                  </strong>
                  <div className="muted mt" style={{ fontSize: 12 }}>قُدّم في: {my_application.created_at}</div>
                </div>
                {my_application.status === 'pending' && (
                  <button className="btn btn-secondary btn-sm" onClick={withdraw}>سحب الطلب</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {msg && <div className="success-msg mb">{msg}</div>}
    </div>
  );
}