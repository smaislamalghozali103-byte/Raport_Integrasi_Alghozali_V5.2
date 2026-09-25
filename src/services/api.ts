import type { ApiResponse, BootstrapData } from '../types';

const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL?.trim() ?? '';

async function request<T>(action: string, payload: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  if (!API_URL) {
    return { success: false, error: 'CONFIG_MISSING', message: 'VITE_APPS_SCRIPT_URL belum dikonfigurasi.' };
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
    });
    return await response.json() as ApiResponse<T>;
  } catch {
    return { success: false, error: 'NETWORK_ERROR', message: 'Tidak dapat terhubung ke server.' };
  }
}

export const api = {
  loginGoogle: (credential: string) =>
    request<{ sessionToken: string; bootstrap: BootstrapData }>('googleLogin', { credential }),
  bootstrap: (sessionToken: string) =>
    request<BootstrapData>('bootstrap', { sessionToken }),
  saveNilai: (sessionToken: string, payload: Record<string, unknown>) =>
    request('saveNilai', { sessionToken, ...payload }),
  monitoring: (sessionToken: string, payload: Record<string, unknown> = {}) =>
    request('monitoring', { sessionToken, ...payload }),
  raportAccess: (sessionToken: string, kelas: string) =>
    request<{ url: string }>('raportAccess', { sessionToken, kelas }),
};