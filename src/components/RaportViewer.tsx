import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { RaportViewData } from '../types';

interface Props { token: string; kelas: string; }

export default function RaportViewer({ token, kelas }: Props) {
  const [data, setData] = useState<RaportViewData | null>(null);
  const [sheet, setSheet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(sheetName?: string) {
    setLoading(true); setError('');
    const result = await api.raportView(token, kelas, sheetName);
    setLoading(false);
    if (!result.success || !result.data) {
      setError(result.message ?? 'Data RAPORT ASLI tidak dapat dimuat.');
      return;
    }
    setData(result.data);
    if (!sheetName && result.data.activeSheet) setSheet(result.data.activeSheet);
  }

  useEffect(() => {
    setData(null); setSheet(''); setError('');
    if (kelas) void load();
  }, [kelas]);

  const active = useMemo(
    () => data?.sheets.find(s => s.name === sheet) ?? data?.sheets[0],
    [data, sheet]
  );

  if (!kelas) return null;

  return (
    <div className="raport-viewer">
      <div className="raport-viewer-head">
        <div>
          <p className="eyebrow">DATA LANGSUNG DARI RAPORT ASLI</p>
          <h2>{kelas}</h2>
          <span>{data?.spreadsheetName ?? 'Spreadsheet RAPORT ASLI'}</span>
        </div>
        <button className="secondary" onClick={() => load(sheet || undefined)} disabled={loading}>
          {loading ? 'Memuat...' : '↻ Refresh'}
        </button>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {loading && !data ? (
        <div className="empty">Memuat data Spreadsheet RAPORT ASLI...</div>
      ) : data && (
        <>
          {data.sheets.length > 1 && (
            <div className="sheet-tabs">
              {data.sheets.map(s => (
                <button
                  key={s.name}
                  className={s.name === (active?.name ?? '') ? 'sheet-active' : ''}
                  onClick={() => { setSheet(s.name); void load(s.name); }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {!active || active.rows.length === 0 ? (
            <div className="empty"><strong>Sheet kosong</strong><span>Tidak ada data yang dikirim dari Spreadsheet.</span></div>
          ) : (
            <div className="table-wrap raport-grid">
              <table>
                <tbody>
                  {active.rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => <td key={c}>{cell === '' ? '—' : cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="raport-viewer-foot">
            <span>{active?.rows.length ?? 0} baris · {active?.rows[0]?.length ?? 0} kolom</span>
            <span>Mode baca · RAPORT ASLI tidak diubah</span>
          </div>
        </>
      )}
    </div>
  );
}
