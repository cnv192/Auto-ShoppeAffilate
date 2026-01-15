import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Auth Service - Quản lý authentication
 */

class AuthService {
    constructor() {
        this.tokenKey = 'shoppe_auth_token';
        this.userKey = 'shoppe_user';
    }
    
    /**
     * Get auth token from localStorage
     * @returns {String|null}
     */
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }
    
    /**
     * Get current user from localStorage
     * @returns {Object|null}
     */
    getCurrentUser() {
        const userJson = localStorage.getItem(this.userKey);
        return userJson ? JSON.parse(userJson) : null;
    }
    
    /**
     * Save auth data to localStorage
     * @param {String} token
     * @param {Object} user
     */
    saveAuthData(token, user) {
        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.userKey, JSON.stringify(user));
    }
    
    /**
     * Clear auth data
     */
    clearAuthData() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
    }
    
    /**
     * Check if user is logged in
     * @returns {Boolean}
     */
    isAuthenticated() {
        return !!this.getToken();
    }
    
    /**
     * Check if current user is Admin
     * @returns {Boolean}
     */
    isAdmin() {
        const user = this.getCurrentUser();
        return user && user.role === 'admin';
    }
    
    /**
     * Login
     * @param {String} username
     * @param {String} password
     * @returns {Promise<Object>} - { token, user }
     */
    async login(username, password) {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
                username,
                password
            });
            
            if (response.data.success) {
                const { token, user } = response.data.data;
                this.saveAuthData(token, user);
                return { token, user };
            }
            
            throw new Error(response.data.message || 'Đăng nhập thất bại');
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message);
        }
    }
    
    /**
     * Logout
     */
    logout() {
        this.clearAuthData();
    }
    
    /**
     * Get current user from server
     * @returns {Promise<Object>}
     */
    async getMe() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
                headers: this.getAuthHeader()
            });
            
            if (response.data.success) {
                const user = response.data.data;
                localStorage.setItem(this.userKey, JSON.stringify(user));
                return user;
            }
            
            throw new Error('Failed to get user info');
        } catch (error) {
            if (error.response?.status === 401) {
                this.clearAuthData();
            }
            throw error;
        }
    }
    
    /**
     * Update current user profile
     * @param {Object} data - { fullName, email, phone, currentPassword, newPassword }
     * @returns {Promise<Object>}
     */
    async updateProfile(data) {
        try {
            const response = await axios.put(`${API_BASE_URL}/api/auth/me`, data, {
                headers: this.getAuthHeader()
            });
            
            if (response.data.success) {
                const user = response.data.data;
                localStorage.setItem(this.userKey, JSON.stringify(user));
                return user;
            }
            
            throw new Error(response.data.message || 'Cập nhật thất bại');
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message);
        }
    }
    
    /**
     * Get auth header for API requests
     * @returns {Object}
     */
    getAuthHeader() {
        const token = this.getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    }
    
    /**
     * Create axios instance with auth header
     * @returns {AxiosInstance}
     */
    getAxiosInstance() {
        return axios.create({
            baseURL: `${API_BASE_URL}/api`,
            headers: this.getAuthHeader()
        });
    }
}

// Export singleton instance
const authService = new AuthService();

export default authService;
