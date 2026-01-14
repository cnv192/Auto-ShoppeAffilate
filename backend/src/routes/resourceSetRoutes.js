const express = require('express');
const router = express.Router();
const ResourceSet = require('../models/ResourceSet');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * Helper: Parse textarea/string inputs into arrays
 * Splits by newline, handles CRLF, trims whitespace, removes empty lines.
 * @param {String|Array} input - Input value (string or array)
 * @returns {Array} - Cleaned array of non-empty strings
 */
const parseListInput = (input) => {
    if (!input) return [];
    
    // If it's already an array, clean each item
    if (Array.isArray(input)) {
        return input
            .map(x => (typeof x === 'string' ? x.trim() : x))
            .filter(x => x && (typeof x !== 'string' || x.length > 0));
    }
    
    // If it's a string, split by newline (handles \n and \r\n)
    if (typeof input === 'string') {
        return input
            .split(/\r?\n/) // Split by \n or \r\n
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }
    
    return [];
};

/**
 * Resource Set Routes
 * 
 * POST   /api/resource-sets - Tạo resource set mới
 * GET    /api/resource-sets - Lấy danh sách resource sets
 * GET    /api/resource-sets/:id - Lấy chi tiết resource set
 * PUT    /api/resource-sets/:id - Cập nhật resource set
 * DELETE /api/resource-sets/:id - Xóa resource set
 * 
 * GET    /api/resource-sets/by-type/:type - Lấy resource sets theo loại
 * POST   /api/resource-sets/:id/use - Đánh dấu đã sử dụng (tăng usage count)
 */

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * POST /api/resource-sets
 * Tạo resource set mới
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { name, description, type, content } = req.body;
        
        // Validate type
        const validTypes = ['comment', 'group', 'page'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: `Loại không hợp lệ. Chỉ chấp nhận: ${validTypes.join(', ')}`
            });
        }
        
        // Parse content (can be array or newline-separated string)
        const parsedContent = parseListInput(content);
        
        if (parsedContent.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Content không được để trống'
            });
        }
        
        const resourceSet = new ResourceSet({
            name,
            description,
            type,
            content: parsedContent,
            userId: req.user._id
        });
        
        await resourceSet.save();
        
        console.log(`✅ [ResourceSet] Created: ${name} (${type}) with ${parsedContent.length} items`);
        
        res.status(201).json({
            success: true,
            message: 'Resource Set đã được tạo thành công',
            data: resourceSet
        });
        
    } catch (error) {
        console.error('❌ [ResourceSet] Create error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: messages
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi tạo Resource Set',
            error: error.message
        });
    }
});

/**
 * GET /api/resource-sets
 * Lấy danh sách resource sets của user (bao gồm default sets)
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const { type, page = 1, limit = 50 } = req.query;
        
        // Build query
        const query = {
            $or: [
                { userId: req.user._id },
                { isDefault: true }
            ]
        };
        
        if (type) {
            query.type = type;
        }
        
        const total = await ResourceSet.countDocuments(query);
        const resourceSets = await ResourceSet.find(query)
            .sort({ isDefault: -1, usageCount: -1, updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .lean();
        
        res.json({
            success: true,
            data: {
                resourceSets,
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        console.error('❌ [ResourceSet] List error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách Resource Set',
            error: error.message
        });
    }
});

/**
 * GET /api/resource-sets/by-type/:type
 * Lấy resource sets theo loại (for dropdown select)
 */
router.get('/by-type/:type', authenticate, async (req, res) => {
    try {
        const { type } = req.params;
        
        // Validate type
        const validTypes = ['comment', 'group', 'page'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: `Loại không hợp lệ. Chỉ chấp nhận: ${validTypes.join(', ')}`
            });
        }
        
        const resourceSets = await ResourceSet.findForUser(req.user._id, type);
        
        // Format for dropdown: add displayLabel
        const formattedSets = resourceSets.map(set => ({
            ...set,
            displayLabel: `${set.name} (${set.content?.length || 0} items)`,
            contentString: set.content?.join('\n') || ''
        }));
        
        res.json({
            success: true,
            data: formattedSets
        });
        
    } catch (error) {
        console.error('❌ [ResourceSet] Get by type error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy Resource Set theo loại',
            error: error.message
        });
    }
});

