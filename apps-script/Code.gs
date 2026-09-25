/**
 * RAPORT INTEGRASI AL-GHOZALI V5.2
 * Backend: Google Apps Script
 *
 * Prinsip:
 * - MASTER adalah sumber otoritas akun dan penugasan.
 * - Guru tidak membuat/menentukan penugasannya sendiri.
 * - Frontend tidak dipercaya untuk role, kelas, mapel, row, atau spreadsheet ID.
 * - Password disimpan sebagai SHA-256 hash.
 * - Session dibuat oleh Apps Script dan disimpan di CacheService.
 * - ID Spreadsheet RAPORT disimpan di Script Properties.
 *
 * Deploy:
 * 1. Buat project Apps Script.
 * 2. Tempel file ini sebagai Code.gs.
 * 3. Set Script Properties sesuai MASTER_STRUCTURE.md.
 * 4. Jalankan setupMasterSheets() sekali.
 * 5. Isi MASTER_GURU dan MASTER_PENUGASAN.
 * 6. Deploy sebagai Web App.
 */

const APP = {
  NAME: 'Raport Integrasi Al-Ghozali V5.2',
  SESSION_TTL_SECONDS: 21600, // 6 jam
  LOGIN_FAIL_TTL_SECONDS: 900, // 15 menit
  MAX_LOGIN_FAILURES: 5,
  SHEETS: {
    GURU: 'MASTER_GURU',
    PENUGASAN: 'MASTER_PENUGASAN',
    LOG: 'LOG_AKTIVITAS'
  },
  ROLES: {
    ADMIN: 'ADMIN',
    WALI_KELAS: 'WALI_KELAS',
    GURU_MAPEL: 'GURU_MAPEL'
  },
  STATUS: {
    ACTIVE: 'AKTIF',
    INACTIVE: 'NONAKTIF'
  }
};

function doGet() {
  return json_({
    success: true,
    data: {
      app: APP.NAME,
      status: 'OK',
      time: new Date().toISOString()
    }
  });
}

function doPost(e) {
  try {
    const body = parseRequest_(e);
    const action = String(body.action || '').trim();

    switch (action) {
      case 'login':
        return json_(login_(body));
      case 'logout':
        return json_(logout_(body));
      case 'bootstrap':
        return json_(bootstrap_(body));
      case 'changePassword':
        return json_(changePassword_(body));
      case 'raportAccess':
        return json_(raportAccess_(body));
      default:
        return json_(fail_('UNKNOWN_ACTION', 'Action tidak dikenal.'));
    }
  } catch (err) {
    console.error(err);
    return json_(fail_('SERVER_ERROR', 'Terjadi kesalahan pada server.'));
  }
}

/* =========================
   MASTER SETUP
   ========================= */

function setupMasterSheets() {
  const ss = getMasterSpreadsheet_();

  ensureSheet_(ss, APP.SHEETS.GURU, [
    'GURU_ID',
    'USERNAME',
    'PASSWORD_HASH',
    'NAMA',
    'ROLE',
    'STATUS'
  ]);

  ensureSheet_(ss, APP.SHEETS.PENUGASAN, [
    'GURU_ID',
    'UNIT',
    'KELAS',
    'MAPEL',
    'STATUS'
  ]);

  ensureSheet_(ss, APP.SHEETS.LOG, [
    'TIMESTAMP',
    'GURU_ID',
    'USERNAME',
    'ACTION',
    'TARGET',
    'STATUS',
    'DETAIL'
  ]);

  return 'MASTER siap digunakan.';
}

/**
 * Jalankan manual di Apps Script untuk memperoleh SHA-256.
 * Jangan pernah menyimpan password asli di MASTER.
 */
function generatePasswordHash(password) {
  if (!password || String(password).length < 8) {
    throw new Error('Password minimal 8 karakter.');
  }
  const hash = sha256_(String(password));
  console.log(hash);
  return hash;
}

/* =========================
   AUTHENTICATION
   ========================= */

