import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setAuth, getUser } from '../api.js';
import GoogleButton from '../components/GoogleButton.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const onAuthed = (data) => {
    setAuth(data.token, data.user, data.refreshToken);
    const user = getUser();
    nav(user.role === 'student' ? '/' : '/admin');
  };

  const startAuth = (e) => {
    e && e.preventDefault();
    setError('');
    setLoading(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (data.requiresMfa) { setPending(data); return; }
      onAuthed(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/mfa/login', { method: 'POST', body: JSON.stringify({ mfaToken: pending.mfaToken, code: otp }) });
      onAuthed(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async (credential) => {
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });
      if (data.requiresMfa) { setPending(data); return; }
      onAuthed(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (pending) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div style={{ textAlign: 'center', marginBottom: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
            <img src="/logo.jpg" alt="شعار MK" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
            <img src="/logo-2.jpg" alt="شعار MK" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
          </div>
          <h1 className="auth-title">🔐 مصادقة ثنائية</h1>
          <p className="muted mb" style={{ textAlign: 'center' }}>أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة، أو كود الاسترداد.</p>
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={submitOtp}>
            <div className="mb">
              <label className="label">رمز المصادقة</label>
              <input className="input" dir="ltr" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" maxLength={10} autoFocus required />
            </div>
            <button className="btn btn-block" disabled={loading}>{loading ? '...' : 'تأكيد الدخول'}</button>
          </form>
          <div className="mt muted" style={{ textAlign: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPending(null); setOtp(''); }}>↩ رجوع</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
          <img src="/logo.jpg" alt="شعار MK" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
          <img src="/logo-2.jpg" alt="شعار MK" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
        </div>
        <h1 className="auth-title">تسجيل الدخول</h1>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          <div className="mb">
            <label className="label">البريد الإلكتروني</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="mb">
            <label className="label">كلمة المرور</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-block" disabled={loading}>{loading ? '...' : 'دخول'}</button>
        </form>
        <div className="divider" style={{ textAlign: 'center', margin: '16px 0', color: 'var(--text-dim)', fontSize: 13 }}>أو</div>
        <GoogleButton onCredential={onGoogle} style={{ marginBottom: 16 }} />
        <div className="mt muted" style={{ textAlign: 'center' }}>
          ليس لديك حساب؟ <Link to="/register">سجّل الآن</Link>
          <div className="mt">
            حسابات تجريبية: <br />
            أدمن رئيسي: admin@mk.io / admin123<br />
            أدمن فرعي: cyber@mk.io / admin123<br />
            طالب: student@mk.io / student123
          </div>
        </div>
      </div>
    </div>
  );
}