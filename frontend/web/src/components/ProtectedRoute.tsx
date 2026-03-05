import { useAuth } from '@/lib/auth-context'
import { Navigate, Outlet } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

/**
 * ProtectedRoute wraps all pages that require authentication.
 * 
 * Flow:
 * 1. While checking session (isLoading) → show spinner
 * 2. Not authenticated → redirect to /login
 * 3. Authenticated → render the child page (via <Outlet />)
 * 
 * Usage in your route tree:
 *   <Route component={ProtectedRoute}>
 *     <Route path="dashboard" component={Dashboard} />
 *     <Route path="trucks" component={Trucks} />
 *   </Route>
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  // Still checking if there's an active session — show a full screen spinner
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  // No valid session — redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  // Valid session — render the child route
  return <Outlet />
}
