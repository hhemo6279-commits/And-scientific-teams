import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, getToken } from '../api.js';

export default function AcademyTrack() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    api(`/academy/${id}`).then(setData).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, [id]);

  const enroll = async () => {
    try {
      await api(`/academy/${id}/enroll`, { method: 'POST' });
      load();
    } catch (e) { setMsg(e.message); }
  };

  const getCert = async () => {
    try {
      const d = await api(`/academy/${id}/certificate`, { method: 'POST' });
      setMsg(`🎓 شهادة الأكاديمية صادرة: ${d.certificate.code}`);
      load();
    } catch (e) { setMsg(e.message); }
  };

  const printCert = async () => {
    try {
      const token = getToken();
      const resp = await fetch(`/api/academy/${id}/certificate/print`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error('خطأ');
      const html = await resp.text();
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
    } catch { setMsg('تعذر فتح الشهادة'); }
  };

  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;
  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  const { track, stages, enrolled, progress, completed, total, doneCount, certificate } = data;

  return (
    <div className="page" style={{ maxWidth: 860, margin: '0 auto' }}>
      <Link to="/academy" className="btn btn-secondary btn-sm mb">↩ كل المسارات</Link>

      <div className="card mb">
        <div className="row space-between">
          <div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>{track.icon} {track.title}</h1>
            <p className="muted mt" style={{ lineHeight: 1.8 }}>{track.description}</p>
          </div>
          <span className="chip chip-gold">{total} مراحل</span>
        </div>
      </div>

      {enrolled ? (
        <div className="card mb" style={{ background: 'rgba(108,123,255,0.08)' }}>
          <div className="row space-between mb" style={{ marginBottom: 8 }}>
            <strong>تقدمك في المسار</strong>
            <span className="chip chip-gold">{doneCount}/{total} مراحل مكتملة</span>
          </div>
          <div style={{ background: '#0e1024', borderRadius: 8, height: 12, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#6c7bff,#9f6cff)', height: '100%', width: progress + '%' }} />
          </div>
          <div className="muted mt" style={{ marginTop: 6 }}>{progress}%</div>
          {completed && !certificate && <button className="btn btn-success mt" onClick={getCert}>🎓 الحصول على شهادة الأكاديمية</button>}
          {certificate && (
            <div className="row mt" style={{ gap: 8 }}>
              <span className="chip chip-green">شهادة صادرة ✓ <span dir="ltr">{certificate.code}</span></span>
              <button className="btn btn-secondary btn-sm" onClick={printCert}>🖨️ طباعة الشهادة</button>
            </div>
          )}
        </div>
      ) : (
        <button className="btn mb" onClick={enroll}>ابدأ المسار 🚀</button>
      )}

      {msg && <div className="success-msg mb">{msg}</div>}

      <h3 className="mb">مراحل المسار</h3>
      <div className="mb" style={{ borderRight: '3px solid var(--border)', marginRight: 6 }}>
        {stages.map((s, i) => (
          <div key={s.id} className="card" style={{ position: 'relative', marginRight: 18, marginBottom: 12 }}>
            <div style={{ position: 'absolute', right: -24, top: 14, fontSize: 18 }}>
              {s.locked ? '🔒' : s.done ? '✅' : '▶️'}
            </div>
            <div className="row space-between" style={{ marginBottom: 6 }}>
              <strong>المرحلة {i + 1}: {s.title}</strong>
              {s.locked ? <span className="chip">مقفلة</span> : s.done ? <span className="chip chip-green">مكتملة ✓</span> : <span className="chip chip-gold">الحالية</span>}
            </div>
            <p className="muted mb" style={{ lineHeight: 1.7 }}>{s.description}</p>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {s.course_id && (
                s.locked ? (
                  <span className="chip">📚 {s.course_title} <span className="muted">(أكمل المرحلة السابقة)</span></span>
                ) : (
                  <Link to={`/course/${s.course_id}`} className="btn btn-sm">{s.courseDone ? 'مراجعة الدورة' : 'ابدأ الدورة'} 📚 {s.course_title}</Link>
                )
              )}
              {s.challenge_id && (
                s.locked ? (
                  <span className="chip">🏆 {s.challenge_title}</span>
                ) : (
                  <Link to="/challenges" className="btn btn-secondary btn-sm">🏆 {s.challenge_title} (+{s.challenge_points} XP)</Link>
                )
              )}
              {!s.course_id && !s.challenge_id && <span className="chip">—</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ background: 'rgba(39,174,96,.06)' }}>
        <h3 className="mb">📜 شهادة المسار</h3>
        <p className="muted mb" style={{ lineHeight: 1.8 }}>
          عند إتمام جميع المراحل تحصل تلقائياً على <strong>شهادة أكاديمية موحّدة</strong> برمز تحقق قابل للتحقق
          من صفحة <Link to="/verify">التحقق العام</Link>.
        </p>
        {!enrolled && <span className="chip">سجّل في المسار لبدء التقدم</span>}
      </div>
    </div>
  );
}