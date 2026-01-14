const mongoose = require('mongoose');

/**
 * FacebookAccount Schema - Lưu trữ thông tin tài khoản Facebook
 * 
 * Features:
 * - Lưu Access Token và Cookie từ Facebook login
 * - Track expiration time
 * - Health check status
 * - Link với User
 */

const facebookAccountSchema = new mongoose.Schema({
    // ============================================
    // BASIC INFO
    // ============================================
    
    name: {
        type: String,
        required: [true, 'Tên tài khoản Facebook là bắt buộc'],
        trim: true,
        maxlength: [100, 'Tên không được quá 100 ký tự']
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // ============================================
    // FACEBOOK DATA
    // ============================================

    facebookId: {
        type: String,
        sparse: true, // Cho phép null/undefined nhưng unique khi có giá trị
        unique: true,
        index: true
    },

    email: {
        type: String,
        trim: true,
        lowercase: true
    },

    profileUrl: {
        type: String,
        trim: true
    },

    avatarUrl: {
        type: String,
        trim: true
    },

    // ============================================
    // AUTHENTICATION
    // ============================================

    accessToken: {
        type: String,
        select: false // Không trả về mặc định (bảo mật)
    },

    // Facebook Cookie (JSON string hoặc cookie header format)
    cookie: {
        type: String,
        select: false // Không trả về mặc định (bảo mật)
    },
    
    // ============================================
    // FACEBOOK TOKENS (for posting)
    // ============================================
    
    // fb_dtsg - CSRF token cần để đăng bài
    fb_dtsg: {
        type: String,
        select: false
    },
    
    // jazoest - Security token
    jazoest: {
        type: String,
        select: false
    },
    
    // lsd - Login Security Data
    lsd: {
        type: String,
        select: false
    },
    
    // User-Agent của trình duyệt (cần để đăng bài)
    userAgent: {
        type: String,
        select: false
    },

    // Token expiration
    tokenExpiresAt: {
        type: Date
    },

    // Token type (user_token, page_token, etc.)
    tokenType: {
        type: String,
        default: 'user_token'
    },
    
    // Auth mode - determines how to authenticate with Facebook
    // oauth: Has valid OAuth access token (EAA...) - can use Graph API
    // cookie_only: Only has cookie/DTSG - must use web scraping approach
    authMode: {
        type: String,
        enum: ['oauth', 'cookie_only', 'unknown'],
        default: 'unknown'
    },

    // ============================================
    // STATUS & HEALTH
    // ============================================

    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    // Trạng thái token
    tokenStatus: {
        type: String,
        enum: ['valid', 'active', 'expired', 'revoked', 'invalid', 'cookie_only'],
        default: 'valid',
        index: true
    },

    // Lần cuối kiểm tra token
    lastCheckedAt: {
        type: Date
    },

    // Lần cuối kiểm tra (alias)
    lastChecked: {
        type: Date
    },

    // Health check
    healthStatus: {
        isHealthy: {
            type: Boolean,
            default: true
        },
        lastError: {
            type: String
        },
        lastErrorAt: {
            type: Date
        }
    },

    // ============================================
    // PERMISSIONS & SCOPES
    // ============================================

    // Facebook permissions granted
    permissions: [{
        type: String
    }],

    // Scopes (email, public_profile, publish_actions, etc.)
    scopes: [{
        type: String
    }],

    // ============================================
    // USAGE STATISTICS
    // ============================================

    stats: {
        totalCampaigns: {
            type: Number,
            default: 0
        },
        totalCommentsSent: {
            type: Number,
            default: 0
        },
        lastUsedAt: {
            type: Date
        }
    },

    // ============================================
    // METADATA
    // ============================================

    // Lần đầu kết nối
    connectedAt: {
        type: Date,
        default: Date.now
    },

    // Lần cuối cập nhật token
    lastRefreshedAt: {
        type: Date
    },

    // User agent (để tracking)
    userAgent: {
        type: String
    },

    // IP address khi kết nối
    connectedFromIP: {
        type: String
    }

}, {
    timestamps: true
});

// ============================================
// INDEXES
// ============================================

facebookAccountSchema.index({ userId: 1, isActive: 1 });
facebookAccountSchema.index({ tokenStatus: 1 });
facebookAccountSchema.index({ tokenExpiresAt: 1 });
facebookAccountSchema.index({ facebookId: 1 }, { unique: true });

// ============================================
// METHODS
// ============================================

/**
 * Kiểm tra token có còn valid không
 * @returns {Boolean}
 */
facebookAccountSchema.methods.isTokenValid = function() {
    // Accept 'valid', 'active', and 'cookie_only' as valid statuses
    // cookie_only means we can still operate using cookies
    if (!['valid', 'active', 'cookie_only'].includes(this.tokenStatus)) {
        return false;
    }
    
    // For OAuth tokens, check expiry
    if (this.authMode === 'oauth' && this.tokenExpiresAt && new Date() >= this.tokenExpiresAt) {
        return false;
    }
    
    return true;
};

/**
 * Kiểm tra token sắp hết hạn (trong 7 ngày)
 * @returns {Boolean}
 */
facebookAccountSchema.methods.isTokenExpiringSoon = function() {
    if (!this.tokenExpiresAt) {
        return false;
    }
    
    const daysUntilExpiry = (this.tokenExpiresAt - new Date()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 7;
};

/**
 * Cập nhật token mới
 * @param {Object} data - { accessToken, cookie, expiresIn }
 */
facebookAccountSchema.methods.updateToken = async function(data) {
    const { accessToken, cookie, expiresIn = 5184000 } = data; // Default 60 days
    
    this.accessToken = accessToken;
    
    if (cookie) {
        this.cookie = typeof cookie === 'string' ? cookie : JSON.stringify(cookie);
    }
    
    this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    this.tokenStatus = 'valid';
    this.lastRefreshedAt = new Date();
    
    await this.save();
};

/**
 * Đánh dấu token hết hạn
 */
facebookAccountSchema.methods.markTokenExpired = async function() {
    this.tokenStatus = 'expired';
    this.isActive = false;
    await this.save();
};

/**
 * Đánh dấu token bị revoke
 * @param {String} reason
 */
facebookAccountSchema.methods.markTokenRevoked = async function(reason) {
    this.tokenStatus = 'revoked';
    this.isActive = false;
    this.healthStatus.isHealthy = false;
    this.healthStatus.lastError = reason;
    this.healthStatus.lastErrorAt = new Date();
    await this.save();
};

/**
 * Cập nhật health status
 * @param {Boolean} isHealthy
 * @param {String} error
 */
facebookAccountSchema.methods.updateHealthStatus = async function(isHealthy, error = null) {
    this.healthStatus.isHealthy = isHealthy;
    this.lastCheckedAt = new Date();
    
    if (!isHealthy && error) {
        this.healthStatus.lastError = error;
        this.healthStatus.lastErrorAt = new Date();
    }
    
    await this.save();
};

/**
 * Ghi nhận sử dụng (cho campaign)
 */
facebookAccountSchema.methods.recordUsage = async function() {
    this.stats.lastUsedAt = new Date();
    await this.save();
};

/**
 * Get safe object (không bao gồm token/cookie)
 * @returns {Object}
 */
facebookAccountSchema.methods.toSafeObject = function() {
    const obj = this.toObject({ virtuals: true });
    delete obj.accessToken;
    delete obj.cookie;
    delete obj.fb_dtsg;
    delete obj.jazoest;
    delete obj.lsd;
    delete obj.userAgent;
    return obj;
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Get Facebook accounts by user
 * @param {String} userId
 * @param {Object} options - { isActive }
 */
facebookAccountSchema.statics.getByUser = async function(userId, options = {}) {
    const query = { userId };
    
    if (options.isActive !== undefined) {
        query.isActive = options.isActive;
    }
    
    const accounts = await this.find(query)
        .select('-accessToken -cookie -fb_dtsg -jazoest -lsd -userAgent')
        .sort({ createdAt: -1 })
        .lean();
    
    // Add healthStatusString for each account
    return accounts.map(acc => {
        const healthStatus = acc.healthStatus || {};
        let healthStatusString = 'unknown';
        
        if (healthStatus.isHealthy === false) {
            if (acc.tokenStatus === 'revoked') healthStatusString = 'blocked';
            else if (acc.tokenStatus === 'expired') healthStatusString = 'warning';
            else healthStatusString = 'warning';
        } else if (healthStatus.isHealthy === true) {
            healthStatusString = 'healthy';
        } else if (!acc.lastCheckedAt) {
            healthStatusString = 'unknown';
        }
        
        return {
            ...acc,
            healthStatusString
        };
    });
    
    // Add healthStatusString for each account
    return accounts.map(acc => {
        const healthStatus = acc.healthStatus || {};
        let healthStatusString = 'unknown';
        
        if (healthStatus.isHealthy === false) {
            if (acc.tokenStatus === 'revoked') healthStatusString = 'blocked';
            else if (acc.tokenStatus === 'expired') healthStatusString = 'warning';
            else healthStatusString = 'warning';
        } else if (healthStatus.isHealthy === true) {
            healthStatusString = 'healthy';
        } else if (!acc.lastCheckedAt) {
            healthStatusString = 'unknown';
        }
        
        return {
            ...acc,
            healthStatusString
        };
    });
};

/**
 * Get account với token (cho automation)
 * @param {String} accountId
 */
facebookAccountSchema.statics.getWithToken = async function(accountId) {
    const account = await this.findById(accountId)
        .select('+accessToken +cookie +fb_dtsg +jazoest +lsd +userAgent');
    
    // Check if account exists and has necessary data
    if (!account) {
        return null;
    }
    
    // Check if account is active
    if (!account.isActive) {
        console.log(`⚠️ Account ${accountId} is inactive`);
        return null;
    }
    
    // Check if has access token or cookie
    if (!account.accessToken && !account.cookie) {
        console.log(`⚠️ Account ${accountId} has no token/cookie`);
        return null;
    }
    
    return account;
};

/**
 * Check và update expired tokens
 */
facebookAccountSchema.statics.checkExpiredTokens = async function() {
    const now = new Date();
    
    const result = await this.updateMany(
        {
            tokenExpiresAt: { $lt: now },
            tokenStatus: 'valid'
        },
        {
            $set: {
                tokenStatus: 'expired',
                isActive: false
            }
        }
    );
    
    return result;
};

/**
 * Get accounts cần refresh (sắp hết hạn)
 */
facebookAccountSchema.statics.getAccountsNeedingRefresh = async function() {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    return await this.find({
        tokenStatus: 'valid',
        isActive: true,
        tokenExpiresAt: {
            $lt: sevenDaysFromNow,
            $gt: new Date()
        }
    });
};

// ============================================
// VIRTUAL FIELDS
// ============================================

facebookAccountSchema.virtual('campaignsCount', {
    ref: 'Campaign',
    localField: '_id',
    foreignField: 'facebookAccountId',
    count: true
});

facebookAccountSchema.virtual('daysUntilExpiry').get(function() {
    if (!this.tokenExpiresAt) {
        return null;
    }
    
    const days = Math.ceil((this.tokenExpiresAt - new Date()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
});

// Virtual field to convert healthStatus to simple string for frontend
facebookAccountSchema.virtual('healthStatusString').get(function() {
    if (!this.healthStatus || !this.healthStatus.isHealthy) {
        if (this.tokenStatus === 'revoked') return 'blocked';
        if (this.tokenStatus === 'expired') return 'warning';
        if (!this.lastCheckedAt) return 'unknown';
        return 'warning';
    }
    return 'healthy';
});

// ============================================
// MIDDLEWARE
// ============================================

// Auto-check token validity before save
facebookAccountSchema.pre('save', function(next) {
    if (this.tokenExpiresAt && new Date() >= this.tokenExpiresAt) {
        this.tokenStatus = 'expired';
        this.isActive = false;
    }
    next();
});

// ============================================
// EXPORT MODEL
// ============================================

const FacebookAccount = mongoose.model('FacebookAccount', facebookAccountSchema);

module.exports = FacebookAccount;
