import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { Assignment, AuthUser } from '../types';

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportClass, setReportClass] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('ag_session');
    if (!token) return;

    api.bootstrap(token).then(result => {
      if (result.success && result.data) {
        setAssignments(result.data.assignments);
      } else {
        setError(result.message ?? 'Data penugasan tidak dapat dimuat.');
      }
      setLoading(false);
    });
  }, []);

  const waliClasses = useMemo(
    () => Array.from(new Set(assignments.filter(a => a.isWaliKelas).map(a => a.kelas))),
    [assignments]
  );

  async function openReport() {
    if (!reportClass) {
      setError('Pilih kelas terlebih dahulu.');
      return;
    }

    const token = sessionStorage.getItem('ag_session');
    if (!token) return;

    const result = await api.raportAccess(token, reportClass);
    if (result.success && result.data) {
      window.open(result.data.url, '_blank', 'noopener,noreferrer');
    } else {
      setError(result.message ?? 'Akses RAPORT ASLI ditolak.');
    }
  }

  return (
    <main className="dashboard">
      <header className="topbar">
        <div>
          <strong>Raport Integrasi Al-Ghozali</strong>
          <span>V5.2</span>
        </div>
        <button className="secondary" onClick={onLogout}>Keluar</button>
      </header>

      <section className="content">
        <div className="user-card">
          <div>
            <h2>{user.name}</h2>
            <p>Username: {user.username}</p>
          </div>
          <div className="role">{user.role}</div>
        </div>

        {error && <div className="error" role="alert">{error}</div>}

        <section className="panel">
          <h3>Penugasan Anda</h3>
          {loading ? (
            <p className="muted">Memuat penugasan...</p>
          ) : assignments.length === 0 ? (
            <p className="muted">Belum ada penugasan aktif pada MASTER.</p>
          ) : (
            <div className="assignment-list">
              {assignments.map((a, index) => (
                <div className="assignment-item" key={index}>
                  <strong>{a.unit}</strong>
                  <span>{a.kelas}</span>
                  <span>{a.mapel}</span>
                  {a.isWaliKelas && <small>Wali Kelas</small>}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid">
          <article>
            <h3>Input Nilai</h3>
            <p>Penugasan diambil langsung dari MASTER.</p>
            <button disabled>Segera</button>
          </article>

          <article>
            <h3>Monitoring</h3>
            <p>Monitoring akan mengikuti penugasan server.</p>
            <button disabled>Segera</button>
          </article>

          {(user.role === 'ADMIN' || user.role === 'WALI_KELAS') && (
            <article>
              <h3>RAPORT ASLI</h3>
              <p>Dokumen asli hanya dapat dibuka sesuai otorisasi server.</p>
              <select value={reportClass} onChange={e => setReportClass(e.target.value)}>
                <option value="">Pilih kelas</option>
                {user.role === 'WALI_KELAS' && waliClasses.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <button onClick={openReport} disabled={!reportClass}>Buka RAPORT ASLI</button>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
