import authService from './authService';

/**
 * Campaign Service - Quản lý campaigns
 */

class CampaignService {
    /**
     * Get all campaigns
     * @param {Object} params - { status, page, limit }
     * @returns {Promise<Object>}
     */
    async getCampaigns(params = {}) {
        try {
            const api = authService.getAxiosInstance();
            const response = await api.get('/campaigns', { params });
            
            if (response.data.success) {
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Lỗi khi tải campaigns');
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message);
        }
    }
    
    /**
     * Get campaign by ID
     * @param {String} id
     * @returns {Promise<Object>}
     */
    async getCampaignById(id) {
        try {
            const api = authService.getAxiosInstance();
            const response = await api.get(`/campaigns/${id}`);
            
            if (response.data.success) {
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Không tìm thấy campaign');
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message);
        }
    }
    
    /**
     * Create new campaign
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async createCampaign(data) {
        try {
            const api = authService.getAxiosInstance();
            const response = await api.post('/campaigns', data);
            
            if (response.data.success) {
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Tạo campaign thất bại');
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message);
        }
    }
    
    /**
     * Update campaign
     * @param {String} id
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async updateCampaign(id, data) {
        try {
            const api = authService.getAxiosInstance();
            const response = await api.put(`/campaigns/${id}`, data);
            
            if (response.data.success) {
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Cập nhật campaign thất bại');
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message);
        }
    }
    
    /**
     * Delete campaign
     * @param {String} id
     * @returns {Promise<void>}
     */
    async deleteCampaign(id) {
        try {
            const api = authService.getAxiosInstance();
            const response = await api.delete(`/campaigns/${id}`);
            
            if (!response.data.success) {
                throw new Error(response.data.message || 'Xóa campaign thất bại');
            }
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message);
        }
    }
    
    /**
     * Start campaign
     * @param {String} id
     * @returns {Promise<Object>}
     */
    async startCampaign(id) {
        try {
            const api = authService.getAxiosInstance();
            const response = await api.post(`/campaigns/${id}/start`);
            
            if (response.data.success) {
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Start campaign thất bại');
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message);
        }
    }
    
    /**
     * Pause campaign
     * @param {String} id
     * @returns {Promise<Object>}
     */
    async pauseCampaign(id) {
        try {
            const api = authService.getAxiosInstance();
            const response = await api.post(`/campaigns/${id}/pause`);
            
            if (response.data.success) {
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Pause campaign thất bại');
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message);
        }
    }
    
    /**
     * Resume campaign
     * @param {String} id
     * @returns {Promise<Object>}
     */
    async resumeCampaign(id) {
        try {
            const api = authService.getAxiosInstance();
            const response = await api.post(`/campaigns/${id}/resume`);
            
            if (response.data.success) {
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Resume campaign thất bại');
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message);
        }
    }
    
    /**
     * Stop campaign
     * @param {String} id
     * @param {String} reason
     * @returns {Promise<Object>}
     */
    async stopCampaign(id, reason) {
        try {
            const api = authService.getAxiosInstance();
            const response = await api.post(`/campaigns/${id}/stop`, { reason });
            
            if (response.data.success) {
                return response.data.data;
            }
            
            throw new Error(response.data.message || 'Stop campaign thất bại');
        } catch (error) {
            throw new Error(error.response?.data?.message || error.message);
        }
    }
}

// Export singleton instance
const campaignService = new CampaignService();

export default campaignService;
