/**
 * Auth utilities for Next.js Admin
 * Manages token and user data in localStorage (client-side only)
 */

const TOKEN_KEY = 'shoppe_auth_token'
const USER_KEY = 'shoppe_user'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getCurrentUser(): any {
  if (typeof window === 'undefined') return null
  const userJson = localStorage.getItem(USER_KEY)
  return userJson ? JSON.parse(userJson) : null
}

export function saveAuthData(token: string, user: any) {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuthData() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function isAdmin(): boolean {
  const user = getCurrentUser()
  return user && user.role === 'admin'
}

export async function login(username: string, password: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  
  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.message || 'Login failed')
  }

  if (data.success && data.token && data.user) {
    saveAuthData(data.token, data.user)
    return { token: data.token, user: data.user }
  }

  throw new Error('Invalid response')
}

export function logout() {
  clearAuthData()
}
