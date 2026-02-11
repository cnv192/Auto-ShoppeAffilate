const mongoose = require('mongoose');

/**
 * FacebookOperation Schema - Lưu trữ Dynamic Doc ID từ Extension
 * 
 * Mục đích:
 * - Tự động cập nhật doc_id từ Extension (Self-Healing)
 * - Thay thế hardcode doc_id
 * - Hỗ trợ Anti-Detect
 * 
 * v2.0 Features:
 * - Unique friendlyName (ví dụ: CometUFICreateCommentMutation)
 * - Dynamic docId (cập nhật mỗi lần Facebook thay đổi)
 * - Timestamp tracking
 * - Version management
 */

const facebookOperationSchema = new mongoose.Schema({
    // ============================================
    // OPERATION IDENTIFICATION
    // ============================================
    
    /**
     * Friendly name của operation - UNIQUE KEY
     * Ví dụ:
     * - CometUFICreateCommentMutation
     * - CometUFILiveTypingBroadcastMutation_StartMutation
     * - CometUFILiveTypingBroadcastMutation_StopMutation
     * - CometNewsFeedPaginationQuery
     * - CommentsListComponentsPaginationQuery
     * - CometFocusedStoryViewUFIQuery
     * - FBScreenTimeLogger_syncMutation
     */
    friendlyName: {
        type: String,
        required: [true, 'Friendly name là bắt buộc'],
        unique: true,
        trim: true,
        maxlength: [200, 'Friendly name không được quá 200 ký tự'],
        index: true
    },

    // ============================================
    // DOC_ID (DYNAMIC)
    // ============================================
    
    /**
     * Mã định danh duy nhất của operation trên Facebook
     * Thay đổi khi Facebook cập nhật code
     * Ví dụ: 2345678901234567
     */
    docId: {
        type: String,
        required: [true, 'Doc ID là bắt buộc'],
        trim: true,
        maxlength: [100, 'Doc ID không được quá 100 ký tự']
    },

    // ============================================
    // METADATA
    // ============================================
    
    /**
     * Thời điểm cập nhật cuối cùng
     * Dùng để theo dõi tuổi của doc_id
     */
    lastUpdated: {
        type: Date,
        default: Date.now,
        index: true
    },

    /**
     * Tổng số lần được cập nhật
     * Dùng để tracking tần suất thay đổi
     */
    updateCount: {
        type: Number,
        default: 1
    },

    /**
     * Phiên bản của operation schema
     * Giúp track breaking changes từ Facebook
     */
    version: {
        type: String,
        default: '1.0'
    },

    /**
     * Trạng thái hoạt động
     */
    status: {
        type: String,
        enum: ['active', 'deprecated', 'pending'],
        default: 'active',
        index: true
    },

    /**
     * Priority level - Dùng để xác định độ quan trọng của operation
     * Được xác định tự động dựa trên loại operation
     * 
     * high: Comment, Like, Reaction, Scroll, Typing, Share, Message, Block
     * medium: Follow, Unfollow, View, Search
     * low: Mọi operation khác
     * 
     * Dùng để xác định xen kẽ behavioral operations trong simulation
     */
    priority: {
        type: String,
        enum: ['high', 'medium', 'low'],
        default: 'low',
        index: true
    },

    /**
     * Ghi chú từ người dùng
     * (optional) - ví dụ: lý do deprecated, chú thích đặc biệt
     */
    notes: {
        type: String,
        default: ''
    },

    /**
     * Nguồn cập nhật
     * - extension: Từ Browser Extension (Tự động)
     * - manual: Từ người dùng nhập (Thủ công)
     */
    source: {
        type: String,
        enum: ['extension', 'manual'],
        default: 'extension'
    },

    /**
     * ID của Extension đã gửi cập nhật cuối cùng
     */
    lastUpdatedBy: {
        type: String,
        default: 'unknown'
    },

    // ============================================
    // TIMESTAMPS
    // ============================================

    createdAt: {
        type: Date,
        default: Date.now
    },

    // Mongoose sẽ tự động cập nhật updatedAt mỗi lần save
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'facebook_operations'
});

// ============================================
// INDEXES
// ============================================

// Note: Indexes are already declared at field level (unique, index: true)
// No need for redundant schema.index() calls

// ============================================
// HELPER: Determine priority based on operation type
// ============================================

/**
 * Xác định priority dựa trên friendlyName
 * HIGH: Comment, Like, Reaction, Scroll, Typing, Share, Message, Block
 * MEDIUM: Follow, Unfollow, View, Search
 * LOW: Các operation khác
 */
