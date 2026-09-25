/**
 * RAPORT INTEGRASI AL-GHOZALI V5.2
 * Google Apps Script gateway
 *
 * Sumber:
 * - Akun: ID_SPREADSHEET_USERNAME_ID
 * - Penugasan guru: GURU_SMP_SMA_SPREADSHEET_ID
 * - Wali kelas: WALI_KELAS_SPREADSHEET_ID
 * - Kode mapel: DAFTAR_KODE_MAPEL_SPREADSHEET_ID
 * - RAPORT ASLI: RAPORT_KELAS_<KELAS>_ID
 *
 * Catatan:
 * - Frontend tidak mengirim/menentukan Spreadsheet ID, sheet, row, atau column.
 * - RAPORT ASLI hanya dibuka, tidak ditulis.
 * - Nilai hanya ditulis ke REKAP/REKAP NILAI.
 * - Tidak ada data dummy/fallback.
 */

const APP = {
  NAME: 'Raport Integrasi Al-Ghozali V5.2',
  SESSION_TTL: 21600,
  FAIL_TTL: 900,
  MAX_FAIL: 5,
  ROLE: { ADMIN:'ADMIN', WALI:'WALI_KELAS', MAPEL:'GURU_MAPEL' }
};

function doGet() {
  return json_({success:true,data:{app:APP.NAME,status:'OK',time:new Date().toISOString()}});
}

function doPost(e) {
  try {
    const b=parseRequest_(e), a=String(b.action||'').trim();
    switch(a) {
      case 'health': return json_(healthCheck());
      case 'login': return json_(login_(b));
      case 'logout': return json_(logout_(b));
      case 'bootstrap': return json_(bootstrap_(b));
      case 'changePassword': return json_(changePassword_(b));
      case 'raportAccess': return json_(raportAccess_(b));
      case 'raportView': return json_(raportView_(b));
      case 'getAssignments': return json_(getAssignmentsApi_(b));
      case 'getClasses': return json_(getClassesApi_(b));
      case 'saveNilai': return json_(saveNilai_(b));
      case 'monitoring': return json_(monitoring_(b));
      default: return json_(fail_('UNKNOWN_ACTION','Action tidak dikenal.'));
    }
  } catch(err) {
    console.error(err);
    return json_(fail_(err.code||'SERVER_ERROR',err.message||'Terjadi kesalahan server.'));
  }
}

/* ===== PUBLIC TESTS ===== */

function healthCheck() {
  const p=PropertiesService.getScriptProperties();
  const required=['ID_SPREADSHEET_USERNAME_ID','GURU_SMP_SMA_SPREADSHEET_ID','WALI_KELAS_SPREADSHEET_ID'];
  const props={};
  required.forEach(k=>props[k]=!!p.getProperty(k));
  let reports=0;
  p.getProperties() && Object.keys(p.getProperties()).forEach(k=>{
    if(/^RAPORT_KELAS_.+_ID$/.test(k) && p.getProperty(k)) reports++;
  });
  return ok_({status:'OK',properties:props,reportProperties:reports,time:new Date().toISOString()});
}

function TEST_KONEKSI() {
  const r=healthCheck();
  console.log(JSON.stringify(r,null,2));
  return r;
}

function testAllRaportIds() {
  const p=PropertiesService.getScriptProperties().getProperties(), out=[];
  Object.keys(p).filter(k=>/^RAPORT_KELAS_.+_ID$/.test(k)).sort().forEach(k=>{
    const id=p[k];
    try {
      const ss=SpreadsheetApp.openById(id);
      out.push({property:k,id:id,status:'OK',name:ss.getName()});
    } catch(e) {
      out.push({property:k,id:id,status:'ERROR',error:e.message});
    }
  });
  console.log(JSON.stringify(out,null,2));
  return out;
}

/* ===== AUTH ===== */

