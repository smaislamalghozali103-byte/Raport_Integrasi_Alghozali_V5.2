# MASTER — Raport Integrasi Al-Ghozali V5.2

MASTER adalah sumber otoritas akun guru dan penugasan. Guru tidak mengisi atau mengubah penugasan dari frontend.

## 1. MASTER_GURU

Kolom wajib:

| Kolom | Keterangan |
|---|---|
| GURU_ID | ID unik guru, dibuat Admin |
| USERNAME | Username login unik |
| PASSWORD_HASH | SHA-256 password, bukan password asli |
| NAMA | Nama resmi guru |
| ROLE | ADMIN / WALI_KELAS / GURU_MAPEL |
| STATUS | AKTIF / NONAKTIF |

Contoh:

| GURU_ID | USERNAME | PASSWORD_HASH | NAMA | ROLE | STATUS |
|---|---|---|---|---|---|
| G001 | ahmad01 | (hash) | Ust. Ahmad | GURU_MAPEL | AKTIF |

Jangan memasukkan password asli ke spreadsheet.

## 2. MASTER_PENUGASAN

Kolom wajib:

| Kolom | Keterangan |
|---|---|
| GURU_ID | Mengacu ke MASTER_GURU |
| UNIT | SMP / SMA / TMMIA / unit resmi lainnya |
| KELAS | Kelas yang ditugaskan |
| MAPEL | Mata pelajaran |
| STATUS | AKTIF / NONAKTIF |

Satu guru boleh memiliki jumlah baris penugasan berapa pun.

Contoh:

| GURU_ID | UNIT | KELAS | MAPEL | STATUS |
|---|---|---|---|---|
| G001 | SMP | 3A | IPS | AKTIF |
| G001 | SMP | 3B | IPS | AKTIF |
| G001 | SMA | 5A | Sosiologi | AKTIF |
| G001 | SMA | 5B | Sejarah | AKTIF |

## 3. LOG_AKTIVITAS

Kolom:

TIMESTAMP, GURU_ID, USERNAME, ACTION, TARGET, STATUS, DETAIL

Digunakan untuk audit login, logout, akses raport, dan aktivitas penting.

## 4. Script Properties

Set pada Apps Script > Project Settings > Script Properties.

Wajib:

`MASTER_SPREADSHEET_ID`

Untuk RAPORT kelas, gunakan pola:

`RAPORT_KELAS_<KELAS_NORMALIZED>_ID`

Contoh:

- RAPORT_KELAS_1INTA_ID
- RAPORT_KELAS_1INTB_ID
- RAPORT_KELAS_2INTA_ID
- RAPORT_KELAS_2INTB_ID
- RAPORT_KELAS_3INTA_ID
- RAPORT_KELAS_3INTB_ID
- RAPORT_KELAS_4A_ID
- RAPORT_KELAS_4B_ID
- RAPORT_KELAS_5A_ID
- RAPORT_KELAS_5B_ID
- RAPORT_KELAS_5C_ID
- RAPORT_KELAS_5D_ID
- RAPORT_KELAS_6A_ID
- RAPORT_KELAS_6B_ID
- RAPORT_KELAS_6C_ID
- RAPORT_KELAS_6D_ID

Nilai property diisi dengan Spreadsheet ID asli. Jangan ditaruh di frontend.

## 5. Membuat password awal

Di Apps Script jalankan:

`generatePasswordHash('PASSWORD_BARU')`

Salin hash yang muncul di execution log ke kolom PASSWORD_HASH.

Setelah guru login, aplikasi dapat menyediakan ganti password.
