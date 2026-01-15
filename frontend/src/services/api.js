/**
 * API Service
 * 
 * Xử lý các API calls đến Backend
 */

import axios from 'axios';
import authService from './authService';

// Base URL của Backend API
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Axios instance với config mặc định
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor để tự động thêm token vào header
api.interceptors.request.use(
    (config) => {
        const token = authService.getToken();
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);


/**
 * Lấy danh sách tất cả links
 * @returns {Promise<Array>} - Danh sách links
 */
export const getAllLinks = async () => {
    try {
        const response = await api.get('/api/links');
        // API returns { success: true, data: [...] }
        return response.data.data || response.data || [];
    } catch (error) {
        console.error('Error fetching links:', error);
        throw error;
    }
};

/**
 * Lấy thông tin một link
 * @param {string} slug - Slug của link
 * @returns {Promise<Object>} - Thông tin link
 */
export const getLinkBySlug = async (slug) => {
    try {
        const response = await api.get(`/api/links/${slug}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching link:', error);
        throw error;
    }
};

/**
 * Lấy thống kê của một link
 * @param {string} slug - Slug của link
 * @returns {Promise<Object>} - Thống kê
 */
export const getLinkStats = async (slug) => {
    try {
        const response = await api.get(`/api/links/${slug}/stats`);
        return response.data;
    } catch (error) {
        console.error('Error fetching link stats:', error);
        throw error;
    }
};

/**
 * Tạo link mới
 * @param {Object} linkData - Dữ liệu link
 * @returns {Promise<Object>} - Link đã tạo
 */
export const createLink = async (linkData) => {
    try {
        const response = await api.post('/api/links', linkData);
        return response.data;
    } catch (error) {
        console.error('Error creating link:', error);
        throw error;
    }
};

/**
 * Cập nhật link
 * @param {string} slug - Slug của link
 * @param {Object} updateData - Dữ liệu cập nhật
 * @returns {Promise<Object>} - Link đã cập nhật
 */
export const updateLink = async (slug, updateData) => {
    try {
        const response = await api.put(`/api/links/${slug}`, updateData);
        return response.data;
    } catch (error) {
        console.error('Error updating link:', error);
        throw error;
    }
};

/**
 * Xóa link
 * @param {string} slug - Slug của link
 * @returns {Promise<Object>} - Kết quả xóa
 */
export const deleteLink = async (slug) => {
    try {
        const response = await api.delete(`/api/links/${slug}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting link:', error);
        throw error;
    }
};

export default api;
