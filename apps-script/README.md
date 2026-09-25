# Apps Script Backend

Backend V5.2 menggunakan Google Apps Script sebagai satu-satunya gateway ke Google Sheets.

## Alur

Frontend GitHub Pages
→ Apps Script API
→ MASTER
→ RAPORT kelas

## Aturan

- Tidak ada Google Login.
- Tidak ada Vercel.
- Tidak ada Supabase.
- Tidak ada Firebase.
- Guru tidak melakukan self-registration.
- Username dan akun dibuat Admin.
- Penugasan diambil dari MASTER_PENUGASAN.
- Role ditentukan server.
- Spreadsheet ID RAPORT hanya berada di Script Properties.
- Guru Mapel tidak dapat membuka RAPORT ASLI.
- Wali Kelas hanya dapat membuka RAPORT ASLI kelas yang ditetapkan sebagai wali.
- Admin dapat membuka seluruh RAPORT yang dikonfigurasi.

## Deployment

1. Buat project Apps Script.
2. Tempel `Code.gs`.
3. Set `MASTER_SPREADSHEET_ID`.
4. Set property RAPORT kelas.
5. Jalankan `setupMasterSheets()`.
6. Isi MASTER.
7. Deploy > New deployment > Web app.
8. Execute as: Me.
9. Who has access: sesuai kebijakan akun sekolah.
10. URL Web App dipasang di frontend sebagai `VITE_APPS_SCRIPT_URL`.

Tidak ada data siswa/guru/nilai contoh di backend.
