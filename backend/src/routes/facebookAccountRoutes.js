const express = require('express');
const router = express.Router();
const FacebookAccount = require('../models/FacebookAccount');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * FacebookAccount Routes
 * 
 * POST   /api/facebook-accounts - Kết nối tài khoản Facebook mới
 * GET    /api/facebook-accounts - Lấy danh sách tài khoản Facebook
 * GET    /api/facebook-accounts/:id - Lấy chi tiết tài khoản
 * PUT    /api/facebook-accounts/:id - Cập nhật token/cookie
 * DELETE /api/facebook-accounts/:id - Xóa tài khoản Facebook
 * POST   /api/facebook-accounts/:id/refresh - Refresh token
 */

/**
 * POST /api/facebook-accounts
 * Kết nối tài khoản Facebook mới
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const {
            name,
            facebookId,
            email,
            profileUrl,
            avatarUrl,
            accessToken,
            cookie,
            expiresIn,
            permissions,
            scopes
        } = req.body;
        
        // Validate required fields
        if (!name || !facebookId || !accessToken) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc (name, facebookId, accessToken)'
            });
        }
        
        // Check if facebookId already exists
        const existingAccount = await FacebookAccount.findOne({ facebookId });
        
        if (existingAccount) {
            return res.status(400).json({
                success: false,
                message: 'Tài khoản Facebook này đã được kết nối'
            });
        }
        
        // Calculate token expiration (default 60 days)
        const tokenExpiresAt = new Date(Date.now() + (expiresIn || 5184000) * 1000);
        
        // Create Facebook account
        const fbAccount = await FacebookAccount.create({
            name,
            userId: req.userId,
            facebookId,
            email,
            profileUrl,
            avatarUrl,
            accessToken,
            cookie: cookie ? (typeof cookie === 'string' ? cookie : JSON.stringify(cookie)) : null,
            tokenExpiresAt,
            permissions: permissions || [],
            scopes: scopes || [],
            connectedFromIP: req.clientIP || req.ip,
            userAgent: req.headers['user-agent']
        });
        
        return res.status(201).json({
            success: true,
            message: 'Kết nối tài khoản Facebook thành công',
            data: fbAccount.toSafeObject()
        });
        
    } catch (error) {
        console.error('❌ Connect Facebook account error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Tài khoản Facebook đã tồn tại'
            });
        }
        
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * GET /api/facebook-accounts
 * Lấy danh sách tài khoản Facebook
 * Admin: Xem tất cả
 * User: Chỉ xem của mình
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { isActive, userId: queryUserId } = req.query;
        
        let query = {};
        
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        if (req.user.role === 'admin') {
            if (queryUserId) {
                query.userId = queryUserId;
            }
        } else {
            query.userId = req.user._id;
        }

        const accounts = await FacebookAccount.find(query)
            .sort({ createdAt: -1 })
            .populate('userId', 'username fullName')
            .select('-accessToken -cookie -fb_dtsg -jazoest -lsd -userAgent');

        return res.json({
            success: true,
            data: accounts
        });
        
    } catch (error) {
        console.error('❌ Get Facebook accounts error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * GET /api/facebook-accounts/:id
 * Lấy chi tiết tài khoản Facebook
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const account = await FacebookAccount.findById(req.params.id)
            .select('-accessToken -cookie')
            .populate('userId', 'username fullName');
        
        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản Facebook'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && account.userId._id.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xem tài khoản này'
            });
        }
        
        return res.json({
            success: true,
            data: account
        });
        
    } catch (error) {
        console.error('❌ Get Facebook account error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * PUT /api/facebook-accounts/:id
 * Cập nhật token/cookie
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const account = await FacebookAccount.findById(req.params.id);
        
        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản Facebook'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && account.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền cập nhật tài khoản này'
            });
        }
        
        const { name, accessToken, cookie, expiresIn, isActive } = req.body;
        
        // Update basic info
        if (name !== undefined) account.name = name;
        if (isActive !== undefined) account.isActive = isActive;
        
        // Update token/cookie
        if (accessToken) {
            await account.updateToken({
                accessToken,
                cookie,
                expiresIn: expiresIn || 5184000
            });
        }
        
        return res.json({
            success: true,
            message: 'Cập nhật tài khoản thành công',
            data: account.toSafeObject()
        });
        
    } catch (error) {
        console.error('❌ Update Facebook account error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * DELETE /api/facebook-accounts/:id
 * Xóa tài khoản Facebook
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const account = await FacebookAccount.findById(req.params.id);
        
        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản Facebook'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && account.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xóa tài khoản này'
            });
        }
        
        // Check if account is being used in any active campaigns
        const Campaign = require('../models/Campaign');
        const activeCampaigns = await Campaign.countDocuments({
            facebookAccountId: account._id,
            status: { $in: ['active', 'paused'] }
        });
        
        if (activeCampaigns > 0) {
            return res.status(400).json({
                success: false,
                message: `Không thể xóa tài khoản đang được sử dụng trong ${activeCampaigns} campaign`
            });
        }
        
        await account.deleteOne();
        
        return res.json({
            success: true,
            message: 'Xóa tài khoản Facebook thành công'
        });
        
    } catch (error) {
        console.error('❌ Delete Facebook account error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * POST /api/facebook-accounts/:id/refresh
 * Refresh token manually
 */
router.post('/:id/refresh', authenticate, async (req, res) => {
    try {
        const account = await FacebookAccount.findById(req.params.id);
        
        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản Facebook'
            });
        }
        
        // Check permission
        if (req.userRole !== 'admin' && account.userId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền refresh token'
            });
        }
        
        const { accessToken, cookie, expiresIn } = req.body;
        
        if (!accessToken) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu accessToken mới'
            });
        }
        
        await account.updateToken({
            accessToken,
            cookie,
            expiresIn: expiresIn || 5184000
        });
        
        return res.json({
            success: true,
            message: 'Refresh token thành công',
            data: account.toSafeObject()
        });
        
    } catch (error) {
        console.error('❌ Refresh token error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

module.exports = router;
