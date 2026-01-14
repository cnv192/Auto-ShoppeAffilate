const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware - JWT
 * 
 * Features:
 * - Verify JWT token from request headers
 * - Attach user object to request
 * - Role-based access control
 */

// JWT Secret (nên lưu trong .env)
const JWT_SECRET = process.env.JWT_SECRET || 'shoppe-affiliate-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token
 * @param {Object} payload - { userId, username, role }
 * @returns {String} JWT token
 */
const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
};

/**
 * Verify JWT token
 * @param {String} token
 * @returns {Object} Decoded payload
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Token không hợp lệ hoặc đã hết hạn');
    }
};

/**
 * Middleware: Kiểm tra authentication
 * Sử dụng: Bảo vệ các routes cần đăng nhập
 */
const authenticate = async (req, res, next) => {
    try {
        // 1. Lấy token từ header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập để tiếp tục'
            });
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer '
        
        // 2. Verify token
        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Token không hợp lệ hoặc đã hết hạn'
            });
        }
        
        // 3. Lấy user từ database
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User không tồn tại'
            });
        }
        
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản đã bị vô hiệu hóa'
            });
        }
        
        // 4. Attach user to request
        req.user = user;
        req.userId = user._id;
        req.userRole = user.role;
        
        next();
        
    } catch (error) {
        console.error('❌ Authentication error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi xác thực'
        });
    }
};

/**
 * Middleware: Kiểm tra quyền Admin
 * Sử dụng sau authenticate middleware
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Vui lòng đăng nhập'
        });
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Chỉ Admin mới có quyền truy cập'
        });
    }
    
    next();
};

/**
 * Middleware: Kiểm tra quyền truy cập resource
 * User chỉ được truy cập resource của chính mình
 * Admin có thể truy cập tất cả
 */
const authorizeResourceAccess = (resourceUserIdField = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập'
            });
        }
        
        // Admin có full access
        if (req.user.role === 'admin') {
            return next();
        }
        
        // User chỉ truy cập resource của mình
        const resourceUserId = req.params[resourceUserIdField] || 
                              req.body[resourceUserIdField] ||
                              req.query[resourceUserIdField];
        
        if (!resourceUserId) {
            // Nếu không có userId trong params, check xem có phải query all không
            // User không được phép query all
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền truy cập'
            });
        }
        
        if (resourceUserId.toString() !== req.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền truy cập resource này'
            });
        }
        
        next();
    };
};

/**
 * Middleware: Optional authentication
 * Attach user nếu có token, nhưng không bắt buộc
 */
const optionalAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        
        const token = authHeader.substring(7);
        
        try {
            const decoded = verifyToken(token);
            const user = await User.findById(decoded.userId);
            
            if (user && user.isActive) {
                req.user = user;
                req.userId = user._id;
                req.userRole = user.role;
            }
        } catch (error) {
            // Token invalid, nhưng vẫn tiếp tục
        }
        
        next();
        
    } catch (error) {
        next();
    }
};

/**
 * Generate token response object
 * @param {User} user
 * @returns {Object} - { token, expiresIn, user }
 */
const generateAuthResponse = (user) => {
    const payload = {
        userId: user._id,
        username: user.username,
        role: user.role
    };
    
    const token = generateToken(payload);
    
    return {
        token,
        expiresIn: JWT_EXPIRES_IN,
        user: user.toSafeObject()
    };
};

module.exports = {
    // Config
    JWT_SECRET,
    JWT_EXPIRES_IN,
    
    // Functions
    generateToken,
    verifyToken,
    generateAuthResponse,
    
    // Middleware
    authenticate,
    requireAdmin,
    authorizeResourceAccess,
    optionalAuthenticate
};
