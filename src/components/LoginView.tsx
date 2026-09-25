import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../config';
import { api } from '../services/api';
import type { AuthUser } from '../types';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface Props { onLogin: (user: AuthUser) => void; }

export default function LoginView({ onLogin }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const render = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setError('');
          const result = await api.loginGoogle(credential);
          if (result.success && result.data) {
            sessionStorage.setItem('ag_session', result.data.sessionToken);
            onLogin(result.data.bootstrap.user);
          } else {
            setError(result.message ?? 'Login Google ditolak oleh server.');
          }
        },
      });
      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 320,
      });
    };
    if (window.google) render();
    else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = render;
      document.head.appendChild(script);
      return () => script.remove();
    }
  }, [onLogin]);

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark">AG</div>
        <p className="eyebrow">PONDOK MODERN AL-GHOZALI</p>
        <h1>Raport Integrasi</h1>
        <p className="muted">Masuk menggunakan akun Google yang terdaftar pada MASTER GURU.</p>
        {!GOOGLE_CLIENT_ID ? <div className="notice">Google Client ID belum dikonfigurasi.</div> : <div ref={buttonRef} className="google-button" />}
        {error && <div className="error">{error}</div>}
      </section>
    </main>
  );
}