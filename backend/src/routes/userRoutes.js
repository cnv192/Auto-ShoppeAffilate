/**
 * User Routes
 * 
 * API endpoints cho quản lý thông tin user
 * - Profile viewing/editing
 * - Password change
 * - Admin user management
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/users/profile
 * Lấy thông tin profile của user đang đăng nhập
 */
router.get('/profile', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại'
            });
        }

        res.json({
            success: true,
            data: {
                _id: user._id,
                username: user.username,
                displayName: user.fullName || user.displayName, // Map fullName to displayName
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                role: user.role,
                createdAt: user.createdAt,
                stats: user.stats
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
});

/**
 * PUT /api/users/profile
 * Cập nhật thông tin profile
 */
router.put('/profile', authenticate, async (req, res) => {
    try {
        const { displayName, email, phone, avatar } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại'
            });
        }

        // Cập nhật các field được phép
        if (displayName !== undefined) user.fullName = displayName; // Update fullName
        if (email !== undefined) user.email = email;
        if (phone !== undefined) user.phone = phone;
        if (avatar !== undefined) user.avatar = avatar;

        await user.save();

        res.json({
            success: true,
            message: 'Cập nhật thành công',
            data: {
                displayName: user.fullName,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi cập nhật'
        });
    }
});

/**
 * PUT /api/users/change-password
 * Đổi mật khẩu
 */
router.put('/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin mật khẩu'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu mới phải có ít nhất 6 ký tự'
            });
        }

        // Cần select('+password') vì password có select: false trong schema
        const user = await User.findById(req.user._id).select('+password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại'
            });
        }

        // Kiểm tra mật khẩu hiện tại
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu hiện tại không đúng'
            });
        }

        // Cập nhật mật khẩu mới
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Đổi mật khẩu thành công'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi đổi mật khẩu'
        });
    }
});

/**
 * GET /api/users
 * [Admin] Lấy danh sách tất cả users
 */
router.get('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .sort('-createdAt');

        res.json({
            success: true,
            data: users,
            total: users.length
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy danh sách users'
        });
    }
});

/**
 * POST /api/users
 * [Admin] Tạo user mới
 */
router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const { username, password, displayName, email, role } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username và password là bắt buộc'
            });
        }

        // Check username tồn tại
        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username đã tồn tại'
            });
        }

        const user = new User({
            username: username.toLowerCase(),
            password,
            displayName: displayName || username,
            email,
            role: role || 'user'
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'Tạo user thành công',
            data: {
                _id: user._id,
                username: user.username,
                displayName: user.displayName,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi tạo user'
        });
    }
});

/**
 * PUT /api/users/:id
 * [Admin] Cập nhật user
 */
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { displayName, email, role, isActive } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại'
            });
        }

        if (displayName !== undefined) user.displayName = displayName;
        if (email !== undefined) user.email = email;
        if (role !== undefined) user.role = role;
        if (isActive !== undefined) user.isActive = isActive;

        await user.save();

        res.json({
            success: true,
            message: 'Cập nhật thành công',
            data: user.toSafeObject()
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi cập nhật user'
        });
    }
});

/**
 * DELETE /api/users/:id
 * [Admin] Xóa user
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Không cho phép xóa chính mình
        if (id === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa chính mình'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User không tồn tại'
            });
        }

        // Không cho phép xóa admin
        if (user.role === 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa admin'
            });
        }

        await User.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Xóa user thành công'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi xóa user'
        });
    }
});

module.exports = router;
