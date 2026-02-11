/**
 * Auth Service for Next.js Admin
 * Handles token management and API calls
 */

interface LoginResponse {
  success: boolean
  token: string
  user: {
    _id: string
    username: string
    email: string
    fullName: string
    displayName?: string
    role: 'admin' | 'user'
    avatar?: string
  }
}

export class AuthService {
  private tokenKey = 'shoppe_auth_token'
  private userKey = 'shoppe_user'

  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(this.tokenKey)
  }

  getCurrentUser() {
    if (typeof window === 'undefined') return null
    const userJson = localStorage.getItem(this.userKey)
    return userJson ? JSON.parse(userJson) : null
  }

  saveAuthData(token: string, user: any) {
    if (typeof window === 'undefined') return
    
    localStorage.setItem(this.tokenKey, token)
    localStorage.setItem(this.userKey, JSON.stringify(user))
    
    // Also save to cookie for middleware auth check
    document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Strict`
  }

  clearAuthData() {
    localStorage.removeItem(this.tokenKey)
    localStorage.removeItem(this.userKey)
    
    // Clear cookie
    document.cookie = 'token=; path=/; max-age=0'
  }

  isAuthenticated(): boolean {
    return !!this.getToken()
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser()
    return user?.role === 'admin'
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    // Use local API route that handles cookies
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Login failed')
    }

    this.saveAuthData(data.token, data.user)
    return data
  }

  logout() {
    this.clearAuthData()
  }
}

export const authService = new AuthService()

// Standalone functions for use in components
export function getToken(): string | null {
  return authService.getToken()
}

export function getCurrentUser() {
  return authService.getCurrentUser()
}

export function logout() {
  authService.logout()
}

export function isAuthenticated(): boolean {
  return authService.isAuthenticated()
}

export function isAdmin(): boolean {
  return authService.isAdmin()
}
