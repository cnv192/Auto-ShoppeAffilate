/**
 * API Configuration
 * 
 * Centralized configuration for API endpoints
 * All API URLs should be read from environment variables
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const API_BASE_URL_WITH_API = `${API_BASE_URL}/api`;

/**
 * Get full API URL for a given endpoint
 * @param {string} endpoint - API endpoint (e.g., '/links', '/campaigns')
 * @returns {string} Full API URL
 */
export const getApiUrl = (endpoint) => {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${API_BASE_URL_WITH_API}/${cleanEndpoint}`;
};

/**
 * Get base URL for short links
 */
export const getBaseUrl = () => {
    return process.env.REACT_APP_BASE_URL || API_BASE_URL;
};

const apiConfig = {
    BASE_URL: API_BASE_URL,
    API_URL: API_BASE_URL_WITH_API,
    getApiUrl,
    getBaseUrl
};

export default apiConfig;
