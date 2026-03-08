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
 * Redirects to /login and returns a Promise that never resolves.
 *
 * The never-resolving promise is intentional: after a redirect is triggered
 * we do NOT want the original caller to receive a rejection, which would
 * cause components to flash an error state for the fraction of a second
 * before the page navigates away. Swallowing the promise here is safe
 * because the page is about to be replaced.
 */
function redirectToLogin(): Promise<never> {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
  // Never resolves — suppresses error UI while the redirect is in flight.
  return new Promise(() => {})
}

/**
 * Response interceptor — silent token refresh.
 *
 * Flow for a 401 on a protected route:
 *   1. POST /auth/refresh — backend rotates the access_token cookie
 *   2. Retry the original request once (_retry flag prevents loops)
 *   3. If refresh itself fails → redirect to /login, suppress error UI
 *
 * Auth endpoints (/auth/token, /auth/refresh, /auth/me) are skipped for
 * the refresh attempt to prevent infinite loops, but a 401 from any of
 * them except /auth/me also triggers a redirect (a 401 from /auth/me on
 * initial page load just means "not logged in" — the route guard handles
 * that case, no redirect needed here).
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const status   = error.response?.status
    const url      = original?.url ?? ''

    // ── Endpoints that must never trigger a refresh attempt ──────────────
    // /auth/refresh and /auth/token: looping would be catastrophic.
    // /auth/me: a 401 here on initial load means "not authenticated yet" —
    //   handled by the AuthProvider / route guard, not the interceptor.
    const noRefreshUrls = ['/auth/token', '/auth/refresh', '/auth/me']
    const isNoRefresh   = noRefreshUrls.some(u => url.includes(u))

    if (status !== 401) {
      // Not a 401 — pass through as a normal error.
      return Promise.reject(error)
    }

    if (isNoRefresh) {
      // 401 on a no-refresh URL.
      // /auth/me → let AuthProvider handle it (sets user = null → route guard redirects).
      // /auth/token or /auth/refresh → session is fully expired, redirect now.
      if (url.includes('/auth/me')) {
        return Promise.reject(error)
      }
      return redirectToLogin()
    }

    // ── Standard 401 on a protected route ────────────────────────────────
    if (!original._retry) {
      original._retry = true
      try {
        await api.post('/auth/refresh')
        // Refresh succeeded — retry the original request transparently.
        return api(original)
      } catch {
        // Refresh token is also expired → full logout.
        return redirectToLogin()
      }
    }

    // _retry was already true — the retried request itself got a 401.
    // This shouldn't happen under normal circumstances (refresh would have
    // caught it), but handle it defensively.
    return redirectToLogin()
  }
)

export default api