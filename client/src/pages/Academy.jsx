import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Academy() {
  const [tracks, setTracks] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/academy').then((d) => setTracks(d.tracks)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page">
      <div className="card mb" style={{ background: 'linear-gradient(120deg,rgba(108,123,255,.15),rgba(159,108,255,.15))' }}>
        <h1 className="page-title" style={{ marginBottom: 6 }}>🛡️ الأكاديمية الوطنية</h1>
        <p className="muted" style={{ lineHeight: 1.8 }}>
          مسارات تدريبية متسلسلة: كل مرحلة تمرّ بـ <strong>درس → اختبار → معمل → تحدي → امتحان → شهادة</strong>.
          أكمل المرحلة الحالية لفتح المرحلة التالية، واحصل على شهادة موحّدة عند إتمام المسار كاملاً.
        </p>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {tracks.length === 0 && <p className="muted">لا توجد مسارات بعد. ستُضاف قريباً.</p>}

      <div className="grid">
        {tracks.map((t) => {
          const enrolled = t.myProgress;
          return (
            <Link key={t.id} to={`/academy/${t.id}`} className="card" style={{ textDecoration: 'none' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{t.icon}</div>
              <h3>{t.title}</h3>
              <p className="muted mb" style={{ lineHeight: 1.7 }}>{t.description}</p>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <span className="chip">🗺️ {t.stages_count} مراحل</span>
                <span className="chip chip-gold">🎓 {t.students_count} طالب</span>
                {enrolled && (enrolled.completed ? <span className="chip chip-green">مكتمل ✓</span> : <span className="chip">{enrolled.progress}%</span>)}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}