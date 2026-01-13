/**
 * Link Routes
 * 
 * Định nghĩa các API endpoints cho việc quản lý links
 */

const express = require('express');
const router = express.Router();
const linkService = require('../services/linkService');
const { getClickCount } = require('../middleware/smartRouting');

/**
 * GET /api/links
 * Lấy danh sách tất cả links
 */
router.get('/', async (req, res) => {
    try {
        const links = await linkService.getAllLinks();
        res.json({
            success: true,
            data: links,
            total: links.length
        });
    } catch (error) {
        console.error('Error getting links:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể lấy danh sách links'
        });
    }
});

/**
 * GET /api/links/:slug
 * Lấy thông tin chi tiết một link
 */
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const link = await linkService.getLinkBySlug(slug);
        
        if (!link) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy link'
            });
        }
        
        res.json({
            success: true,
            data: link
        });
    } catch (error) {
        console.error('Error getting link:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể lấy thông tin link'
        });
    }
});

/**
 * GET /api/links/:slug/stats
 * Lấy thống kê của một link
 */
router.get('/:slug/stats', async (req, res) => {
    try {
        const { slug } = req.params;
        const stats = await linkService.getLinkStats(slug);
        
        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy link'
            });
        }
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting link stats:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể lấy thống kê'
        });
    }
});

/**
 * POST /api/links
 * Tạo link mới
 */
router.post('/', async (req, res) => {
    try {
        const { title, targetUrl, imageUrl, customSlug } = req.body;
        
        // Validation
        if (!targetUrl) {
            return res.status(400).json({
                success: false,
                error: 'URL đích là bắt buộc'
            });
        }
        
        // Validate URL format
        try {
            new URL(targetUrl);
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: 'URL không hợp lệ'
            });
        }
        
        const link = await linkService.createLink({
            title,
            targetUrl,
            imageUrl,
            customSlug
        });
        
        res.status(201).json({
            success: true,
            data: link,
            message: 'Tạo link thành công'
        });
    } catch (error) {
        console.error('Error creating link:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể tạo link'
        });
    }
});

/**
 * PUT /api/links/:slug
 * Cập nhật link
 */
router.put('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { title, targetUrl, imageUrl, isActive } = req.body;
        
        // Validate URL if provided
        if (targetUrl) {
            try {
                new URL(targetUrl);
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    error: 'URL không hợp lệ'
                });
            }
        }
        
        const updatedLink = await linkService.updateLink(slug, {
            title,
            targetUrl,
            imageUrl,
            isActive
        });
        
        if (!updatedLink) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy link'
            });
        }
        
        res.json({
            success: true,
            data: updatedLink,
            message: 'Cập nhật link thành công'
        });
    } catch (error) {
        console.error('Error updating link:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể cập nhật link'
        });
    }
});

/**
 * DELETE /api/links/:slug
 * Xóa link
 */
router.delete('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const deleted = await linkService.deleteLink(slug);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy link'
            });
        }
        
        res.json({
            success: true,
            message: 'Xóa link thành công'
        });
    } catch (error) {
        console.error('Error deleting link:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể xóa link'
        });
    }
});

module.exports = router;