/**
 * GET /api/resource-sets/:id
 * Lấy chi tiết resource set
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const resourceSet = await ResourceSet.findOne({
            _id: req.params.id,
            $or: [
                { userId: req.user._id },
                { isDefault: true }
            ]
        });
        
        if (!resourceSet) {
            return res.status(404).json({
                success: false,
                message: 'Resource Set không tồn tại hoặc bạn không có quyền truy cập'
            });
        }
        
        res.json({
            success: true,
            data: resourceSet
        });
        
    } catch (error) {
        console.error('❌ [ResourceSet] Get error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy Resource Set',
            error: error.message
        });
    }
});

/**
 * PUT /api/resource-sets/:id
 * Cập nhật resource set
 */
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { name, description, content } = req.body;
        
        // Find resource set (only owner can update, not default sets unless admin)
        const resourceSet = await ResourceSet.findOne({
            _id: req.params.id,
            userId: req.user._id,
            isDefault: false // Cannot update default sets via this endpoint
        });
        
        if (!resourceSet) {
            return res.status(404).json({
                success: false,
                message: 'Resource Set không tồn tại hoặc bạn không có quyền chỉnh sửa'
            });
        }
        
        // Update fields
        if (name) resourceSet.name = name;
        if (description !== undefined) resourceSet.description = description;
        if (content) {
            resourceSet.content = parseListInput(content);
        }
        
        await resourceSet.save();
        
        console.log(`✅ [ResourceSet] Updated: ${resourceSet.name} (${resourceSet.type})`);
        
        res.json({
            success: true,
            message: 'Resource Set đã được cập nhật',
            data: resourceSet
        });
        
    } catch (error) {
        console.error('❌ [ResourceSet] Update error:', error);
        
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: messages
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật Resource Set',
            error: error.message
        });
    }
});

/**
 * DELETE /api/resource-sets/:id
 * Xóa resource set
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        // Find resource set (only owner can delete, not default sets unless admin)
        const resourceSet = await ResourceSet.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
            isDefault: false // Cannot delete default sets via this endpoint
        });
        
        if (!resourceSet) {
            return res.status(404).json({
                success: false,
                message: 'Resource Set không tồn tại hoặc bạn không có quyền xóa'
            });
        }
        
        console.log(`🗑️ [ResourceSet] Deleted: ${resourceSet.name} (${resourceSet.type})`);
        
        res.json({
            success: true,
            message: 'Resource Set đã được xóa'
        });
        
    } catch (error) {
        console.error('❌ [ResourceSet] Delete error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi xóa Resource Set',
            error: error.message
        });
    }
});

/**
 * POST /api/resource-sets/:id/use
 * Đánh dấu đã sử dụng resource set (tăng usage count)
 */
router.post('/:id/use', authenticate, async (req, res) => {
    try {
        const resourceSet = await ResourceSet.findOne({
            _id: req.params.id,
            $or: [
                { userId: req.user._id },
                { isDefault: true }
            ]
        });
        
        if (!resourceSet) {
            return res.status(404).json({
                success: false,
                message: 'Resource Set không tồn tại'
            });
        }
        
        // Increment usage
        await ResourceSet.incrementUsage(req.params.id);
        
        res.json({
            success: true,
            message: 'Usage count đã được cập nhật',
            data: {
                content: resourceSet.content,
                contentString: resourceSet.content.join('\n')
            }
        });
        
    } catch (error) {
        console.error('❌ [ResourceSet] Use error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

// ============================================
// ADMIN ROUTES (for default sets management)
// ============================================

/**
 * POST /api/resource-sets/admin/default
 * [ADMIN] Tạo default resource set cho tất cả users
 */
router.post('/admin/default', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, description, type, content } = req.body;
        
        const parsedContent = parseListInput(content);
        
        if (parsedContent.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Content không được để trống'
            });
        }
        
        const resourceSet = new ResourceSet({
            name,
            description,
            type,
            content: parsedContent,
            userId: req.user._id,
            isDefault: true
        });
        
        await resourceSet.save();
        
        console.log(`✅ [ResourceSet] Created DEFAULT: ${name} (${type}) with ${parsedContent.length} items`);
        
        res.status(201).json({
            success: true,
            message: 'Default Resource Set đã được tạo',
            data: resourceSet
        });
        
    } catch (error) {
        console.error('❌ [ResourceSet] Create default error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server',
            error: error.message
        });
    }
});

module.exports = router;
