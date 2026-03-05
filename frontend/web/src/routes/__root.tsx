import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AuthProvider } from '@/lib/auth-context'
import type { ErrorComponentProps } from '@tanstack/react-router'

function RootErrorBoundary({ error }: ErrorComponentProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
        <p className="text-sm text-slate-500">{error.message}</p>
        <button
          onClick={() => window.location.href = '/'}
          className="text-sm text-blue-600 hover:underline"
        >
          Go home
        </button>
      </div>
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootErrorBoundary,
})

function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}