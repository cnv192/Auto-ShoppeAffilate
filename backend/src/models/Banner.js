/**
 * Banner Model
 * 
 * Schema MongoDB cho việc quản lý Banner quảng cáo
 * Hỗ trợ: Sticky Bottom, Popup, A/B Testing
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Click Stats Sub-Schema
 * Thống kê click cho mỗi banner
 */
const ClickStatsSchema = new Schema({
    // Tổng số impressions (hiển thị)
    impressions: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Tổng số clicks
    clicks: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Click-Through Rate (tính toán)
    ctr: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Unique clicks (theo IP)
    uniqueClicks: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Danh sách IP đã click (để check unique)
    clickedIPs: [{
        type: String
    }]
}, { _id: false });

/**
 * Main Banner Schema
 */
const BannerSchema = new Schema({
    // Tên banner (nội bộ)
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    
    // URL hình ảnh banner
    imageUrl: {
        type: String,
        required: true,
        trim: true
    },
    
    // Mobile image URL (optional - cho responsive)
    mobileImageUrl: {
        type: String,
        trim: true,
        default: null
    },
    
    // Slug của Link đích (references Link model)
    targetSlug: {
        type: String,
        trim: true,
        lowercase: true,
        index: true,
        default: ''
    },
    
    // Hoặc URL đích trực tiếp (nếu không dùng Link)
    targetUrl: {
        type: String,
        trim: true,
        default: null
    },
    
    // Loại banner (bỏ popup, giữ các loại khác)
    type: {
        type: String,
        enum: ['sticky_bottom', 'center_popup', 'sidebar', 'inline', 'header'],
        default: 'sticky_bottom',
        index: true
    },
    
    // Thứ tự ưu tiên (số nhỏ = ưu tiên cao)
    priority: {
        type: Number,
        default: 10
    },
    
    // Banner có đang hoạt động không
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    // Trọng số cho A/B testing (0-100)
    // Banner với weight cao hơn sẽ xuất hiện nhiều hơn
    weight: {
        type: Number,
        default: 50,
        min: 0,
        max: 100
    },
    
    // Tỉ lệ hiển thị chiều rộng (% so với viewport, 1-100)
    // Chiều cao tự co theo tỉ lệ ảnh gốc
    displayWidth: {
        type: Number,
        default: 50,
        min: 1,
        max: 100
    },
    
    // === TARGETING OPTIONS ===
    
    // Chỉ hiển thị trên mobile
    mobileOnly: {
        type: Boolean,
        default: false
    },
    
    // Chỉ hiển thị trên desktop
    desktopOnly: {
        type: Boolean,
        default: false
    },
    
    // Danh sách slug bài viết được hiển thị (empty = tất cả)
    targetArticles: [{
        type: String
    }],
    
    // Danh sách category được hiển thị (empty = tất cả)
    targetCategories: [{
        type: String
    }],
    
    // === SCHEDULING ===
    
    // Ngày bắt đầu hiển thị
    startDate: {
        type: Date,
        default: null
    },
    
    // Ngày kết thúc hiển thị
    endDate: {
        type: Date,
        default: null
    },
    
    // === STATISTICS ===
    
    // Thống kê click
    stats: {
        type: ClickStatsSchema,
        default: () => ({})
    },
    
    // === DISPLAY OPTIONS ===
    
    // Alt text cho SEO
    altText: {
        type: String,
        trim: true,
        default: ''
    },
    
    // Delay trước khi hiển thị (ms) - cho popup
    showDelay: {
        type: Number,
        default: 0
    },
    
    // Tự động ẩn sau thời gian (ms) - 0 = không tự ẩn
    autoHideAfter: {
        type: Number,
        default: 0
    },
    
    // Có thể đóng được không
    dismissible: {
        type: Boolean,
        default: true
    },
    
    // === METADATA ===
    
    // Ghi chú
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    
    // Người tạo (reference User)
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
    
}, {
    timestamps: true, // createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// =================================================================
// INDEXES
// =================================================================

// Compound index for active banners query
BannerSchema.index({ isActive: 1, type: 1, priority: 1 });

// Index for scheduling queries
BannerSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

// =================================================================
// VIRTUALS
// =================================================================

/**
 * Virtual: Kiểm tra banner có đang trong thời gian hiển thị không
 */
BannerSchema.virtual('isScheduleActive').get(function() {
    const now = new Date();
    
    if (this.startDate && now < this.startDate) {
        return false;
    }
    
    if (this.endDate && now > this.endDate) {
        return false;
    }
    
    return true;
});

/**
 * Virtual: Kiểm tra banner có available không (active + schedule)
 */
BannerSchema.virtual('isAvailable').get(function() {
    return this.isActive && this.isScheduleActive;
});

/**
 * Virtual: CTR tính toán
 */
BannerSchema.virtual('calculatedCTR').get(function() {
    if (!this.stats || this.stats.impressions === 0) {
        return 0;
    }
    return ((this.stats.clicks / this.stats.impressions) * 100).toFixed(2);
});

// =================================================================
// INSTANCE METHODS
// =================================================================

/**
 * Tăng impression count
 */
BannerSchema.methods.recordImpression = async function() {
    this.stats.impressions += 1;
    this.stats.ctr = this.stats.impressions > 0 
        ? (this.stats.clicks / this.stats.impressions) * 100 
        : 0;
    return this.save();
};

/**
 * Tăng click count
 * @param {String} ip - IP của người click
 */
BannerSchema.methods.recordClick = async function(ip) {
    this.stats.clicks += 1;
    
    // Check unique click
    if (ip && !this.stats.clickedIPs.includes(ip)) {
        this.stats.clickedIPs.push(ip);
        this.stats.uniqueClicks += 1;
        
        // Giới hạn clickedIPs để tránh document quá lớn
        if (this.stats.clickedIPs.length > 10000) {
            this.stats.clickedIPs = this.stats.clickedIPs.slice(-5000);
        }
    }
    
    // Update CTR
    this.stats.ctr = this.stats.impressions > 0 
        ? (this.stats.clicks / this.stats.impressions) * 100 
        : 0;
    
    return this.save();
};

/**
 * Kiểm tra banner có nên hiển thị cho device không
 * @param {String} device - 'mobile' hoặc 'desktop'
 */
BannerSchema.methods.shouldShowForDevice = function(device) {
    if (this.mobileOnly && device !== 'mobile') {
        return false;
    }
    if (this.desktopOnly && device !== 'desktop') {
        return false;
    }
    return true;
};

/**
 * Kiểm tra banner có nên hiển thị cho article không
 * @param {String} slug - Slug của bài viết
 * @param {String} category - Category của bài viết
 */
BannerSchema.methods.shouldShowForArticle = function(slug, category) {
    // Nếu có targetArticles và slug không nằm trong list
    if (this.targetArticles.length > 0 && !this.targetArticles.includes(slug)) {
        return false;
    }
    
    // Nếu có targetCategories và category không nằm trong list
    if (this.targetCategories.length > 0 && !this.targetCategories.includes(category)) {
        return false;
    }
    
    return true;
};

// =================================================================
// STATIC METHODS
// =================================================================

/**
 * Lấy random banner active theo type (với weighted random)
 * @param {String} type - Loại banner
 * @param {Object} options - { device, articleSlug, category }
 */
BannerSchema.statics.getRandomActive = async function(type = 'sticky_bottom', options = {}) {
    const { device, articleSlug, category } = options;
    const now = new Date();
    
    // Build query
    const query = {
        isActive: true,
        type: type,
        $or: [
            { startDate: null },
            { startDate: { $lte: now } }
        ]
    };
    
    // Add end date filter
    query.$and = [
        {
            $or: [
                { endDate: null },
                { endDate: { $gte: now } }
            ]
        }
    ];
    
    // Get all matching banners
    let banners = await this.find(query).sort({ priority: 1, weight: -1 });
    
    if (banners.length === 0) {
        return null;
    }
    
    // Filter by device
    if (device) {
        banners = banners.filter(b => b.shouldShowForDevice(device));
    }
    
    // Filter by article/category
    if (articleSlug || category) {
        banners = banners.filter(b => b.shouldShowForArticle(articleSlug, category));
    }
    
    if (banners.length === 0) {
        return null;
    }
    
    // Weighted random selection
    const totalWeight = banners.reduce((sum, b) => sum + b.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const banner of banners) {
        random -= banner.weight;
        if (random <= 0) {
            return banner;
        }
    }
    
    // Fallback to first banner
    return banners[0];
};

/**
 * Lấy tất cả banners active theo type
 * @param {String} type - Loại banner
 */
BannerSchema.statics.getAllActive = async function(type = null) {
    const now = new Date();
    
    const query = {
        isActive: true,
        $or: [
            { startDate: null },
            { startDate: { $lte: now } }
        ],
        $and: [
            {
                $or: [
                    { endDate: null },
                    { endDate: { $gte: now } }
                ]
            }
        ]
    };
    
    if (type) {
        query.type = type;
    }
    
    return this.find(query).sort({ priority: 1, weight: -1 });
};

/**
 * Lấy stats tổng hợp của tất cả banners
 */
BannerSchema.statics.getAggregatedStats = async function() {
    const result = await this.aggregate([
        {
            $group: {
                _id: null,
                totalImpressions: { $sum: '$stats.impressions' },
                totalClicks: { $sum: '$stats.clicks' },
                totalUniqueClicks: { $sum: '$stats.uniqueClicks' },
                totalBanners: { $sum: 1 },
                activeBanners: {
                    $sum: { $cond: ['$isActive', 1, 0] }
                }
            }
        }
    ]);
    
    if (result.length === 0) {
        return {
            totalImpressions: 0,
            totalClicks: 0,
            totalUniqueClicks: 0,
            totalBanners: 0,
            activeBanners: 0,
            overallCTR: 0
        };
    }
    
    const stats = result[0];
    stats.overallCTR = stats.totalImpressions > 0 
        ? ((stats.totalClicks / stats.totalImpressions) * 100).toFixed(2) 
        : 0;
    
    delete stats._id;
    return stats;
};

const Banner = mongoose.model('Banner', BannerSchema);

module.exports = Banner;
