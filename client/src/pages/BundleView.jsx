import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function BundleView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [progress, setProgress] = useState(null);

  const refreshProgress = async () => {
    try { setProgress(await api(`/bundles/${id}/my-progress`)); } catch {}
  };

  const load = () => {
    api(`/bundles/${id}`).then((d) => {
      setData(d);
      if (d.enrolled) refreshProgress();
    }).catch((e) => setError(e.message));
  };
  useEffect(() => { load(); }, [id]);

  const enroll = async () => {
    try {
      await api(`/bundles/${id}/enroll`, { method: 'POST' });
      load();
      refreshProgress();
    } catch (e) { setMsg(e.message); }
  };

  const getCert = async () => {
    try {
      const d = await api(`/bundles/${id}/certificate`, { method: 'POST' });
      setMsg(`🎓 شهادة الحقيبة: ${d.certificate.code}`);
    } catch (e) { setMsg(e.message); }
  };

  if (error) return <div className="page"><div className="error-msg">{error}</div></div>;
  if (!data) return <div className="page"><p className="muted">جارٍ التحميل...</p></div>;

  const { bundle, courses } = data;
  const doneCount = progress ? progress.doneCount : 0;
  const pct = progress ? progress.progress : 0;

  return (
    <div className="page" style={{ maxWidth: 820, margin: '0 auto' }}>
      <Link to="/bundles" className="btn btn-secondary btn-sm mb">↩ كل الحقائب</Link>
      <div className="card mb">
        <div className="row space-between">
          <div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>{bundle.icon} {bundle.title}</h1>
            <p className="muted mt">{bundle.description}</p>
          </div>
          <span className="chip chip-gold">{courses.length} دورات</span>
        </div>
      </div>

      {data.enrolled ? (
        <div className="card mb" style={{ background: 'rgba(108,123,255,0.08)' }}>
          <div className="row space-between mb" style={{ marginBottom: 8 }}>
            <strong>تقدمك في المسار</strong>
            <span className="chip chip-gold">{doneCount}/{courses.length} دورات مكتملة</span>
          </div>
          <div style={{ background: '#0e1024', borderRadius: 8, height: 12, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#6c7bff,#9f6cff)', height: '100%', width: pct + '%' }} />
          </div>
          <div className="muted mt" style={{ marginTop: 6 }}>{pct}%</div>
          {pct === 100 && <button className="btn btn-success mt" onClick={getCert}>🎓 الحصول على شهادة الحقيبة</button>}
        </div>
      ) : (
        <button className="btn mb" onClick={enroll}>التسجيل في الحقيبة</button>
      )}

      {msg && <div className="success-msg mb">{msg}</div>}

      <h3 className="mb">دورات الحقيبة</h3>
      <div className="grid">
        {courses.map((c, i) => (
          <div key={c.id} className="card">
            <div className="row space-between" style={{ marginBottom: 6 }}>
              <span className="chip">{i + 1}</span>
              <span className="chip chip-green">{c.section_name}</span>
            </div>
            <h3 style={{ marginBottom: 4 }}>{c.title}</h3>
            <p className="muted mb">{c.description}</p>
            <div className="row">
              {c.isEnrolled ? <Link to={`/course/${c.id}`} className="btn btn-sm">فتح الدورة</Link> : <Link to={`/course/${c.id}`} className="btn btn-secondary btn-sm">تصفح</Link>}
              <span className="chip">{c.level}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
