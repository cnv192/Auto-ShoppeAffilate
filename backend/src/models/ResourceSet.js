const mongoose = require('mongoose');

/**
 * ResourceSet Schema - Quản lý tập hợp tài nguyên được lưu trước
 * 
 * Cho phép người dùng lưu và tái sử dụng:
 * - Comment templates
 * - Target Groups (Facebook Groups)
 * - Target Fanpages
 * 
 * Features:
 * - CRUD operations
 * - User-specific sets
 * - Import/Export data
 */

const resourceSetSchema = new mongoose.Schema({
    // ============================================
    // BASIC INFO
    // ============================================
    
    name: {
        type: String,
        required: [true, 'Tên Resource Set là bắt buộc'],
        trim: true,
        maxlength: [100, 'Tên không được quá 100 ký tự']
    },

    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Mô tả không được quá 500 ký tự']
    },

    // ============================================
    // TYPE & CONTENT
    // ============================================

    /**
     * Type of resource set:
     * - 'comment': Comment templates
     * - 'group': Facebook Group URLs
     * - 'page': Facebook Fanpage URLs
     */
    type: {
        type: String,
        required: [true, 'Loại Resource Set là bắt buộc'],
        enum: {
            values: ['comment', 'group', 'page'],
            message: 'Loại không hợp lệ. Chỉ chấp nhận: comment, group, page'
        },
        index: true
    },

    /**
     * Content array - stores the actual data
     * For 'comment': Array of comment templates
     * For 'group': Array of Facebook Group URLs
     * For 'page': Array of Facebook Fanpage URLs
     */
    content: [{
        type: String,
        trim: true
    }],

    // ============================================
    // OWNERSHIP
    // ============================================

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // ============================================
    // METADATA
    // ============================================

    // Is this a default/shared set (created by admin for all users)?
    isDefault: {
        type: Boolean,
        default: false,
        index: true
    },

    // Usage statistics
    usageCount: {
        type: Number,
        default: 0
    },

    lastUsedAt: {
        type: Date
    }

}, {
    timestamps: true
});

// ============================================
// INDEXES
// ============================================

// Compound index for efficient user + type queries
resourceSetSchema.index({ userId: 1, type: 1 });
resourceSetSchema.index({ userId: 1, createdAt: -1 });
resourceSetSchema.index({ isDefault: 1, type: 1 });

// ============================================
// STATICS
// ============================================

/**
 * Find all resource sets for a user (including default sets)
 * @param {ObjectId} userId - User ID
 * @param {String} type - Optional: filter by type
 * @returns {Array} Resource sets
 */
resourceSetSchema.statics.findForUser = async function(userId, type = null) {
    const query = {
        $or: [
            { userId: userId },
            { isDefault: true }
        ]
    };
    
    if (type) {
        query.type = type;
    }
    
    return this.find(query)
        .sort({ isDefault: -1, usageCount: -1, updatedAt: -1 })
        .lean();
};

/**
 * Increment usage count
 * @param {ObjectId} setId - Resource Set ID
 */
resourceSetSchema.statics.incrementUsage = async function(setId) {
    return this.findByIdAndUpdate(setId, {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date() }
    });
};

// ============================================
// METHODS
// ============================================

/**
 * Get content as newline-separated string (for textarea display)
 * @returns {String}
 */
resourceSetSchema.methods.getContentAsString = function() {
    return this.content.join('\n');
};

/**
 * Get display label (with item count)
 * @returns {String}
 */
resourceSetSchema.methods.getDisplayLabel = function() {
    const typeLabels = {
        comment: 'Comment Templates',
        group: 'Groups',
        page: 'Fanpages'
    };
    const typeLabel = typeLabels[this.type] || this.type;
    return `${this.name} (${this.content.length} ${typeLabel})`;
};

// ============================================
// VIRTUALS
// ============================================

resourceSetSchema.virtual('itemCount').get(function() {
    return this.content?.length || 0;
});

// Include virtuals in JSON output
resourceSetSchema.set('toJSON', { virtuals: true });
resourceSetSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ResourceSet', resourceSetSchema);
