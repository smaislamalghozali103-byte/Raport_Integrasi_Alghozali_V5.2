export type Role = 'ADMIN' | 'WALI_KELAS' | 'GURU_MAPEL';

export interface AuthUser {
  sub: string;
  name: string;
  email?: string;
  picture?: string;
  role: Role;
  unit?: string;
  kelas?: string;
  mapel?: string[];
  sessionToken: string;
}

export interface BootstrapData {
  user: AuthUser;
  units: string[];
  kelas: string[];
  mapel: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}