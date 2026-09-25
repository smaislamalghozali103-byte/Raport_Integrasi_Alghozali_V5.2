import { FormEvent, useState } from 'react';
import { api } from '../services/api';
import type { AuthUser } from '../types';

interface Props {
  onLogin: (user: AuthUser) => void;
}

export default function LoginView({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }

    setLoading(true);
    const result = await api.login(username, password);
    setLoading(false);

    if (result.success && result.data) {
      sessionStorage.setItem('ag_session', result.data.sessionToken);
      onLogin(result.data.user);
      return;
    }

    setError(result.message ?? 'Login ditolak oleh server.');
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark">AG</div>
        <p className="eyebrow">PONDOK MODERN AL-GHOZALI</p>
        <h1>Raport Integrasi</h1>
        <p className="muted">Masuk menggunakan username dan password yang diberikan Admin.</p>

        <form onSubmit={submit}>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              disabled={loading}
              placeholder="Username"
            />
          </label>

          <label>
            Password
            <div className="password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
                placeholder="Password"
              />
              <button
                type="button"
                className="secondary"
                onClick={() => setShowPassword(v => !v)}
                disabled={loading}
              >
                {showPassword ? 'Sembunyikan' : 'Lihat'}
              </button>
            </div>
          </label>

          {error && <div className="error" role="alert">{error}</div>}

          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Memeriksa...' : 'Masuk'}
          </button>
        </form>

        <p className="login-help">
          Belum memiliki akun? Hubungi Admin untuk mendapatkan username dan password.
        </p>
      </section>
    </main>
  );
}
