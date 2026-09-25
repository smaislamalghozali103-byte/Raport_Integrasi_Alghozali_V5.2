import { useEffect, useState } from 'react';
import LoginView from './components/LoginView';
import Dashboard from './components/Dashboard';
import { api } from './services/api';
import type { AuthUser } from './types';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('ag_session');

    if (!token) {
      setLoading(false);
      return;
    }

    api.bootstrap(token).then(result => {
      if (result.success && result.data) {
        setUser(result.data.user);
      } else {
        sessionStorage.removeItem('ag_session');
      }
      setLoading(false);
    });
  }, []);

  async function logout() {
    const token = sessionStorage.getItem('ag_session');
    if (token) await api.logout(token);
    sessionStorage.removeItem('ag_session');
    setUser(null);
  }

  if (loading) {
    return <main className="login-page"><section className="login-card"><p>Memeriksa sesi...</p></section></main>;
  }

  if (!user) return <LoginView onLogin={setUser} />;

  return <Dashboard user={user} onLogout={logout} />;
}
