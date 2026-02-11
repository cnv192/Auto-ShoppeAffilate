/**
 * Type definitions for API responses
 */

export interface Link {
  _id: string
  title: string
  url: string
  slug?: string
  description?: string
  imageUrl?: string // Field từ backend
  thumbnail?: string // Alias cho imageUrl
  category?: string
  tags?: string[]
  clicks?: number
  isCloaked?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Article extends Link {
  content?: string
  author?: string
  source?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination?: {
    total: number
    limit: number
    offset: number
    page: number
    pages: number
  }
  error?: string
}
