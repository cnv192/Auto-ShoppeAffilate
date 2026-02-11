const mongoose = require('mongoose');

/**
 * Campaign Schema - Quản lý chiến dịch Facebook Marketing
 * 
 * Features:
 * - Scheduling (thời gian bắt đầu, thời lượng)
 * - Targeting filters (minLikes, minComments, minShares)
 * - Frequency control (maxCommentsPerPost)
 * - Safety logic (auto-stop khi bị block)
 * - Status tracking (Active, Paused, Stopped, Completed)
 */

const campaignSchema = new mongoose.Schema({
    // ============================================
    // BASIC INFO
    // ============================================
    
    name: {
        type: String,
        required: [true, 'Tên chiến dịch là bắt buộc'],
        trim: true,
        maxlength: [100, 'Tên chiến dịch không được quá 100 ký tự']
    },

    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Mô tả không được quá 500 ký tự']
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // ============================================
    // CONTENT CONFIGURATION
    // ============================================

    // Danh sách slugs (link Shopee) để random
    slugs: [{
        type: String,
        required: true
    }],

    // Danh sách nội dung comment để random
    commentTemplates: [{
        type: String,
        required: true,
        trim: true
    }],

    // ============================================
    // SCHEDULING
    // ============================================

    // Thời gian bắt đầu chạy trong ngày (HH:mm format)
    // Ví dụ: "08:00"
    startTime: {
        type: String,
        required: [true, 'Thời gian bắt đầu là bắt buộc'],
        match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Thời gian phải theo format HH:mm (ví dụ: 08:00)']
    },

    // Tổng thời gian chiến dịch chạy (giờ)
    // Ví dụ: 5 (chạy trong 5 tiếng)
    durationHours: {
        type: Number,
        required: [true, 'Thời lượng chiến dịch là bắt buộc'],
        min: [0.5, 'Thời lượng tối thiểu 0.5 giờ'],
        max: [24, 'Thời lượng tối đa 24 giờ']
    },

    // Ngày bắt đầu chiến dịch
    startDate: {
        type: Date,
        required: true,
        default: Date.now
    },

    // Ngày kết thúc chiến dịch (tự động tính)
    endDate: {
        type: Date
    },

    // ============================================
    // TARGETING FILTERS
    // ============================================

    filters: {
        // Số lượng Like tối thiểu
        minLikes: {
            type: Number,
            default: 0,
            min: [0, 'Số Like tối thiểu không được âm']
        },

        // Số lượng Comment tối thiểu
        minComments: {
            type: Number,
            default: 0,
            min: [0, 'Số Comment tối thiểu không được âm']
        },

        // Số lượng Share tối thiểu
        minShares: {
            type: Number,
            default: 0,
            min: [0, 'Số Share tối thiểu không được âm']
        }
    },

    // ============================================
    // FREQUENCY CONTROL
    // ============================================

    // Số lượng comment tối đa cho mỗi bài viết
    maxCommentsPerPost: {
        type: Number,
        required: true,
        default: 1,
        min: [1, 'Phải comment ít nhất 1 lần'],
        max: [10, 'Tối đa 10 comment mỗi bài']
    },

    // Delay tối thiểu giữa các comment (giây)
    delayMin: {
        type: Number,
        default: 30,
        min: [10, 'Delay tối thiểu 10 giây'],
        max: [300, 'Delay tối đa 300 giây']
    },

    // Delay tối đa giữa các comment (giây)
    delayMax: {
        type: Number,
        default: 60,
        min: [10, 'Delay tối thiểu 10 giây'],
        max: [600, 'Delay tối đa 600 giây']
    },

    // Legacy field - kept for backwards compatibility
    delayBetweenComments: {
        type: Number,
        default: 30,
        min: [10, 'Delay tối thiểu 10 giây'],
        max: [300, 'Delay tối đa 300 giây']
    },

    // ============================================
    // TARGET SOURCES (Groups & Fanpages)
    // ============================================

    // Danh sách Facebook Group URLs để ưu tiên crawl
    linkGroups: [{
        type: String,
        trim: true
    }],

    // Danh sách Fanpage URLs để ưu tiên crawl
    fanpages: [{
        type: String,
        trim: true
    }],
    
    // Danh sách Facebook Post IDs/URLs để comment trực tiếp
    // User có thể nhập trực tiếp ID hoặc URL của bài viết
    // Ví dụ: "123456789" hoặc "https://facebook.com/user/posts/123456789"
    targetPostIds: [{
        type: String,
        trim: true
    }],

    // ============================================
    // STATUS & CONTROL
    // ============================================

    status: {
        type: String,
        enum: ['draft', 'active', 'paused', 'stopped', 'completed'],
        default: 'draft',
        index: true
    },

    // Trạng thái auto-stop (bị block)
    isBlocked: {
        type: Boolean,
        default: false
    },

    blockReason: {
        type: String,
        trim: true
    },

    blockedAt: {
        type: Date
    },

    // ============================================
    // FACEBOOK ACCOUNT
    // ============================================

    facebookAccountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FacebookAccount',
        required: true
    },

    // ============================================
    // STATISTICS
    // ============================================

    stats: {
        // Tổng số bài viết đã target
        totalPostsTargeted: {
            type: Number,
            default: 0
        },

        // Tổng số comment đã gửi
        totalCommentsSent: {
            type: Number,
            default: 0
        },

        // Số comment thành công
        successfulComments: {
            type: Number,
            default: 0
        },

        // Số comment thất bại
        failedComments: {
            type: Number,
            default: 0
        },

        // Số comment bị gỡ
        removedComments: {
            type: Number,
            default: 0
        },

        // Số bài viết bị block
        blockedPosts: {
            type: Number,
            default: 0
        }
    },

    // ============================================
    // LOGS - Lịch sử hoạt động
    // ============================================

    activityLogs: [{
        action: {
            type: String,
            enum: ['started', 'paused', 'resumed', 'stopped', 'completed', 'blocked', 'comment_sent', 'comment_failed', 'comment_removed', 'reply_sent'],
            required: true
        },
        message: {
            type: String,
            required: true
        },
        postId: {
            type: String // Facebook Post ID
        },
        commentId: {
            type: String // Facebook Comment ID
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed
        }
    }],

    // ============================================
    // TARGETED POSTS - Danh sách bài viết đã target
    // ============================================

    targetedPosts: [{
        postId: {
            type: String,
            required: true
        },
        postUrl: {
            type: String
        },
        // Số comment đã gửi vào bài này
        commentsSent: {
            type: Number,
            default: 0
        },
        // Bài viết này có bị block không
        isBlocked: {
            type: Boolean,
            default: false
        },
        blockReason: {
            type: String
        },
        // Thống kê bài viết
        stats: {
            likes: Number,
            comments: Number,
            shares: Number
        },
        firstCommentedAt: {
            type: Date
        },
        lastCommentedAt: {
            type: Date
        }
    }]

}, {
    timestamps: true
});

