import type { AuthUser } from '../types';

interface Props {
  user: AuthUser;
  onLogout: () => void;
  onReport: () => void;
}

export default function Dashboard({ user, onLogout, onReport }: Props) {
  const canReport = user.role === 'ADMIN' || user.role === 'WALI_KELAS';
  return (
    <main className="dashboard">
      <header className="topbar">
        <div><strong>Raport Integrasi Al-Ghozali</strong><span>V5.2</span></div>
        <button className="secondary" onClick={onLogout}>Keluar</button>
      </header>
      <section className="content">
        <div className="user-card">
          {user.picture && <img src={user.picture} alt="" />}
          <div><h2>{user.name}</h2><p>{user.email ?? ''}</p></div>
          <div className="role">{user.role}</div>
        </div>
        <div className="grid">
          <article><h3>Input Nilai</h3><p>Input nilai berdasarkan penugasan yang diberikan server.</p><button>Masuk</button></article>
          <article><h3>Monitoring</h3><p>Melihat status input sesuai hak akses.</p><button>Monitoring</button></article>
          {canReport && <article><h3>RAPORT ASLI</h3><p>Hanya ADMIN dan WALI KELAS sesuai otorisasi server.</p><button onClick={onReport}>Buka Raport</button></article>}
        </div>
      </section>
    </main>
  );
}