function login_(b) {
  const username=normalizeUsername_(b.username), password=String(b.password||'');
  if(!username||!password) return fail_('INVALID_LOGIN','Username dan password wajib diisi.');
  if(blocked_(username)) return fail_('TOO_MANY_ATTEMPTS','Terlalu banyak percobaan. Coba lagi beberapa menit.');

  const g=findAccountByUsername_(username);
  if(!g || g.status!=='AKTIF' || g.passwordHash!==sha256_(password)) {
    failLogin_(username); logActivity_(null,username,'LOGIN','FAILED','Username/password tidak valid.');
    return fail_('INVALID_LOGIN','Username atau password salah.');
  }
  clearFails_(username);
  const token=createSession_(g);
  logActivity_(g.id,g.username,'LOGIN','SUCCESS','Login berhasil.');
  return ok_({sessionToken:token,user:publicUser_(g),assignments:getAssignmentsForGuru_(g.nama)});
}

function logout_(b) {
  const s=getSession_(b.sessionToken);
  if(b.sessionToken) CacheService.getScriptCache().remove(sessionKey_(b.sessionToken));
  if(s) logActivity_(s.id,s.username,'LOGOUT','SUCCESS','Logout.');
  return ok_({loggedOut:true});
}

function bootstrap_(b) {
  const s=requireSession_(b.sessionToken), g=findAccountById_(s.id);
  if(!g||g.status!=='AKTIF') {invalidateSession_(b.sessionToken);return fail_('SESSION_REVOKED','Akun tidak aktif.');}
  return ok_({user:publicUser_(g),assignments:getAssignmentsForGuru_(g.nama),permissions:permissions_(g.role)});
}

function changePassword_(b) {
  const s=requireSession_(b.sessionToken), g=findAccountById_(s.id);
  const old=String(b.currentPassword||''), nw=String(b.newPassword||'');
  if(!g) return fail_('USER_NOT_FOUND','Akun tidak ditemukan.');
  if(nw.length<8) return fail_('WEAK_PASSWORD','Password baru minimal 8 karakter.');
  if(g.passwordHash!==sha256_(old)) return fail_('INVALID_PASSWORD','Password lama salah.');
  const sh=g.sheet, h=g.headers;
  sh.getRange(g.row,h.PASSWORD_HASH+1).setValue(sha256_(nw));
  invalidateSession_(b.sessionToken);
  logActivity_(g.id,g.username,'CHANGE_PASSWORD','SUCCESS','Password diubah.');
  return ok_({changed:true});
}

/* ===== RAPORT ACCESS ===== */

function raportAccess_(b) {
  const s=requireSession_(b.sessionToken), g=findAccountById_(s.id), kelas=normalizeClass_(b.kelas);
  if(!g) return fail_('USER_NOT_FOUND','Akun tidak ditemukan.');
  if(!kelas) return fail_('INVALID_CLASS','Kelas wajib dipilih.');
  if(g.role===APP.ROLE.MAPEL) {
    logActivity_(g.id,g.username,'RAPORT_ACCESS','FORBIDDEN','Guru mapel tidak boleh membuka RAPORT ASLI.');
    return fail_('FORBIDDEN','Guru mapel tidak memiliki akses RAPORT ASLI.');
  }
  if(g.role===APP.ROLE.WALI && !isWaliForClass_(g.nama,kelas)) {
    logActivity_(g.id,g.username,'RAPORT_ACCESS','FORBIDDEN','Kelas bukan kewenangan wali.');
    return fail_('FORBIDDEN','Anda hanya dapat membuka RAPORT ASLI kelas yang menjadi tanggung jawab Anda.');
  }
  const id=getRaportId_(kelas);
  if(!id) return fail_('RAPORT_NOT_CONFIGURED','Spreadsheet RAPORT kelas belum dikonfigurasi.');
  logActivity_(g.id,g.username,'RAPORT_ACCESS','SUCCESS','Akses RAPORT ASLI diberikan.');
  return ok_({kelas:kelas,url:'https://docs.google.com/spreadsheets/d/'+id+'/edit'});
}

/* ===== RAPORT VIEW ===== */

