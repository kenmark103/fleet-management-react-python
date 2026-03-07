import axios from 'axios'

/**
 * Central axios instance.
 *
 * baseURL resolution:
 *   - Local dev (no docker): VITE_API_URL unset → baseURL = '' → Vite proxy handles /auth and /api/v1
 *   - Docker:                VITE_API_URL = 'http://web:8000' → docker service name
 *   - Production (Vercel):   VITE_API_URL = 'https://your-app.onrender.com' → direct to Render
 *
 * withCredentials: true — browser attaches the HttpOnly cookie on every request.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
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
 * All hooks using this instance get this protection automatically.
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