// ============================================
// INDEXES
// ============================================

campaignSchema.index({ userId: 1, status: 1 });
campaignSchema.index({ status: 1, startDate: 1 });
campaignSchema.index({ facebookAccountId: 1 });
campaignSchema.index({ createdAt: -1 });

// ============================================
// MIDDLEWARE
// ============================================

// Tự động tính endDate khi save
campaignSchema.pre('save', function(next) {
    if (this.isModified('startDate') || this.isModified('durationHours')) {
        const start = new Date(this.startDate);
        this.endDate = new Date(start.getTime() + this.durationHours * 60 * 60 * 1000);
    }
    next();
});

// ============================================
// METHODS
// ============================================

/**
 * Kiểm tra chiến dịch có đang active không
 */
campaignSchema.methods.isActive = function() {
    return this.status === 'active' && !this.isBlocked;
};

/**
 * Kiểm tra có thể comment vào bài viết không
 * @param {String} postId - Facebook Post ID
 * @returns {Boolean}
 */
campaignSchema.methods.canCommentOnPost = function(postId) {
    const post = this.targetedPosts.find(p => p.postId === postId);
    
    if (!post) {
        return true; // Bài viết mới, có thể comment
    }
    
    if (post.isBlocked) {
        return false; // Bài viết bị block
    }
    
    if (post.commentsSent >= this.maxCommentsPerPost) {
        return false; // Đã đủ số lượng comment
    }
    
    return true;
};

/**
 * Kiểm tra bài viết có thỏa mãn filters không
 * @param {Object} postStats - { likes, comments, shares }
 * @returns {Boolean}
 */
campaignSchema.methods.matchesFilters = function(postStats) {
    const { likes = 0, comments = 0, shares = 0 } = postStats;
    
    if (likes < this.filters.minLikes) {
        return false;
    }
    
    if (comments < this.filters.minComments) {
        return false;
    }
    
    if (shares < this.filters.minShares) {
        return false;
    }
    
    return true;
};

/**
 * Thêm bài viết vào danh sách targeted
 * @param {Object} postData - { postId, postUrl, stats }
 */
campaignSchema.methods.addTargetedPost = async function(postData) {
    const existing = this.targetedPosts.find(p => p.postId === postData.postId);
    
    if (!existing) {
        this.targetedPosts.push({
            postId: postData.postId,
            postUrl: postData.postUrl,
            stats: postData.stats,
            commentsSent: 0,
            firstCommentedAt: new Date()
        });
        
        this.stats.totalPostsTargeted += 1;
        await this.save();
    }
};

/**
 * Ghi nhận comment thành công
 * @param {String} postId - Facebook Post ID
 * @param {String} commentId - Facebook Comment ID
 */
campaignSchema.methods.recordSuccessfulComment = async function(postId, commentId) {
    const post = this.targetedPosts.find(p => p.postId === postId);
    
    if (post) {
        post.commentsSent += 1;
        post.lastCommentedAt = new Date();
    }
    
    this.stats.totalCommentsSent += 1;
    this.stats.successfulComments += 1;
    
    this.activityLogs.push({
        action: 'comment_sent',
        message: `Comment thành công vào bài viết ${postId}`,
        postId,
        commentId,
        timestamp: new Date()
    });
    
    await this.save();
};

