import type { ApiResponse, BootstrapData, LoginData, RaportViewData } from '../types';

const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL?.trim() ?? '';

async function request<T>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<ApiResponse<T>> {
  if (!API_URL) {
    return { success: false, error: 'CONFIG_MISSING', message: 'VITE_APPS_SCRIPT_URL belum dikonfigurasi.' };
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
    });
    if (!response.ok) {
      return { success: false, error: 'HTTP_ERROR', message: 'Server mengembalikan HTTP ' + response.status };
    }
    return await response.json() as ApiResponse<T>;
  } catch {
    return { success: false, error: 'NETWORK_ERROR', message: 'Tidak dapat terhubung ke server.' };
  }
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginData>('login', { username, password }),
  logout: (sessionToken: string) =>
    request<{ loggedOut: boolean }>('logout', { sessionToken }),
  bootstrap: (sessionToken: string) =>
    request<BootstrapData>('bootstrap', { sessionToken }),
  getClasses: (sessionToken: string) =>
    request<string[]>('getClasses', { sessionToken }),
  changePassword: (sessionToken: string, currentPassword: string, newPassword: string) =>
    request<{ changed: boolean; message?: string }>('changePassword', { sessionToken, currentPassword, newPassword }),
  raportAccess: (sessionToken: string, kelas: string) =>
    request<{ kelas: string; url: string }>('raportAccess', { sessionToken, kelas }),
  raportView: (sessionToken: string, kelas: string, sheetName?: string) =>
    request<RaportViewData>('raportView', { sessionToken, kelas, ...(sheetName ? { sheetName } : {}) }),
};
