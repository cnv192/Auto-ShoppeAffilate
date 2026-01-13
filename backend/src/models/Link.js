/**
 * Link Model
 * 
 * Schema MongoDB cho việc lưu trữ thông tin Link
 * Bao gồm: metadata, tracking clicks, và thống kê
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Click Log Sub-Schema
 * Lưu trữ chi tiết mỗi lượt click
 */
const ClickLogSchema = new Schema({
    // IP của người click
    ip: {
        type: String,
        required: true,
        index: true
    },
    
    // Thông tin IP từ IP2Location
    ipInfo: {
        countryShort: String,
        isp: String,
        region: String,
        city: String
    },
    
    // User Agent
    userAgent: String,
    
    // Referer (nguồn truy cập)
    referer: String,
    
    // Thiết bị
    device: {
        type: String,
        enum: ['desktop', 'mobile', 'tablet', 'unknown'],
        default: 'unknown'
    },
    
    // Có phải click hợp lệ không (không phải bot/datacenter)
    isValid: {
        type: Boolean,
        default: true
    },
    
    // Lý do nếu không hợp lệ
    invalidReason: String,
    
    // Thời gian click
    clickedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, { _id: false });

/**
 * Main Link Schema
 */
const LinkSchema = new Schema({
    // Slug - URL rút gọn (unique)
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true,
        minlength: 2,
        maxlength: 50
    },
    
    // Tiêu đề hiển thị trên preview
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
        default: 'Shopee Deal'
    },
    
    // URL đích (Shopee link)
    targetUrl: {
        type: String,
        required: true,
        trim: true
    },
    
    // URL ảnh preview (Open Graph)
    imageUrl: {
        type: String,
        trim: true,
        default: 'https://cf.shopee.vn/file/default_image'
    },
    
    // Mô tả cho Open Graph
    description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: 'Xem ngay deal hot trên Shopee với giá ưu đãi đặc biệt!'
    },
    
    // === TRACKING STATS ===
    
    // Tổng số click (tất cả)
    totalClicks: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Số click hợp lệ (chỉ từ VN, không phải datacenter)
    validClicks: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Số click không hợp lệ (bot, datacenter, nước ngoài)
    invalidClicks: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Số unique IP đã click
    uniqueIPs: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Danh sách IP đã click (để check unique)
    clickedIPs: [{
        type: String
    }],
    
    // Click logs chi tiết (giới hạn 1000 entries gần nhất)
    clickLogs: {
        type: [ClickLogSchema],
        default: []
    },
    
    // === STATUS ===
    
    // Link có đang hoạt động không
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    // Ngày hết hạn (optional)
    expiresAt: {
        type: Date,
        default: null
    },
    
    // === METADATA ===
    
    // Tags để phân loại
    tags: [{
        type: String,
        trim: true
    }],
    
    // Ghi chú nội bộ
    notes: {
        type: String,
        maxlength: 1000
    },
    
    // Người tạo (nếu có auth)
    createdBy: {
        type: String,
        default: 'system'
    }
    
}, {
    // Tự động thêm createdAt và updatedAt
    timestamps: true,
    
    // Collection name
    collection: 'links',
    
    // Optimize cho read-heavy workload
    read: 'secondaryPreferred'
});

// =================================================================
// INDEXES
// =================================================================

// Compound index cho query phổ biến
LinkSchema.index({ isActive: 1, createdAt: -1 });
LinkSchema.index({ slug: 1, isActive: 1 });

// Text index cho search
LinkSchema.index({ title: 'text', description: 'text', tags: 'text' });

// =================================================================
// VIRTUAL FIELDS
// =================================================================

// Tính CTR (Click Through Rate) - giả định
LinkSchema.virtual('ctr').get(function() {
    if (this.totalClicks === 0) return 0;
    return ((this.validClicks / this.totalClicks) * 100).toFixed(2);
});

// Full URL
LinkSchema.virtual('shortUrl').get(function() {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    return `${baseUrl}/${this.slug}`;
});

// =================================================================
// INSTANCE METHODS
// =================================================================

/**
 * Ghi nhận một click mới
 * @param {Object} clickData - Dữ liệu click
 * @returns {Object} - Kết quả ghi nhận
 */
