export type Role = 'ADMIN' | 'WALI_KELAS' | 'GURU_MAPEL';

export interface AuthUser {
  guruId: string;
  username: string;
  name: string;
  role: Role;
  status: string;
}

export interface Assignment {
  unit: string;
  kelas: string;
  mapel: string;
  isWaliKelas: boolean;
}

export interface Permissions {
  inputNilai: boolean;
  monitoring: boolean;
  raportAsli: boolean;
  manageGuru: boolean;
}

export interface BootstrapData {
  user: AuthUser;
  assignments: Assignment[];
  permissions: Permissions;
}

export interface LoginData {
  sessionToken: string;
  user: AuthUser;
  assignments: Assignment[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}


export interface RaportSheetView {
  name: string;
  headers: string[];
  rows: unknown[][];
}

export interface RaportViewData {
  kelas: string;
  spreadsheetName: string;
  activeSheet: string;
  sheets: RaportSheetView[];
}