function determinePriority(friendlyName) {
    const name = friendlyName.toLowerCase();
    
    // HIGH priority operations
    const highKeywords = [
        'comment', 'like', 'reaction',
        'scroll', 'typing', 'broadcast',
        'share', 'message', 'block',
        'unblock', 'unfriend', 'mute',
        'unmute', 'createcomment', 'deletecomment'
    ];
    
    // MEDIUM priority operations
    const mediumKeywords = [
        'follow', 'unfollow', 'view',
        'search', 'profile', 'timeline',
        'hover', 'click'
    ];
    
    for (const keyword of highKeywords) {
        if (name.includes(keyword)) {
            return 'high';
        }
    }
    
    for (const keyword of mediumKeywords) {
        if (name.includes(keyword)) {
            return 'medium';
        }
    }
    
    return 'low';
}

// ============================================
// METHODS
// ============================================

/**
 * Update doc_id (tự động increment updateCount)
 */
facebookOperationSchema.methods.updateDocId = async function(newDocId, source = 'extension') {
    if (newDocId === this.docId) {
        console.log(`[FacebookOperation] Doc ID unchanged: ${this.friendlyName}`);
        return this;
    }

    console.log(`[FacebookOperation] Updating ${this.friendlyName}: ${this.docId} -> ${newDocId}`);
    
    this.docId = newDocId;
    this.lastUpdated = new Date();
    this.updateCount = (this.updateCount || 1) + 1;
    this.source = source;
    this.status = 'active';
    
    return this.save();
};

/**
 * Mark as deprecated (khi Facebook thay đổi cấu trúc)
 */
facebookOperationSchema.methods.deprecate = async function(reason = '') {
    this.status = 'deprecated';
    this.notes = reason;
    return this.save();
};

/**
 * Get age of doc_id in minutes
 */
facebookOperationSchema.methods.getAge = function() {
    const now = new Date();
    const diff = now - this.lastUpdated;
    return Math.floor(diff / 60000); // Convert to minutes
};

/**
 * Check if doc_id is stale (>1 day old)
 */
facebookOperationSchema.methods.isStale = function() {
    return this.getAge() > (24 * 60); // More than 1 day
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Lấy doc_id theo friendlyName
 */
facebookOperationSchema.statics.getDocId = async function(friendlyName) {
    try {
        const operation = await this.findOne({ 
            friendlyName, 
            status: 'active' 
        });
        
        if (!operation) {
            console.warn(`[FacebookOperation] Operation not found: ${friendlyName}`);
            return null;
        }
        
        console.log(`[FacebookOperation] Found doc_id for ${friendlyName}: ${operation.docId}`);
        return operation.docId;
    } catch (error) {
        console.error(`[FacebookOperation] Error getting doc_id:`, error);
        return null;
    }
};

/**
 * Sync doc_id từ Extension (auto-create if not exists)
 */
facebookOperationSchema.statics.syncFromExtension = async function(friendlyName, docId, extensionId = 'unknown') {
    try {
        const operation = await this.findOneAndUpdate(
            { friendlyName },
            {
                $set: {
                    docId,
                    lastUpdated: new Date(),
                    source: 'extension',
                    lastUpdatedBy: extensionId,
                    status: 'active'
                },
                $inc: { updateCount: 1 }
            },
            {
                upsert: true,
                new: true,
                runValidators: true
            }
        );
        
        console.log(`[FacebookOperation] Synced: ${friendlyName} = ${docId}`);
        return operation;
    } catch (error) {
        console.error(`[FacebookOperation] Sync error:`, error);
        throw error;
    }
};

/**
 * Lấy danh sách tất cả operations còn active
 */
facebookOperationSchema.statics.getAllActive = async function() {
    try {
        return await this.find({ status: 'active' })
            .sort({ friendlyName: 1 });
    } catch (error) {
        console.error(`[FacebookOperation] Error getting all operations:`, error);
        return [];
    }
};

/**
 * Lấy danh sách operations cũ hơn X ngày
 */
facebookOperationSchema.statics.getStaleOperations = async function(daysOld = 1) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        return await this.find({
            status: 'active',
            lastUpdated: { $lt: cutoffDate }
        }).sort({ lastUpdated: 1 });
    } catch (error) {
        console.error(`[FacebookOperation] Error getting stale operations:`, error);
        return [];
    }
};

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Auto-update updatedAt timestamp trước khi save
 */
facebookOperationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

/**
 * Log when document is created
 */
facebookOperationSchema.post('save', function(doc) {
    if (doc.isNew) {
        console.log(`[FacebookOperation] Created: ${doc.friendlyName} = ${doc.docId}`);
    }
});

// ============================================
// CREATE & EXPORT MODEL
// ============================================

const FacebookOperation = mongoose.model('FacebookOperation', facebookOperationSchema);

module.exports = FacebookOperation;