function raportView_(b) {
  const s=requireSession_(b.sessionToken), g=findAccountById_(s.id), kelas=normalizeClass_(b.kelas);
  if(!g) return fail_('USER_NOT_FOUND','Akun tidak ditemukan.');
  if(!kelas) return fail_('INVALID_CLASS','Kelas wajib dipilih.');

  if(g.role===APP.ROLE.MAPEL) {
    logActivity_(g.id,g.username,'RAPORT_VIEW','FORBIDDEN','Guru mapel mencoba membuka RAPORT ASLI.');
    return fail_('FORBIDDEN','Guru mapel tidak memiliki akses RAPORT ASLI.');
  }
  if(g.role===APP.ROLE.WALI && !isWaliForClass_(g.nama,kelas)) {
    logActivity_(g.id,g.username,'RAPORT_VIEW','FORBIDDEN','Kelas bukan kewenangan wali.');
    return fail_('FORBIDDEN','Anda hanya dapat membuka RAPORT ASLI kelas yang menjadi tanggung jawab Anda.');
  }

  const id=getRaportId_(kelas);
  if(!id) return fail_('RAPORT_NOT_CONFIGURED','Spreadsheet RAPORT kelas belum dikonfigurasi.');

  const ss=SpreadsheetApp.openById(id);
  const requested=String(b.sheetName||'').trim();
  const sheets=ss.getSheets().map(sh=>({
    name:sh.getName(),
    rows:Math.max(0,sh.getLastRow()),
    columns:Math.max(0,sh.getLastColumn())
  }));

  if(!sheets.length) return ok_({kelas,spreadsheetName:ss.getName(),activeSheet:'',sheets:[]});

  const activeName=requested && sheets.some(x=>x.name===requested) ? requested : sheets[0].name;
  const active=ss.getSheetByName(activeName);
  if(!active) return fail_('SHEET_NOT_FOUND','Sheet RAPORT tidak ditemukan.');

  const lastRow=active.getLastRow(), lastCol=active.getLastColumn();
  const values=lastRow && lastCol ? active.getRange(1,1,lastRow,lastCol).getDisplayValues() : [];
  logActivity_(g.id,g.username,'RAPORT_VIEW','SUCCESS','Membaca RAPORT ASLI kelas '+kelas+' sheet '+activeName+'.');

  return ok_({
    kelas,
    spreadsheetName:ss.getName(),
    activeSheet:activeName,
    sheets:sheets.map(item=>({
      name:item.name,
      rows:item.name===activeName ? values : []
    }))
  });
}

/* ===== ASSIGNMENT ===== */

function getAssignmentsApi_(b) {
  const s=requireSession_(b.sessionToken), g=findAccountById_(s.id);
  if(!g) return fail_('USER_NOT_FOUND','Akun tidak ditemukan.');
  return ok_(getAssignmentsForGuru_(g.nama));
}

function getClassesApi_(b) {
  const s=requireSession_(b.sessionToken), g=findAccountById_(s.id);
  if(!g) return fail_('USER_NOT_FOUND','Akun tidak ditemukan.');
  if(g.role===APP.ROLE.ADMIN) {
    const props=PropertiesService.getScriptProperties().getProperties();
    const classes=Object.keys(props)
      .filter(k=>/^RAPORT_KELAS_.+_ID$/.test(k)&&props[k])
      .map(k=>k.replace(/^RAPORT_KELAS_/,'').replace(/_ID$/,''))
      .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    return ok_(classes);
  }
  const a=getAssignmentsForGuru_(g.nama);
  return ok_([...new Set(a.map(x=>x.kelas).filter(Boolean))]);
}

function getAssignmentsForGuru_(nama) {
  const sh=findSheetByHeaders_(getByProperty_('GURU_SMP_SMA_SPREADSHEET_ID'),
    ['NAMA GURU','UNIT','MATA PELAJARAN','KELAS']);
  const startRow=Number(sh.__headerRow||1);
  const v=sh.getDataRange().getValues(), h=sh.__headerMap||headerMap_(v[startRow-1]), target=normalizeName_(nama);
  const waliClasses=new Set();
  try {
    const ws=findSheetByHeaders_(getByProperty_('WALI_KELAS_SPREADSHEET_ID'),['KELAS','NAMA WALI KELAS']);
    const wv=ws.getDataRange().getValues(), wh=ws.__headerMap||headerMap_(wv[(ws.__headerRow||1)-1]), wn=normalizeName_(nama);
    for(let i=(ws.__headerRow||1);i<wv.length;i++){
      if(normalizeName_(wv[i][wh['NAMA WALI KELAS']])===wn) waliClasses.add(normalizeClass_(wv[i][wh.KELAS]));
    }
  } catch(e) {}
  return v.slice(startRow).filter(r=>normalizeName_(r[h['NAMA GURU']])===target)
    .map(r=>({namaGuru:String(r[h['NAMA GURU']]).trim(),unit:String(r[h.UNIT]||'').trim(),
      mapel:String(r[h['MATA PELAJARAN']]||'').trim(),kelas:String(r[h.KELAS]||'').trim(),
      jumlahJam:h['JUMLAH JAM']!==undefined?r[h['JUMLAH JAM']]: '',
      isWaliKelas:waliClasses.has(normalizeClass_(r[h.KELAS]))}));
}

