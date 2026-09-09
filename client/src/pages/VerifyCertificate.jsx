import React, { useState } from 'react';
import { api } from '../api.js';

export default function VerifyCertificate() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const verify = async (e) => {
    e.preventDefault();
    setResult(null);
    setError('');
    try {
      const d = await api(`/public/certificate/${code.trim()}`);
      setResult(d);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="card">
        <h2 className="mb">🎓 التحقق من الشهادة</h2>
        <p className="muted mb">أدخل رمز الشهادة للتحقق من صحتها. الرمز موجود في شهادة الإنجاز الخاصة بك.</p>
        <form onSubmit={verify} className="row">
          <input className="input" placeholder="مثال: CERT-MK-0001" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} style={{ flex: 1 }} />
          <button className="btn btn-success">تحقق</button>
        </form>
      </div>

      {error && <div className="error-msg mt">❌ {error}</div>}

      {result && result.valid && (
        <div className="card mt" style={{ border: '2px solid #27ae60' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 46 }}>✅</div>
            <h2 className="mb">شهادة صحيحة وموثقة</h2>
            <p>تم التحقق من الشهادة رقم <strong dir="ltr">{result.certificate.code}</strong></p>
          </div>
          <div className="mt">
            <div className="chat-msg"><strong>اسم الطالب:</strong> {result.certificate.user_name}</div>
            <div className="chat-msg"><strong>الدورة:</strong> {result.certificate.course_title}</div>
            <div className="chat-msg"><strong>القسم:</strong> {result.certificate.section_name}</div>
            <div className="chat-msg"><strong>تاريخ الإصدار:</strong> {result.certificate.issued_at}</div>
            {result.certificate.grade && <div className="chat-msg"><strong>الدرجة:</strong> {result.certificate.grade}</div>}
          </div>
          <p className="muted mt" style={{ textAlign: 'center' }}>تم إصدارها عبر منصة MK التعليمية</p>
        </div>
      )}

      <p className="muted mt" style={{ textAlign: 'center' }}>هل أنت طالب؟ <a href="#" onClick={(e) => { e.preventDefault(); window.history.back(); }}>العودة</a></p>
    </div>
  );
}