function login_(body) {
  const username = normalizeUsername_(body.username);
  const password = String(body.password || '');

  if (!username || !password) {
    return fail_('INVALID_LOGIN', 'Username dan password wajib diisi.');
  }

  if (isLoginBlocked_(username)) {
    return fail_('TOO_MANY_ATTEMPTS', 'Terlalu banyak percobaan. Coba lagi beberapa menit.');
  }

  const guru = findGuruByUsername_(username);

  if (!guru || guru.status !== APP.STATUS.ACTIVE ||
      guru.passwordHash !== sha256_(password)) {
    registerLoginFailure_(username);
    logActivity_(null, username, 'LOGIN', '', 'FAILED', 'Username/password tidak valid.');
    return fail_('INVALID_LOGIN', 'Username atau password salah.');
  }

  clearLoginFailures_(username);

  const token = createSession_(guru);
  const assignments = getAssignmentsForGuru_(guru.guruId);

  logActivity_(
    guru.guruId,
    guru.username,
    'LOGIN',
    '',
    'SUCCESS',
    'Login berhasil.'
  );

  return ok_({
    sessionToken: token,
    user: publicUser_(guru),
    assignments: assignments
  });
}

function logout_(body) {
  const token = String(body.sessionToken || '').trim();
  const session = getSession_(token);

  if (token) {
    CacheService.getScriptCache().remove(sessionKey_(token));
  }

  if (session) {
    logActivity_(
      session.guruId,
      session.username,
      'LOGOUT',
      '',
      'SUCCESS',
      'Logout.'
    );
  }

  return ok_({ loggedOut: true });
}

function bootstrap_(body) {
  const session = requireSession_(body.sessionToken);
  const guru = findGuruById_(session.guruId);

  if (!guru || guru.status !== APP.STATUS.ACTIVE) {
    invalidateSession_(body.sessionToken);
    return fail_('SESSION_REVOKED', 'Akun tidak aktif.');
  }

  const assignments = getAssignmentsForGuru_(guru.guruId);

  return ok_({
    user: publicUser_(guru),
    assignments: assignments,
    permissions: permissionsForRole_(guru.role)
  });
}

function changePassword_(body) {
  const session = requireSession_(body.sessionToken);
  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');

  if (newPassword.length < 8) {
    return fail_('WEAK_PASSWORD', 'Password baru minimal 8 karakter.');
  }

  const guru = findGuruById_(session.guruId);
  if (!guru || guru.passwordHash !== sha256_(currentPassword)) {
    return fail_('INVALID_PASSWORD', 'Password lama salah.');
  }

  updateGuruPassword_(guru.row, sha256_(newPassword));
  invalidateSession_(body.sessionToken);

  logActivity_(
    guru.guruId,
    guru.username,
    'CHANGE_PASSWORD',
    '',
    'SUCCESS',
    'Password berhasil diubah; session lama diakhiri.'
  );

  return ok_({
    changed: true,
    message: 'Password berhasil diubah. Silakan login kembali.'
  });
}

/* =========================
   AUTHORIZATION
   ========================= */

function raportAccess_(body) {
  const session = requireSession_(body.sessionToken);
  const kelas = normalizeText_(body.kelas);

  if (!kelas) {
    return fail_('INVALID_CLASS', 'Kelas wajib dipilih.');
  }

  const guru = findGuruById_(session.guruId);
  if (!guru) {
    return fail_('USER_NOT_FOUND', 'Akun tidak ditemukan.');
  }

  if (guru.role === APP.ROLES.GURU_MAPEL) {
    logActivity_(guru.guruId, guru.username, 'RAPORT_ACCESS', kelas, 'FORBIDDEN',
      'Guru mapel tidak memiliki akses RAPORT ASLI.');
    return fail_('FORBIDDEN', 'Anda tidak memiliki akses RAPORT ASLI.');
  }

  if (guru.role === APP.ROLES.WALI_KELAS) {
    const assignments = getAssignmentsForGuru_(guru.guruId);
    const allowed = assignments.some(function(a) {
      return normalizeText_(a.kelas) === kelas && a.isWaliKelas === true;
    });

    if (!allowed) {
      logActivity_(guru.guruId, guru.username, 'RAPORT_ACCESS', kelas, 'FORBIDDEN',
        'Wali kelas mencoba membuka kelas di luar kewenangan.');
      return fail_('FORBIDDEN', 'Anda hanya dapat membuka RAPORT ASLI kelas yang menjadi tanggung jawab Anda.');
    }
  }

  const spreadsheetId = getRaportSpreadsheetId_(kelas);
  if (!spreadsheetId) {
    return fail_('RAPORT_NOT_CONFIGURED', 'Spreadsheet RAPORT kelas belum dikonfigurasi oleh Admin.');
  }

  const url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit';

  logActivity_(
    guru.guruId,
    guru.username,
    'RAPORT_ACCESS',
    kelas,
    'SUCCESS',
    'Akses RAPORT ASLI diberikan.'
  );

  return ok_({
    kelas: kelas,
    url: url
  });
}

