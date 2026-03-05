import axios from 'axios'

/**
 * Central axios instance.
 * withCredentials: true — browser attaches the HttpOnly cookie on every request.
 * Without this, cookies are silently ignored and every request returns 401.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Response interceptor — silent token refresh.
 *
 * When any request gets a 401 (access token expired):
 * 1. Call /auth/refresh — backend rotates the access_token cookie
 * 2. Retry the original request automatically
 * 3. If refresh also fails, redirect to login
 *
 * The user never sees an error for a simple token expiry.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    const skipRefresh = ['/auth/token', '/auth/refresh', '/auth/me']
    if (skipRefresh.some(url => original.url?.includes(url))) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        await api.post('/auth/refresh')
        return api(original)
      } catch {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    }

    return Promise.reject(error)
  }
)

export default api