/* ===== INPUT NILAI ===== */

function saveNilai_(b) {
  const s=requireSession_(b.sessionToken), g=findAccountById_(s.id);
  const kelas=String(b.kelas||'').trim(), mapel=String(b.mapel||'').trim(), nisn=String(b.nisn||'').trim();
  const nilai=Number(b.nilai);
  if(!g) return fail_('USER_NOT_FOUND','Akun tidak ditemukan.');
  if(!kelas||!mapel||!nisn||!Number.isFinite(nilai)||nilai<0||nilai>100)
    return fail_('INVALID_DATA','Kelas, mapel, NISN, dan nilai 0-100 wajib valid.');

  if(g.role!==APP.ROLE.ADMIN) {
    const allowed=getAssignmentsForGuru_(g.nama).some(a=>
      normalizeClass_(a.kelas)===normalizeClass_(kelas) &&
      normalizeText_(a.mapel)===normalizeText_(mapel));
    if(!allowed) return fail_('FORBIDDEN','Anda tidak memiliki penugasan untuk kelas/mapel tersebut.');
  }

  const id=getRaportId_(kelas);
  if(!id) return fail_('RAPORT_NOT_CONFIGURED','Spreadsheet RAPORT kelas belum dikonfigurasi.');
  const ss=SpreadsheetApp.openById(id);
  const sh=findRekapSheet_(ss);
  if(!sh) return fail_('REKAP_NOT_FOUND','Sheet REKAP/REKAP NILAI tidak ditemukan.');

  const data=sh.getDataRange().getValues(), h=findHeaders_(data[0]);
  if(h.nisn<0) return fail_('NISN_COLUMN_NOT_FOUND','Kolom NISN tidak ditemukan.');
  const col=findSubjectColumn_(data[0],mapel);
  if(col<0) return fail_('MAPEL_COLUMN_NOT_FOUND','Kolom mata pelajaran tidak ditemukan di REKAP.');

  let row=-1;
  for(let i=1;i<data.length;i++) if(normalizeText_(data[i][h.nisn])===normalizeText_(nisn)){row=i+1;break;}
  if(row<0) return fail_('STUDENT_NOT_FOUND','NISN tidak ditemukan di REKAP.');

  sh.getRange(row,col+1).setValue(nilai);
  logActivity_(g.id,g.username,'SAVE_NILAI',kelas+' / '+mapel+' / '+nisn,'SUCCESS','Nilai disimpan.');
  return ok_({saved:true,kelas,mapel,nisn,nilai});
}

/* ===== MONITORING ===== */

function monitoring_(b) {
  const s=requireSession_(b.sessionToken), g=findAccountById_(s.id), kelas=String(b.kelas||'').trim();
  if(!g) return fail_('USER_NOT_FOUND','Akun tidak ditemukan.');
  if(g.role===APP.ROLE.MAPEL) {
    const mapel=String(b.mapel||'').trim();
    if(!getAssignmentsForGuru_(g.nama).some(a=>normalizeClass_(a.kelas)===normalizeClass_(kelas)&&normalizeText_(a.mapel)===normalizeText_(mapel)))
      return fail_('FORBIDDEN','Anda tidak memiliki akses monitoring ini.');
  }
  const id=getRaportId_(kelas); if(!id) return fail_('RAPORT_NOT_CONFIGURED','Spreadsheet RAPORT belum dikonfigurasi.');
  const sh=findRekapSheet_(SpreadsheetApp.openById(id)); if(!sh) return fail_('REKAP_NOT_FOUND','REKAP tidak ditemukan.');
  const v=sh.getDataRange().getValues(); if(!v.length) return ok_({kelas,headers:[],rows:[],total:0});
  return ok_({kelas,headers:v[0],rows:v.slice(1),total:Math.max(0,v.length-1)});
}

