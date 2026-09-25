import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { Assignment, AuthUser } from '../types';
import RaportViewer from './RaportViewer';

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

type Tab = 'beranda' | 'penugasan' | 'raport';

export default function Dashboard({ user, onLogout }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [reportClass, setReportClass] = useState('');
  const [tab, setTab] = useState<Tab>('beranda');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = sessionStorage.getItem('ag_session') ?? '';
  const canRaport = user.role === 'ADMIN' || user.role === 'WALI_KELAS';

  useEffect(() => {
    if (!token) return;
    Promise.all([api.bootstrap(token), api.getClasses(token)]).then(([boot, cls]) => {
      if (boot.success && boot.data) setAssignments(boot.data.assignments ?? []);
      else setError(boot.message ?? 'Data pengguna tidak dapat dimuat.');
      if (cls.success && cls.data) setClasses(cls.data);
      else if (!error) setError(cls.message ?? 'Daftar kelas tidak dapat dimuat.');
      setLoading(false);
    });
  }, [token]);

  const waliClasses = useMemo(
    () => Array.from(new Set(assignments.filter(a => a.isWaliKelas).map(a => a.kelas).filter(Boolean))),
    [assignments]
  );

  const visibleReportClasses = user.role === 'WALI_KELAS' ? waliClasses : classes;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">AG</div>
          <div>
            <strong>Raport Integrasi</strong>
            <span>Al-Ghozali V5.2</span>
          </div>
        </div>
        <div className="top-actions">
          <span className="role-badge">{user.role.replace('_', ' ')}</span>
          <button className="secondary" onClick={onLogout}>Keluar</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="profile-mini">
            <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div><strong>{user.name}</strong><small>@{user.username}</small></div>
          </div>
          <nav>
            <button className={tab === 'beranda' ? 'nav-active' : ''} onClick={() => setTab('beranda')}>Beranda</button>
            <button className={tab === 'penugasan' ? 'nav-active' : ''} onClick={() => setTab('penugasan')}>Penugasan</button>
            {canRaport && <button className={tab === 'raport' ? 'nav-active' : ''} onClick={() => setTab('raport')}>RAPORT ASLI</button>}
          </nav>
          <div className="sidebar-note">Data berasal dari sumber resmi melalui Apps Script. Tidak ada data contoh.</div>
        </aside>

        <section className="main-content">
          {error && <div className="error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}

          {tab === 'beranda' && (
            <>
              <div className="hero">
                <div>
                  <p className="eyebrow">PONDOK MODERN AL-GHOZALI</p>
                  <h1>Selamat datang, {user.name}</h1>
                  <p>Kelola akses raport dan penugasan Anda melalui satu dashboard.</p>
                </div>
                <div className="hero-mark">AG</div>
              </div>
              <div className="stats">
                <div className="stat-card"><span>Role</span><strong>{user.role.replace('_', ' ')}</strong></div>
                <div className="stat-card"><span>Penugasan</span><strong>{assignments.length}</strong></div>
                <div className="stat-card"><span>Kelas terakses</span><strong>{classes.length}</strong></div>
              </div>
              <div className="section-title"><h2>Akses cepat</h2><span>Server-side authorization</span></div>
              <div className="feature-grid">
                <button className="feature-card" onClick={() => setTab('penugasan')}><span className="feature-icon">▦</span><strong>Penugasan</strong><small>Lihat unit, mata pelajaran, dan kelas.</small></button>
                {canRaport && <button className="feature-card" onClick={() => setTab('raport')}><span className="feature-icon">▤</span><strong>RAPORT ASLI</strong><small>Buka dokumen asli sesuai kewenangan.</small></button>}
                <div className="feature-card locked"><span className="feature-icon">✓</span><strong>Keamanan</strong><small>Akses diverifikasi oleh Apps Script.</small></div>
              </div>
            </>
          )}

          {tab === 'penugasan' && (
            <section>
              <div className="section-title"><div><p className="eyebrow">MASTER PENUGASAN</p><h1>Penugasan Anda</h1></div><span>{assignments.length} data</span></div>
              {loading ? <div className="empty">Memuat data...</div> : assignments.length === 0 ? (
                <div className="empty"><strong>Tidak ada penugasan aktif</strong><span>Server tidak mengirim data penugasan untuk akun ini.</span></div>
              ) : (
                <div className="table-wrap"><table><thead><tr><th>Unit</th><th>Kelas</th><th>Mata Pelajaran</th><th>Jam</th><th>Status</th></tr></thead><tbody>
                  {assignments.map((a, i) => <tr key={i}><td>{a.unit || '—'}</td><td>{a.kelas || '—'}</td><td>{a.mapel || '—'}</td><td>{'jumlahJam' in a ? String((a as Assignment & {jumlahJam?: unknown}).jumlahJam ?? '—') : '—'}</td><td>{a.isWaliKelas ? <span className="pill">Wali Kelas</span> : <span className="muted">Guru Mapel</span>}</td></tr>)}
                </tbody></table></div>
              )}
            </section>
          )}

          {tab === 'raport' && canRaport && (
            <section>
              <div className="section-title"><div><p className="eyebrow">DOKUMEN RESMI</p><h1>RAPORT ASLI</h1></div></div>
              <div className="report-panel">
                <p>RAPORT ASLI ditampilkan langsung di dalam aplikasi dari Spreadsheet resmi. Sistem hanya membaca data dan tidak mengubah dokumen raport.</p>
                <label>Kelas
                  <select value={reportClass} onChange={e => setReportClass(e.target.value)}>
                    <option value="">Pilih kelas</option>
                    {visibleReportClasses.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </label>
              </div>
              {reportClass && <RaportViewer token={token} kelas={reportClass} />}
              {visibleReportClasses.length === 0 && <div className="empty"><strong>Belum ada kelas yang dapat ditampilkan</strong><span>Daftar kelas berasal dari server, bukan data contoh.</span></div>}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
