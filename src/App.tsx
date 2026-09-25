import { useState } from 'react';
import LoginView from './components/LoginView';
import Dashboard from './components/Dashboard';
import type { AuthUser } from './types';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  if (!user) return <LoginView onLogin={setUser} />;
  const logout = () => { sessionStorage.removeItem('ag_session'); setUser(null); };
  const openReport = () => window.dispatchEvent(new CustomEvent('ag-report-request'));
  return <Dashboard user={user} onLogout={logout} onReport={openReport} />;
}