/* =========================
   MASTER ACCESS
   ========================= */

function getMasterSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('MASTER_SPREADSHEET_ID');
  if (!id) {
    throw new Error('MASTER_SPREADSHEET_ID belum diset di Script Properties.');
  }
  return SpreadsheetApp.openById(id);
}

function findGuruByUsername_(username) {
  const sheet = getMasterSpreadsheet_().getSheetByName(APP.SHEETS.GURU);
  if (!sheet) throw new Error('Sheet MASTER_GURU tidak ditemukan.');

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = headerMap_(values[0]);
  const required = ['GURU_ID', 'USERNAME', 'PASSWORD_HASH', 'NAMA', 'ROLE', 'STATUS'];
  required.forEach(function(h) {
    if (headers[h] === undefined) throw new Error('Kolom ' + h + ' tidak ditemukan di MASTER_GURU.');
  });

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const u = normalizeUsername_(row[headers.USERNAME]);
    if (u === username) {
      return guruFromRow_(row, i + 1, headers);
    }
  }
  return null;
}

function findGuruById_(guruId) {
  const sheet = getMasterSpreadsheet_().getSheetByName(APP.SHEETS.GURU);
  if (!sheet) throw new Error('Sheet MASTER_GURU tidak ditemukan.');

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = headerMap_(values[0]);

  for (let i = 1; i < values.length; i++) {
    if (normalizeText_(values[i][headers.GURU_ID]) === normalizeText_(guruId)) {
      return guruFromRow_(values[i], i + 1, headers);
    }
  }
  return null;
}

function getAssignmentsForGuru_(guruId) {
  const sheet = getMasterSpreadsheet_().getSheetByName(APP.SHEETS.PENUGASAN);
  if (!sheet) throw new Error('Sheet MASTER_PENUGASAN tidak ditemukan.');

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = headerMap_(values[0]);
  ['GURU_ID', 'UNIT', 'KELAS', 'MAPEL', 'STATUS'].forEach(function(h) {
    if (headers[h] === undefined) throw new Error('Kolom ' + h + ' tidak ditemukan di MASTER_PENUGASAN.');
  });

  return values.slice(1)
    .filter(function(row) {
      return normalizeText_(row[headers.GURU_ID]) === normalizeText_(guruId) &&
             normalizeText_(row[headers.STATUS]) === APP.STATUS.ACTIVE;
    })
    .map(function(row) {
      return {
        unit: normalizeText_(row[headers.UNIT]),
        kelas: normalizeText_(row[headers.KELAS]),
        mapel: normalizeText_(row[headers.MAPEL]),
        isWaliKelas: normalizeText_(row[headers.MAPEL]) === 'WALI_KELAS'
      };
    });
}

/* =========================
   RAPORT CONFIG
   ========================= */

function getRaportSpreadsheetId_(kelas) {
  const key = 'RAPORT_KELAS_' + normalizePropertyKey_(kelas) + '_ID';
  return PropertiesService.getScriptProperties().getProperty(key);
}

/* =========================
   SESSION
   ========================= */

function createSession_(guru) {
  const token = Utilities.getUuid() + '-' + Utilities.getUuid();
  const payload = {
    guruId: guru.guruId,
    username: guru.username,
    role: guru.role,
    issuedAt: Date.now()
  };

  CacheService.getScriptCache().put(
    sessionKey_(token),
    JSON.stringify(payload),
    APP.SESSION_TTL_SECONDS
  );

  return token;
}

