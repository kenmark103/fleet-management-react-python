import { createContext, useContext, useState, useEffect} from 'react'
import { getMe, loginUser, logoutUser, type User, type LoginCredentials } from '@/lib/auth-api'
import type { ReactNode } from 'react'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

/**
 * AuthProvider — wraps the whole app from __root.tsx.
 *
 * On mount: calls /auth/me to check for an existing session.
 *   - Cookie valid → user is restored, no login required
 *   - Cookie missing/expired → user is null → _auth layout redirects to /login
 *
 * isLoading stays true until that first check completes.
 * The _auth layout shows a spinner during this time.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))
  }, [])

  const login = async (credentials: LoginCredentials) => {
    const user = await loginUser(credentials)
    setUser(user)
  }

  const logout = async () => {
    await logoutUser()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/** useAuth — access auth state from any component */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
