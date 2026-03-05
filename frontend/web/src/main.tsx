import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen' 
import { useAuth, AuthProvider } from '@/lib/auth-context'
import './index.css'
import "leaflet/dist/leaflet.css";

/**
 * QueryClient lives outside InnerApp so it's created once and never
 * recreated on re-renders. If it were inside InnerApp, every auth
 * state change would wipe the entire cache.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,  // data stays fresh 2 min before refetching
      retry: 1,                    // retry failed requests once before showing error
    },
  },
})

function InnerApp() {
  const auth = useAuth()

  const router = createRouter({
    routeTree,
    context: { auth },
    scrollRestoration: true,  
  })

  return <RouterProvider router={router} context={{ auth }} />
}

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* AuthProvider must wrap InnerApp so useAuth() works inside it */}
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
)