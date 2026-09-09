import React, { useEffect, useRef } from 'react';

export default function GoogleButton({ onCredential, style }) {
  const btnRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !btnRef.current) return;
    const render = () => {
      if (!window.google?.accounts) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => {
          if (resp?.credential) onCredential(resp.credential);
        },
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 340,
        text: 'signin_with',
      });
    };
    if (window.google?.accounts) {
      render();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [clientId]);

  if (!clientId) {
    return (
      <div className="muted" style={{ textAlign: 'center', fontSize: 12, ...(style || {}) }}>
        🔐 تسجيل الدخول عبر Google غير مفعّل — أضف VITE_GOOGLE_CLIENT_ID في client/.env
      </div>
    );
  }
  return <div ref={btnRef} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0', ...(style || {}) }} />;
}