function getSession_(token) {
  if (!token) return null;
  const raw = CacheService.getScriptCache().get(sessionKey_(token));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function requireSession_(token) {
  const session = getSession_(String(token || '').trim());
  if (!session) {
    throw new AuthError_('UNAUTHORIZED', 'Session tidak valid atau sudah kedaluwarsa.');
  }
  return session;
}

function invalidateSession_(token) {
  if (token) CacheService.getScriptCache().remove(sessionKey_(token));
}

function sessionKey_(token) {
  return 'SESSION_' + token;
}

/* =========================
   LOGIN RATE LIMIT
   ========================= */

function isLoginBlocked_(username) {
  const cache = CacheService.getScriptCache();
  const key = 'LOGIN_FAIL_' + username;
  const raw = cache.get(key);
  return raw ? Number(raw) >= APP.MAX_LOGIN_FAILURES : false;
}

function registerLoginFailure_(username) {
  const cache = CacheService.getScriptCache();
  const key = 'LOGIN_FAIL_' + username;
  const raw = cache.get(key);
  const count = raw ? Number(raw) + 1 : 1;
  cache.put(key, String(count), APP.LOGIN_FAIL_TTL_SECONDS);
}

function clearLoginFailures_(username) {
  CacheService.getScriptCache().remove('LOGIN_FAIL_' + username);
}

/* =========================
   PASSWORD / NORMALIZATION
   ========================= */

function sha256_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  );

  return bytes.map(function(b) {
    const v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function normalizeUsername_(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function normalizeText_(value) {
  return String(value == null ? '' : value).trim().replace(/\\s+/g, ' ').toUpperCase();
}

function normalizePropertyKey_(value) {
  return normalizeText_(value).replace(/[^A-Z0-9]+/g, '');
}

/* =========================
   SHEET HELPERS
   ========================= */

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }

  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  const currentText = current.map(function(v) { return String(v).trim(); });

  headers.forEach(function(h, i) {
    if (currentText[i] !== h) {
      sheet.getRange(1, i + 1).setValue(h);
    }
  });

  sheet.setFrozenRows(1);
}

function headerMap_(headers) {
  const map = {};
  headers.forEach(function(h, i) {
    const key = String(h || '').trim().toUpperCase();
    if (key) map[key] = i;
  });
  return map;
}

function guruFromRow_(row, rowNumber, headers) {
  return {
    guruId: normalizeText_(row[headers.GURU_ID]),
    username: normalizeUsername_(row[headers.USERNAME]),
    passwordHash: String(row[headers.PASSWORD_HASH] || '').trim().toLowerCase(),
    nama: String(row[headers.NAMA] || '').trim(),
    role: normalizeText_(row[headers.ROLE]),
    status: normalizeText_(row[headers.STATUS]),
    row: rowNumber
  };
}

function updateGuruPassword_(rowNumber, passwordHash) {
  const sheet = getMasterSpreadsheet_().getSheetByName(APP.SHEETS.GURU);
  const headers = headerMap_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  sheet.getRange(rowNumber, headers.PASSWORD_HASH + 1).setValue(passwordHash);
}

/* =========================
   PUBLIC USER / PERMISSIONS
   ========================= */

function publicUser_(guru) {
  return {
    guruId: guru.guruId,
    username: guru.username,
    name: guru.nama,
    role: guru.role,
    status: guru.status
  };
}

function permissionsForRole_(role) {
  if (role === APP.ROLES.ADMIN) {
    return {
      inputNilai: true,
      monitoring: true,
      raportAsli: true,
      manageGuru: true
    };
  }

  if (role === APP.ROLES.WALI_KELAS) {
    return {
      inputNilai: true,
      monitoring: true,
      raportAsli: true,
      manageGuru: false
    };
  }

  return {
    inputNilai: true,
    monitoring: true,
    raportAsli: false,
    manageGuru: false
  };
}

/* =========================
   LOG
   ========================= */

function logActivity_(guruId, username, action, target, status, detail) {
  try {
    const sheet = getMasterSpreadsheet_().getSheetByName(APP.SHEETS.LOG);
    if (!sheet) return;

    sheet.appendRow([
      new Date(),
      guruId || '',
      username || '',
      action || '',
      target || '',
      status || '',
      detail || ''
    ]);
  } catch (err) {
    console.error('LOG FAILED', err);
  }
}

/* =========================
   RESPONSE
   ========================= */

function ok_(data) {
  return {
    success: true,
    data: data
  };
}

function fail_(code, message) {
  return {
    success: false,
    error: code,
    message: message
  };
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error('Body request harus berupa JSON.');
  }
}

function AuthError_(code, message) {
  this.name = 'AuthError';
  this.code = code;
  this.message = message;
}
AuthError_.prototype = Object.create(Error.prototype);
AuthError_.prototype.constructor = AuthError_;
