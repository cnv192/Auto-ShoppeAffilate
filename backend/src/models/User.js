const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema - Hệ thống phân quyền Admin/User
 * 
 * Roles:
 * - admin: Quản lý toàn bộ hệ thống, tạo user, xem tất cả thống kê
 * - user: Chỉ xem được dữ liệu của chính mình
 * 
 * Features:
 * - JWT authentication
 * - Password hashing với bcrypt
 * - Không có chức năng đăng ký (Admin tạo tài khoản)
 */

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username là bắt buộc'],
        unique: true,
        trim: true,
        lowercase: true,
        minlength: [3, 'Username phải có ít nhất 3 ký tự'],
        maxlength: [30, 'Username không được quá 30 ký tự'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username chỉ được chứa chữ, số và dấu gạch dưới']
    },

    password: {
        type: String,
        required: [true, 'Password là bắt buộc'],
        minlength: [6, 'Password phải có ít nhất 6 ký tự'],
        select: false // Không trả về password khi query
    },

    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user',
        required: true
    },

    fullName: {
        type: String,
        trim: true,
        maxlength: [100, 'Họ tên không được quá 100 ký tự']
    },

    email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ']
    },

    phone: {
        type: String,
        trim: true,
        match: [/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ']
    },

    isActive: {
        type: Boolean,
        default: true
    },

    // Thống kê
    stats: {
        totalLinks: {
            type: Number,
            default: 0
        },
        totalClicks: {
            type: Number,
            default: 0
        },
        totalCampaigns: {
            type: Number,
            default: 0
        }
    },

    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    lastLogin: {
        type: Date
    },

    lastLoginIP: {
        type: String
    }

}, {
    timestamps: true
});

// ============================================
// INDEXES
// ============================================

userSchema.index({ username: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// ============================================
// MIDDLEWARE - Hash password trước khi lưu
// ============================================

userSchema.pre('save', async function(next) {
    // Chỉ hash password nếu password được modify
    if (!this.isModified('password')) {
        return next();
    }

    try {
        // Generate salt
        const salt = await bcrypt.genSalt(10);
        
        // Hash password
        this.password = await bcrypt.hash(this.password, salt);
        
        next();
    } catch (error) {
        next(error);
    }
});

// ============================================
// METHODS
// ============================================

/**
 * So sánh password với hash trong database
 * @param {String} candidatePassword - Password người dùng nhập vào
 * @returns {Boolean} - true nếu password đúng
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Lỗi khi so sánh password');
    }
};

/**
 * Kiểm tra user có phải Admin không
 * @returns {Boolean}
 */
userSchema.methods.isAdmin = function() {
    return this.role === 'admin';
};

/**
 * Cập nhật thông tin last login
 * @param {String} ip - IP address
 */
userSchema.methods.updateLastLogin = async function(ip) {
    this.lastLogin = new Date();
    this.lastLoginIP = ip;
    await this.save();
};

/**
 * Cập nhật stats
 * @param {Object} stats - { totalLinks, totalClicks, totalCampaigns }
 */
userSchema.methods.updateStats = async function(stats) {
    if (stats.totalLinks !== undefined) {
        this.stats.totalLinks = stats.totalLinks;
    }
    if (stats.totalClicks !== undefined) {
        this.stats.totalClicks = stats.totalClicks;
    }
    if (stats.totalCampaigns !== undefined) {
        this.stats.totalCampaigns = stats.totalCampaigns;
    }
    await this.save();
};

/**
 * Get safe user object (không bao gồm password)
 * @returns {Object}
 */
userSchema.methods.toSafeObject = function() {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Tạo Admin user mặc định
 * @param {String} username - Default: 'admin'
 * @param {String} password - Default: '123456'
 * @returns {User}
 */
userSchema.statics.createDefaultAdmin = async function(
    username = 'admin',
    password = '123456'
) {
    try {
        // Check xem admin đã tồn tại chưa
        const existingAdmin = await this.findOne({ username });
        
        if (existingAdmin) {
            console.log('✅ Admin user đã tồn tại');
            return existingAdmin;
        }

        // Tạo admin mới
        const admin = await this.create({
            username,
            password,
            role: 'admin',
            fullName: 'Administrator',
            isActive: true
        });

        console.log('✅ Đã tạo Admin user mặc định:');
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${password}`);
        console.log(`   ⚠️  Vui lòng đổi password sau khi đăng nhập lần đầu!`);

        return admin;
    } catch (error) {
        console.error('❌ Lỗi khi tạo Admin user:', error.message);
        throw error;
    }
};

/**
 * Tìm user và include password (dùng cho authentication)
 * @param {String} username
 * @returns {User}
 */
userSchema.statics.findByUsername = async function(username) {
    return await this.findOne({ username }).select('+password');
};

/**
 * Get all users (Admin only)
 * @param {Object} options - { page, limit, role, isActive }
 * @returns {Object} - { users, total, page, pages }
 */
userSchema.statics.getAllUsers = async function(options = {}) {
    const {
        page = 1,
        limit = 20,
        role,
        isActive
    } = options;

    const query = {};
    
    if (role) {
        query.role = role;
    }
    
    if (isActive !== undefined) {
        query.isActive = isActive;
    }

    const total = await this.countDocuments(query);
    const users = await this.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .populate('createdBy', 'username fullName');

    return {
        users,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
    };
};

// ============================================
// VIRTUAL FIELDS
// ============================================

userSchema.virtual('linksCount', {
    ref: 'Link',
    localField: '_id',
    foreignField: 'createdBy',
    count: true
});

userSchema.virtual('campaignsCount', {
    ref: 'Campaign',
    localField: '_id',
    foreignField: 'userId',
    count: true
});

// ============================================
// EXPORT MODEL
// ============================================

const User = mongoose.model('User', userSchema);

module.exports = User;
