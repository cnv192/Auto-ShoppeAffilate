/**
 * API Configuration
 */

export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 10000,
}

/**
 * Fetch options for server-side requests
 */
export const fetchOptions = {
  noStore: {
    cache: 'no-store' as const,
  },
  revalidate5m: {
    next: { revalidate: 300 }, // 5 minutes
  },
  revalidate1h: {
    next: { revalidate: 3600 }, // 1 hour
  },
  revalidate24h: {
    next: { revalidate: 86400 }, // 24 hours
  },
} as const
