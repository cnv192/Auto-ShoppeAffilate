/**
 * API utilities for admin
 * Centralized API configuration and functions
 */

import { getToken } from './authUtils'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const API_BASE_URL_WITH_API = `${API_BASE_URL}/api`

/**
 * Get full API URL for a given endpoint
 */
export const getApiUrl = (endpoint: string) => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
    return `${API_BASE_URL_WITH_API}/${cleanEndpoint}`
}

/**
 * Get base URL for short links
 */
export const getBaseUrl = () => {
    return process.env.NEXT_PUBLIC_SITE_URL || API_BASE_URL
}

export async function fetchApi<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getToken()
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE_URL}/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`, {
        ...options,
        headers,
    })

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || `API error: ${response.status}`)
    }

    return response.json()
}

// Links API
export async function getAllLinks() {
    return fetchApi('/links')
}

export async function getLinks() {
    return fetchApi('/links')
}

export async function createLink(data: any) {
    return fetchApi('/links', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateLink(slug: string, data: any) {
    return fetchApi(`/links/${slug}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    })
}

export async function deleteLink(slug: string) {
    return fetchApi(`/links/${slug}`, {
        method: 'DELETE',
    })
}

// Campaigns API
export async function getCampaigns() {
    return fetchApi('/campaigns')
}

export async function createCampaign(data: any) {
    return fetchApi('/campaigns', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateCampaign(id: string, data: any) {
    return fetchApi(`/campaigns/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    })
}

export async function deleteCampaign(id: string) {
    return fetchApi(`/campaigns/${id}`, {
        method: 'DELETE',
    })
}