LinkSchema.methods.recordClick = async function(clickData) {
    const {
        ip,
        ipInfo = {},
        userAgent = '',
        referer = '',
        device = 'unknown',
        isValid = true,
        invalidReason = null
    } = clickData;
    
    // Kiểm tra IP đã click chưa
    const isNewIP = !this.clickedIPs.includes(ip);
    
    // Cập nhật counters
    this.totalClicks += 1;
    
    if (isValid) {
        this.validClicks += 1;
    } else {
        this.invalidClicks += 1;
    }
    
    if (isNewIP) {
        this.uniqueIPs += 1;
        this.clickedIPs.push(ip);
        
        // Giới hạn clickedIPs array (giữ 10000 IP gần nhất)
        if (this.clickedIPs.length > 10000) {
            this.clickedIPs = this.clickedIPs.slice(-10000);
        }
    }
    
    // Thêm vào click logs
    const clickLog = {
        ip,
        ipInfo,
        userAgent: userAgent.substring(0, 500), // Giới hạn length
        referer: referer.substring(0, 500),
        device,
        isValid,
        invalidReason,
        clickedAt: new Date()
    };
    
    this.clickLogs.push(clickLog);
    
    // Giới hạn click logs (giữ 1000 entries gần nhất)
    if (this.clickLogs.length > 1000) {
        this.clickLogs = this.clickLogs.slice(-1000);
    }
    
    // Lưu vào database
    await this.save();
    
    return {
        totalClicks: this.totalClicks,
        validClicks: this.validClicks,
        isNewIP,
        isValid
    };
};

/**
 * Kiểm tra link còn hoạt động không
 */
LinkSchema.methods.isAvailable = function() {
    if (!this.isActive) return false;
    if (this.expiresAt && new Date() > this.expiresAt) return false;
    return true;
};

// =================================================================
// STATIC METHODS
// =================================================================

/**
 * Tìm link theo slug
 */
LinkSchema.statics.findBySlug = function(slug) {
    return this.findOne({ slug: slug.toLowerCase(), isActive: true });
};

/**
 * Tạo link mới với slug tự động
 */
LinkSchema.statics.createWithAutoSlug = async function(linkData) {
    const generateSlug = (length = 6) => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let slug = '';
        for (let i = 0; i < length; i++) {
            slug += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return slug;
    };
    
    // Nếu có custom slug, kiểm tra xem đã tồn tại chưa
    if (linkData.slug) {
        const existing = await this.findOne({ slug: linkData.slug.toLowerCase() });
        if (existing) {
            throw new Error('Slug đã tồn tại');
        }
    } else {
        // Tạo slug tự động và đảm bảo unique
        let slug;
        let attempts = 0;
        do {
            slug = generateSlug();
            attempts++;
        } while (await this.findOne({ slug }) && attempts < 10);
        
        linkData.slug = slug;
    }
    
    return this.create(linkData);
};

/**
 * Lấy thống kê tổng quan
 */
LinkSchema.statics.getOverallStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: null,
                totalLinks: { $sum: 1 },
                activeLinks: { $sum: { $cond: ['$isActive', 1, 0] } },
                totalClicks: { $sum: '$totalClicks' },
                totalValidClicks: { $sum: '$validClicks' },
                totalInvalidClicks: { $sum: '$invalidClicks' },
                totalUniqueIPs: { $sum: '$uniqueIPs' }
            }
        }
    ]);
    
    return stats[0] || {
        totalLinks: 0,
        activeLinks: 0,
        totalClicks: 0,
        totalValidClicks: 0,
        totalInvalidClicks: 0,
        totalUniqueIPs: 0
    };
};

/**
 * Lấy top links theo clicks
 */
LinkSchema.statics.getTopLinks = function(limit = 10) {
    return this.find({ isActive: true })
        .sort({ validClicks: -1 })
        .limit(limit)
        .select('slug title validClicks totalClicks uniqueIPs createdAt');
};

// =================================================================
// PRE/POST HOOKS
// =================================================================

// Đảm bảo slug lowercase trước khi save
LinkSchema.pre('save', function(next) {
    if (this.slug) {
        this.slug = this.slug.toLowerCase();
    }
    next();
});

// =================================================================
// EXPORT
// =================================================================

const Link = mongoose.model('Link', LinkSchema);

module.exports = Link;
