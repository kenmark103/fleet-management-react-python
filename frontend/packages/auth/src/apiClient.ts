import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from './tokenManager';

const API_URL = import.meta.env?.VITE_API_URL || process.env.VITE_API_URL;

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Attach access token
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.setAuthorization(`Bearer ${token}`);
  }
  return config;
});

// Refresh on 401
let _refreshing = false;
let _queue: Array<() => void> = [];

async function refreshToken() {
  if (_refreshing) {

    await new Promise<void>((resolve) => _queue.push(resolve));
    return;
  }
  _refreshing = true;
  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
    const newAccess = res.data?.access_token || res.data?.accessToken;
    if (newAccess) setAccessToken(newAccess);
  } catch {
    clearAccessToken();
    throw new Error('Refresh failed');
  } finally {
    _refreshing = false;
    _queue.forEach((fn) => fn());
    _queue = [];
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error?.response?.status === 401 && !original._retry) {
      try {
        original._retry = true;
        await refreshToken();
        return api(original);
      } catch (e) {
        // bubble up
      }
    }
    return Promise.reject(error);
  }
);