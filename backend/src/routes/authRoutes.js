const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, requireAdmin, generateAuthResponse } = require('../middleware/auth');

/**
 * Auth Routes
 * 
 * POST /api/auth/login - Đăng nhập
 * POST /api/auth/logout - Đăng xuất (optional)
 * GET  /api/auth/me - Lấy thông tin user hiện tại
 * POST /api/auth/refresh - Refresh token (optional)
 * 
 * Admin only:
 * POST /api/auth/users - Tạo user mới
 * GET  /api/auth/users - Lấy danh sách users
 * PUT  /api/auth/users/:id - Cập nhật user
 * DELETE /api/auth/users/:id - Xóa user (soft delete)
 */

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * POST /api/auth/login
 * Đăng nhập hệ thống
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập username và password'
            });
        }
        
        // Find user (include password)
        const user = await User.findByUsername(username);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Username hoặc password không đúng'
            });
        }
        
        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản đã bị vô hiệu hóa'
            });
        }
        
        // Compare password
        const isPasswordValid = await user.comparePassword(password);
        
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Username hoặc password không đúng'
            });
        }
        
        // Update last login
        const clientIP = req.clientIP || req.ip || req.connection.remoteAddress;
        await user.updateLastLogin(clientIP);
        
        // Generate token
        const authResponse = generateAuthResponse(user);
        
        return res.json({
            success: true,
            message: 'Đăng nhập thành công',
            data: authResponse
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// ============================================
// PROTECTED ROUTES
// ============================================

/**
 * GET /api/auth/me
 * Lấy thông tin user hiện tại
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        return res.json({
            success: true,
            data: req.user.toSafeObject()
        });
    } catch (error) {
        console.error('❌ Get me error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * PUT /api/auth/me
 * Cập nhật thông tin user hiện tại
 */
router.put('/me', authenticate, async (req, res) => {
    try {
        const { fullName, email, phone, currentPassword, newPassword } = req.body;
        
        const user = req.user;
        
        // Update basic info
        if (fullName !== undefined) user.fullName = fullName;
        if (email !== undefined) user.email = email;
        if (phone !== undefined) user.phone = phone;
        
        // Change password
        if (currentPassword && newPassword) {
            const isPasswordValid = await user.comparePassword(currentPassword);
            
            if (!isPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Password hiện tại không đúng'
                });
            }
            
            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password mới phải có ít nhất 6 ký tự'
                });
            }
            
            user.password = newPassword;
        }
        
        await user.save();
        
        return res.json({
            success: true,
            message: 'Cập nhật thông tin thành công',
            data: user.toSafeObject()
        });
        
    } catch (error) {
        console.error('❌ Update me error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// ============================================
// ADMIN ONLY ROUTES
// ============================================

/**
 * POST /api/auth/users
 * Tạo user mới (Admin only)
 */
router.post('/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const { username, password, role, fullName, email, phone } = req.body;
        
        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username và password là bắt buộc'
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password phải có ít nhất 6 ký tự'
            });
        }
        
        // Check if username exists
        const existingUser = await User.findOne({ username });
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username đã tồn tại'
            });
        }
        
        // Create user
        const user = await User.create({
            username,
            password,
            role: role || 'user',
            fullName,
            email,
            phone,
            createdBy: req.userId
        });
        
        return res.status(201).json({
            success: true,
            message: 'Tạo user thành công',
            data: user.toSafeObject()
        });
        
    } catch (error) {
        console.error('❌ Create user error:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ',
                errors: Object.values(error.errors).map(err => err.message)
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
 * GET /api/auth/users
 * Lấy danh sách users (Admin only)
 */
router.get('/users', authenticate, requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, role, isActive } = req.query;
        
        const result = await User.getAllUsers({
            page: parseInt(page),
            limit: parseInt(limit),
            role,
            isActive: isActive !== undefined ? isActive === 'true' : undefined
        });
        
        // Lấy thống kê thực tế cho mỗi user
        const Link = require('../models/Link');
        const Campaign = require('../models/Campaign');
        
        const usersWithStats = await Promise.all(result.users.map(async (user) => {
            const userObj = user.toObject();
            
            // Đếm số links và campaigns thực tế
            const [linksCount, campaignsCount, linksStats] = await Promise.all([
                Link.countDocuments({ userId: user._id }),
                Campaign.countDocuments({ userId: user._id }),
                Link.aggregate([
                    { $match: { userId: user._id } },
                    { 
                        $group: { 
                            _id: null, 
                            totalClicks: { $sum: '$totalClicks' },
                            validClicks: { $sum: '$validClicks' }
                        } 
                    }
                ])
            ]);
            
            const clickStats = linksStats[0] || { totalClicks: 0, validClicks: 0 };
            
            // Cập nhật stats object
            userObj.stats = {
                linksCreated: linksCount,
                campaignsCreated: campaignsCount,
                totalClicks: clickStats.totalClicks,
                validClicks: clickStats.validClicks
            };
            
            return userObj;
        }));
        
        return res.json({
            success: true,
            data: {
                users: usersWithStats,
                total: result.total,
                page: result.page,
                pages: result.pages
            }
        });
        
    } catch (error) {
        console.error('❌ Get users error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * GET /api/auth/users/:id
 * Lấy thông tin user theo ID (Admin only)
 */
router.get('/users/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('createdBy', 'username fullName');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy user'
            });
        }
        
        return res.json({
            success: true,
            data: user
        });
        
    } catch (error) {
        console.error('❌ Get user error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * PUT /api/auth/users/:id
 * Cập nhật user (Admin only)
 */
router.put('/users/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { fullName, email, phone, role, isActive, password } = req.body;
        
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy user'
            });
        }
        
        // Update fields
        if (fullName !== undefined) user.fullName = fullName;
        if (email !== undefined) user.email = email;
        if (phone !== undefined) user.phone = phone;
        if (role !== undefined) user.role = role;
        if (isActive !== undefined) user.isActive = isActive;
        
        // Update password nếu có
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password phải có ít nhất 6 ký tự'
                });
            }
            user.password = password;
        }
        
        await user.save();
        
        return res.json({
            success: true,
            message: 'Cập nhật user thành công',
            data: user.toSafeObject()
        });
        
    } catch (error) {
        console.error('❌ Update user error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

/**
 * DELETE /api/auth/users/:id
 * Xóa user (soft delete - set isActive = false) (Admin only)
 */
router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy user'
            });
        }
        
        // Không cho xóa chính mình
        if (user._id.toString() === req.userId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa chính mình'
            });
        }
        
        // Soft delete
        user.isActive = false;
        await user.save();
        
        return res.json({
            success: true,
            message: 'Xóa user thành công'
        });
        
    } catch (error) {
        console.error('❌ Delete user error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

module.exports = router;
