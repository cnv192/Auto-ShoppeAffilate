/**
 * API Client for Next.js Admin
 * Wrapper around fetch with token handling
 */

import { authService } from './authService'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface ApiOptions extends RequestInit {
  skipAuth?: boolean
}

export async function apiCall<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  }

  if (!skipAuth) {
    const token = authService.getToken()
    if (token) {
      const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${token}`);
        options.headers = headers;
    }
  }

  const url = endpoint.startsWith('http') 
    ? endpoint 
    : `${API_BASE_URL}/api${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || `API Error: ${response.status}`)
  }

  return data
}

export const apiClient = {
  get: <T>(endpoint: string, options?: ApiOptions) =>
    apiCall<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: any, options?: ApiOptions) =>
    apiCall<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),

  put: <T>(endpoint: string, body?: any, options?: ApiOptions) =>
    apiCall<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),

  delete: <T>(endpoint: string, options?: ApiOptions) =>
    apiCall<T>(endpoint, { ...options, method: 'DELETE' }),
}
