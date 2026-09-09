import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Landing() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/public/home').then(setData).catch((e) => setError(e.message));
  }, []);

  const features = [
    { icon: '📚', title: 'أقسام متنوعة', desc: 'أمن سيبراني، برمجة، طبية، علمية، ثقافية وأكثر' },
    { icon: '🎥', title: 'بث مباشر حي', desc: 'قاعات تتسع حتى 3000 طالب بتفاعل كامل' },
    { icon: '🏆', title: 'تحديات CTF', desc: 'تحديات عملية وجمع نقاط وقوائم ترتيب' },
    { icon: '🎓', title: 'شهادات موثقة', desc: 'شهادة إتمام برمز تحقق لكل دورة مكتملة' },
    { icon: '🛡️', title: 'محاكيات معزولة', desc: 'غرف تطبيقية آمنة لكل طالب بنمط TryHackMe' },
    { icon: '👥', title: 'مجتمع تفاعلي', desc: 'أسئلة وأجوبة، فرق هاكاثون، وإنجازات' },
  ];

  return (
    <div>
      {/* البطل */}
      <div className="landing-hero">
        <div className="page" style={{ textAlign: 'center' }}>
          <div className="logo-duo" style={{ justifyContent: 'center', marginBottom: 20 }}>
            <img src="/logo.jpg" alt="شعار 1" />
            <img src="/logo-2.jpg" alt="شعار 2" />
          </div>
          <h1 className="landing-title">منصة MK التعليمية</h1>
          <p className="landing-sub">تعلّم، طبق، وشارك مباشرة — منصة واحدة تجمع الدورات والتحديات العملية والبث الحي لآلاف الطلاب</p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
            <Link to="/register" className="btn btn-lg">ابدأ مجاناً</Link>
            <Link to="/login" className="btn btn-secondary btn-lg">تسجيل الدخول</Link>
          </div>
        </div>
      </div>

      {error && <div className="page"><div className="error-msg">{error}</div></div>}

      {/* الإحصائيات */}
      {data && (
        <div className="page">
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-value">{data.stats.students}+</div><div className="stat-label">طالب</div></div>
            <div className="stat-card"><div className="stat-value">{data.stats.courses}+</div><div className="stat-label">دورة</div></div>
            <div className="stat-card"><div className="stat-value">{data.stats.sections}+</div><div className="stat-label">قسم أكاديمي</div></div>
            <div className="stat-card"><div className="stat-value">{data.stats.challenges}+</div><div className="stat-label">تحدٍ عملي</div></div>
            <div className="stat-card"><div className="stat-value">{data.stats.liveRooms}+</div><div className="stat-label">قاعة بث مباشر</div></div>
          </div>
        </div>
      )}

      {/* المميزات */}
      <div className="page">
        <h2 className="landing-h2">لماذا منصة MK؟</h2>
        <div className="grid">
          {features.map((f) => (
            <div key={f.title} className="card">
              <span className="section-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p className="muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* الأقسام */}
      {data && (
        <div className="page">
          <h2 className="landing-h2">الأقسام الأكاديمية</h2>
          <div className="grid">
            {data.sections.map((s) => (
              <div key={s.id} className="card" style={{ borderTop: `4px solid ${s.color || '#6c7bff'}` }}>
                <span className="section-icon">{s.icon}</span>
                <h3>{s.name}</h3>
                <p className="muted mb">{s.description}</p>
                <span className="chip">{s.course_count} دورة</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* آخر الدورات */}
      {data && (
        <div className="page">
          <h2 className="landing-h2">أحدث الدورات</h2>
          <div className="grid">
            {data.latestCourses.map((c, i) => (
              <div key={i} className="card">
                <h3>{c.title}</h3>
                <span className="chip">{c.section_name}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <Link to="/register" className="btn btn-lg">انضم إلى المنصة الآن</Link>
          </div>
        </div>
      )}
    </div>
  );
}
