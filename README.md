# Raport Integrasi Al-Ghozali V5.2

Sistem raport online Pondok Modern Al-Ghozali.

## Arsitektur V5.2

GitHub Pages → React/Vite → Google Apps Script API → Google Sheets

Tidak menggunakan Vercel, Supabase, Firebase, atau Google OAuth.

## Login

Akun guru dibuat oleh Admin:

- Username
- Password
- Role
- Status

Guru tidak melakukan self-registration dan tidak menentukan penugasannya sendiri.

Penugasan dibaca dari `MASTER_PENUGASAN` sehingga satu guru dapat memiliki banyak unit, kelas, dan mata pelajaran.

## Role

- ADMIN: akses administratif dan RAPORT ASLI seluruh kelas yang dikonfigurasi.
- WALI_KELAS: RAPORT ASLI hanya untuk kelas yang ditetapkan sebagai wali.
- GURU_MAPEL: input/monitoring sesuai penugasan; tidak memiliki akses RAPORT ASLI.

## Backend

Lihat:

- `apps-script/Code.gs`
- `apps-script/MASTER_STRUCTURE.md`
- `apps-script/README.md`

## Aturan data

- Tidak ada dummy data.
- MASTER adalah sumber otoritas akun dan penugasan.
- Spreadsheet RAPORT tetap menjadi sumber RAPORT ASLI.
- Spreadsheet ID RAPORT disimpan di Apps Script Properties, bukan frontend.
- Frontend tidak dipercaya untuk menentukan role atau kewenangan.