/* ===== WALI KELAS ===== */

function isWaliForClass_(nama,kelas) {
  const sh=findSheetByHeaders_(getByProperty_('WALI_KELAS_SPREADSHEET_ID'),['KELAS','NAMA WALI KELAS']);
  const v=sh.getDataRange().getValues(), startRow=Number(sh.__headerRow||1), h=sh.__headerMap||headerMap_(v[startRow-1]), n=normalizeName_(nama), k=normalizeClass_(kelas);
  return v.slice(startRow).some(r=>normalizeName_(r[h['NAMA WALI KELAS']])===n&&normalizeClass_(r[h.KELAS])===k);
}

/* ===== DATA / SHEET HELPERS ===== */

function findAccountByUsername_(username) {
  const sh=findSheetByHeaders_(getByProperty_('ID_SPREADSHEET_USERNAME_ID'),
    ['ID_GURU','NAMA_GURU','USERNAME','PASSWORD_HASH','ROLE','STATUS']);
  return accountFromSheet_(sh,username,'USERNAME');
}
function findAccountById_(id) {
  const sh=findSheetByHeaders_(getByProperty_('ID_SPREADSHEET_USERNAME_ID'),
    ['ID_GURU','NAMA_GURU','USERNAME','PASSWORD_HASH','ROLE','STATUS']);
  return accountFromSheet_(sh,id,'ID_GURU');
}
function accountFromSheet_(sh,key,field) {
  const v=sh.getDataRange().getValues(), startRow=Number(sh.__headerRow||1);
  if(v.length<startRow+0) return null;
  const h=sh.__headerMap||headerMap_(v[startRow-1]), want=field==='USERNAME'?normalizeUsername_(key):normalizeText_(key);
  for(let i=startRow;i<v.length;i++){
    const got=field==='USERNAME'?normalizeUsername_(v[i][h[field]]):normalizeText_(v[i][h[field]]);
    if(got===want) return {id:normalizeText_(v[i][h.ID_GURU]),nama:String(v[i][h.NAMA_GURU]||'').trim(),
      username:normalizeUsername_(v[i][h.USERNAME]),passwordHash:String(v[i][h.PASSWORD_HASH]||'').trim().toLowerCase(),
      role:normalizeText_(v[i][h.ROLE]),status:normalizeText_(v[i][h.STATUS]),row:i+1,sheet:sh,headers:h};
  }
  return null;
}

function findSheetByHeaders_(id,required) {
  if(!id) throw new Error('Spreadsheet ID belum dikonfigurasi.');
  const ss=SpreadsheetApp.openById(id);
  const sheets=ss.getSheets();
  for(const sh of sheets){
    const max=Math.min(12,Math.max(1,sh.getLastRow()));
    if(!max) continue;
    const rows=sh.getRange(1,1,max,Math.max(1,sh.getLastColumn())).getValues();
    for(let r=0;r<rows.length;r++){
      const h=headerMap_(rows[r]);
      if(required.every(x=>h[x]!==undefined)) return shWithHeaderRow_(sh,r+1,h);
    }
  }
  throw new Error('Sheet dengan kolom wajib tidak ditemukan: '+required.join(', '));
}

function shWithHeaderRow_(sh,row,h){ sh.__headerRow=row; sh.__headerMap=h; return sh; }

function findRekapSheet_(ss) {
  for(const sh of ss.getSheets()){
    const name=normalizeText_(sh.getName());
    if(name==='REKAP'||name==='REKAP NILAI') return sh;
  }
  return null;
}

function findHeaders_(row) {
  const m=headerMap_(row);
  return {nisn:m['NISN']!==undefined?m['NISN']:-1};
}

function findSubjectColumn_(headers,mapel) {
  const target=normalizeText_(mapel);
  for(let i=0;i<headers.length;i++) if(normalizeText_(headers[i])===target) return i;
  return -1;
}

