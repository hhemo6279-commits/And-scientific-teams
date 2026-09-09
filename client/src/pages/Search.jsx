import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!q) { setData({ courses: [], sections: [] }); return; }
    api(`/me/search?q=${encodeURIComponent(q)}`).then(setData).catch(() => {});
  }, [q]);

  return (
    <div className="page">
      <h1 className="page-title">نتائج البحث عن: "{q}"</h1>
      <p className="page-sub">{data ? data.courses.length + data.sections.length : 0} نتيجة</p>

      {data && (
        <>
          <h3 className="mb">📚 الدورات</h3>
          <div className="grid mb">
            {data.courses.map((c) => (
              <Link key={c.id} to={`/course/${c.id}`} style={{ color: 'inherit' }}>
                <div className="card">
                  <h3>{c.title}</h3>
                  <p className="muted mb">{c.description}</p>
                  <span className="chip">{c.section_icon} {c.section_name}</span> <span className="chip">{c.level}</span>
                </div>
              </Link>
            ))}
            {data.courses.length === 0 && <p className="muted">لا توجد دورات مطابقة</p>}
          </div>

          <h3 className="mb">🗂️ الأقسام</h3>
          <div className="grid">
            {data.sections.map((s) => (
              <div key={s.id} className="card" style={{ borderTop: `4px solid ${s.color || '#6c7bff'}` }}>
                <span className="section-icon">{s.icon}</span>
                <h3>{s.name}</h3>
                <p className="muted mb">{s.description}</p>
              </div>
            ))}
            {data.sections.length === 0 && <p className="muted">لا توجد أقسام مطابقة</p>}
          </div>
        </>
      )}
    </div>
  );
}