/**
 * Ghi nhận comment thất bại
 * @param {String} postId - Facebook Post ID
 * @param {String} reason - Lý do thất bại
 */
campaignSchema.methods.recordFailedComment = async function(postId, reason) {
    this.stats.totalCommentsSent += 1;
    this.stats.failedComments += 1;
    
    this.activityLogs.push({
        action: 'comment_failed',
        message: `Comment thất bại: ${reason}`,
        postId,
        timestamp: new Date(),
        metadata: { reason }
    });
    
    await this.save();
};

/**
 * Block bài viết (phát hiện comment bị gỡ)
 * @param {String} postId - Facebook Post ID
 * @param {String} reason - Lý do block
 */
campaignSchema.methods.blockPost = async function(postId, reason = 'Comment bị gỡ') {
    const post = this.targetedPosts.find(p => p.postId === postId);
    
    if (post && !post.isBlocked) {
        post.isBlocked = true;
        post.blockReason = reason;
        
        this.stats.blockedPosts += 1;
        this.stats.removedComments += 1;
        
        this.activityLogs.push({
            action: 'blocked',
            message: `Bài viết ${postId} bị block: ${reason}`,
            postId,
            timestamp: new Date(),
            metadata: { reason }
        });
        
        await this.save();
    }
};

/**
 * Tạm dừng chiến dịch
 * @param {String} reason - Lý do tạm dừng
 */
campaignSchema.methods.pauseCampaign = async function(reason = 'Tạm dừng chiến dịch') {
    this.status = 'paused';
    
    this.activityLogs.push({
        action: 'paused',
        message: `Chiến dịch tạm dừng: ${reason}`,
        timestamp: new Date(),
        metadata: { reason }
    });
    
    await this.save();
};

/**
 * Dừng chiến dịch (auto-stop khi bị block)
 * @param {String} reason - Lý do dừng
 */
campaignSchema.methods.stopCampaign = async function(reason = 'Tài khoản bị block') {
    this.status = 'stopped';
    this.isBlocked = true;
    this.blockReason = reason;
    this.blockedAt = new Date();
    
    this.activityLogs.push({
        action: 'stopped',
        message: `Chiến dịch dừng: ${reason}`,
        timestamp: new Date(),
        metadata: { reason }
    });
    
    await this.save();
};

/**
 * Random một slug từ danh sách
 * @returns {String}
 */
campaignSchema.methods.getRandomSlug = function() {
    if (!this.slugs || this.slugs.length === 0) {
        throw new Error('Không có slug nào trong chiến dịch');
    }
    
    const randomIndex = Math.floor(Math.random() * this.slugs.length);
    return this.slugs[randomIndex];
};

/**
 * Random một comment template từ danh sách
 * @returns {String}
 */
campaignSchema.methods.getRandomCommentTemplate = function() {
    if (!this.commentTemplates || this.commentTemplates.length === 0) {
        throw new Error('Không có comment template nào trong chiến dịch');
    }
    
    const randomIndex = Math.floor(Math.random() * this.commentTemplates.length);
    return this.commentTemplates[randomIndex];
};

/**
 * Generate comment với slug random
 * @returns {Object} - { text, slug, fullUrl }
 * NOTE: Uses FRONTEND_URL for public links
 */
campaignSchema.methods.generateComment = function(baseUrl = null) {
    // Use FRONTEND_URL for all public links
    const siteUrl = baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    
    const template = this.getRandomCommentTemplate();
    const slug = this.getRandomSlug();
    
    // Ensure proper URL format
    const urlPath = siteUrl.endsWith('/go') ? siteUrl : `${siteUrl}/go`;
    const fullUrl = `${urlPath}/${slug}`;
    
    // Replace placeholder {link} trong template
    const text = template.replace(/\{link\}/g, fullUrl);
    
    return {
        text,
        slug,
        fullUrl
    };
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get campaigns theo user
 * @param {String} userId
 * @param {Object} options - { status, page, limit }
 */
campaignSchema.statics.getCampaignsByUser = async function(userId, options = {}) {
    const {
        status,
        page = 1,
        limit = 20
    } = options;
    
    const query = { userId };
    
    if (status) {
        query.status = status;
    }
    
    const total = await this.countDocuments(query);
    const campaigns = await this.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .populate('facebookAccountId', 'name profileUrl');
    
    return {
        campaigns,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
    };
};

/**
 * Get active campaigns cần chạy
 */
campaignSchema.statics.getActiveCampaigns = async function() {
    const now = new Date();
    
    return await this.find({
        status: 'active',
        isBlocked: false,
        startDate: { $lte: now },
        endDate: { $gte: now }
    }).populate('facebookAccountId', 'accessToken cookie');
};

// ============================================
// EXPORT MODEL
// ============================================

const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign;