function headerMap_(row) {
  const m={}; row.forEach((x,i)=>{const k=normalizeHeader_(x);if(k)m[k]=i;}); return m;
}
function normalizeHeader_(x){return String(x==null?'':x).trim().replace(/\s+/g,' ').toUpperCase();}
function normalizeText_(x){return normalizeHeader_(x);}
function normalizeUsername_(x){return String(x==null?'':x).trim().toLowerCase();}
function normalizeName_(x){return normalizeText_(x).replace(/[^A-Z0-9]+/g,'');}
function normalizeClass_(x){return normalizeText_(x).replace(/[^A-Z0-9]+/g,'');}
function getRaportId_(kelas){return PropertiesService.getScriptProperties().getProperty('RAPORT_KELAS_'+normalizeClass_(kelas)+'_ID');}
function getByProperty_(k){const v=PropertiesService.getScriptProperties().getProperty(k);if(!v)throw new Error(k+' belum diset di Script Properties.');return v;}
function isTrue_(x){return ['TRUE','YA','YES','1'].includes(normalizeText_(x));}

/* ===== SESSION / SECURITY ===== */

function createSession_(g){
  const t=Utilities.getUuid()+'-'+Utilities.getUuid();
  CacheService.getScriptCache().put('SESSION_'+t,JSON.stringify({id:g.id,username:g.username,role:g.role,at:Date.now()}),APP.SESSION_TTL);
  return t;
}
function getSession_(t){if(!t)return null;const x=CacheService.getScriptCache().get('SESSION_'+t);if(!x)return null;try{return JSON.parse(x)}catch(e){return null}}
function requireSession_(t){const s=getSession_(String(t||''));if(!s)throw new AuthError_('UNAUTHORIZED','Session tidak valid atau kedaluwarsa.');return s;}
function invalidateSession_(t){if(t)CacheService.getScriptCache().remove('SESSION_'+t);}
function sessionKey_(t){return 'SESSION_'+t;}
function blocked_(u){const x=CacheService.getScriptCache().get('FAIL_'+u);return x?Number(x)>=APP.MAX_FAIL:false;}
function failLogin_(u){const c=CacheService.getScriptCache(),k='FAIL_'+u,n=Number(c.get(k)||0)+1;c.put(k,String(n),APP.FAIL_TTL);}
function clearFails_(u){CacheService.getScriptCache().remove('FAIL_'+u);}

function sha256_(v){
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(v),Utilities.Charset.UTF_8)
    .map(b=>{const n=b<0?b+256:b;return ('0'+n.toString(16)).slice(-2)}).join('');
}
function publicUser_(g){return {guruId:g.id,username:g.username,name:g.nama,role:g.role,status:g.status};}
function permissions_(r){
  if(r===APP.ROLE.ADMIN)return {inputNilai:true,monitoring:true,raportAsli:true,manageGuru:true};
  if(r===APP.ROLE.WALI)return {inputNilai:true,monitoring:true,raportAsli:true,manageGuru:false};
  return {inputNilai:true,monitoring:true,raportAsli:false,manageGuru:false};
}

/* ===== LOG ===== */

function logActivity_(id,user,action,status,detail){
  try{
    const p=PropertiesService.getScriptProperties(), idLog=p.getProperty('LOG_SPREADSHEET_ID')||p.getProperty('ID_SPREADSHEET_USERNAME_ID');
    const ss=SpreadsheetApp.openById(idLog), sh=ss.getSheetByName('LOG_AKTIVITAS')||ss.insertSheet('LOG_AKTIVITAS');
    if(sh.getLastRow()===0)sh.appendRow(['TIMESTAMP','GURU_ID','USERNAME','ACTION','STATUS','DETAIL']);
    sh.appendRow([new Date(),id||'',user||'',action||'',status||'',detail||'']);
  }catch(e){console.error('LOG FAILED: '+e.message);}
}

/* ===== RESPONSE ===== */

function ok_(data){return {success:true,data:data};}
function fail_(code,msg){return {success:false,error:code,message:msg};}
function json_(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);}
function parseRequest_(e){if(!e||!e.postData||!e.postData.contents)return {};try{return JSON.parse(e.postData.contents)}catch(err){throw new Error('Body request harus JSON.');}}
function AuthError_(code,message){this.name='AuthError';this.code=code;this.message=message;}
AuthError_.prototype=Object.create(Error.prototype);
AuthError_.prototype.constructor=AuthError_;
