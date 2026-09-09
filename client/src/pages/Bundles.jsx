import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Bundles() {
  const [bundles, setBundles] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/bundles').then((d) => setBundles(d.bundles)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page">
      <h1 className="page-title">📦 الحقائب التدريبية</h1>
      <p className="page-sub">مسارات تعلم متكاملة تجمع عدة دورات للحصول على شهادة واحدة متخصصة</p>
      {error && <div className="error-msg">{error}</div>}

      {bundles.length === 0 && <p className="muted">لا توجد حقائب تدريبية بعد.</p>}
      <div className="grid">
        {bundles.map((b) => (
          <Link key={b.id} to={`/bundles/${b.id}`} className="card" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{b.icon}</div>
            <h3>{b.title}</h3>
            <p className="muted mb" style={{ lineHeight: 1.7 }}>{b.description}</p>
            <div className="row" style={{ gap: 6 }}>
              <span className="chip">📚 {b.courses_count} دورات</span>
              <span className="chip chip-gold">🎓 {b.students_count} طالب</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
