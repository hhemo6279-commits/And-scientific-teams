import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setAuth, getUser } from '../api.js';
import GoogleButton from '../components/GoogleButton.jsx';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [sections, setSections] = useState([]);
  const [error, setError] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    api('/public/sections').then((d) => setSections(d.sections)).catch(() => {});
  }, []);

  const onAuthed = (data) => {
    setAuth(data.token, data.user, data.refreshToken);
    const user = getUser();
    nav('/');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!sectionId) return setError('اختر قسمك قبل المتابعة');
    try {
      const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, section_id: Number(sectionId) }) });
      onAuthed(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const onGoogle = async (credential) => {
    setError('');
    try {
      const data = await api('/auth/google', { method: 'POST', body: JSON.stringify({ credential, section_id: sectionId ? Number(sectionId) : null }) });
      onAuthed(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 16, display: 'flex', justifyContent: 'center', gap: 8 }}>
          <img src="/logo.jpg" alt="شعار MK" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
          <img src="/logo-2.jpg" alt="شعار MK" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
        </div>
        <h1 className="auth-title">إنشاء حساب طالب</h1>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          <div className="mb">
            <label className="label">الاسم الكامل</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="mb">
            <label className="label">البريد الإلكتروني</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="mb">
            <label className="label">كلمة المرور (6+ أحرف)</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="mb">
            <label className="label">القسم الذي تريد الانضمام إليه:</label>
            <select className="select" value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
              <option value="">— اختر قسمك —</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-block">إنشاء الحساب</button>
        </form>
        <div className="divider" style={{ textAlign: 'center', margin: '16px 0', color: 'var(--text-dim)', fontSize: 13 }}>أو سجّل عبر Google</div>
        <GoogleButton onCredential={onGoogle} style={{ marginBottom: 16 }} />
        <div className="mt muted" style={{ textAlign: 'center' }}>
          لديك حساب؟ <Link to="/login">سجّل الدخول</Link>
        </div>
      </div>
    </div>
  );
}
