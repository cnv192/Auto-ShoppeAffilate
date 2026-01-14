const ResourceSet = require('../models/ResourceSet');

/**
 * ResourceSet Controller
 * 
 * Handles CRUD operations for Resource Sets (Comment Templates, Group Lists, Fanpage Lists)
 * These are reusable presets for campaign configuration.
 */

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
 * Create a new Resource Set
 * POST /api/resource-sets
 */
exports.create = async (req, res) => {
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
        
        // Parse content (can be array or newline-separated string from textarea)
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
};

/**
 * Get all Resource Sets for the current user
 * GET /api/resource-sets
 * Query params: type (optional), page, limit
 */
exports.getAll = async (req, res) => {
    try {
        const { type, page = 1, limit = 50 } = req.query;
        
        // Build query - get user's sets and default sets
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
        console.error('❌ [ResourceSet] GetAll error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách Resource Sets',
            error: error.message
        });
    }
};

/**
 * Get a single Resource Set by ID
 * GET /api/resource-sets/:id
 */
exports.getOne = async (req, res) => {
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
                message: 'Resource Set không tìm thấy'
            });
        }
        
        res.json({
            success: true,
            data: resourceSet
        });
        
    } catch (error) {
        console.error('❌ [ResourceSet] GetOne error:', error);
        
        // Handle invalid ObjectId
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'ID không hợp lệ'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy Resource Set',
            error: error.message
        });
    }
};

/**
 * Update a Resource Set
 * PUT /api/resource-sets/:id
 */
exports.update = async (req, res) => {
    try {
        const { name, description, type, content } = req.body;
        
        // Find the set (only owner can update, not default sets)
        const resourceSet = await ResourceSet.findOne({
            _id: req.params.id,
            userId: req.user._id,
            isDefault: { $ne: true }
        });
        
        if (!resourceSet) {
            return res.status(404).json({
                success: false,
                message: 'Resource Set không tìm thấy hoặc không có quyền chỉnh sửa'
            });
        }
        
        // Update fields if provided
        if (name !== undefined) resourceSet.name = name;
        if (description !== undefined) resourceSet.description = description;
        if (type !== undefined) {
            const validTypes = ['comment', 'group', 'page'];
            if (!validTypes.includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: `Loại không hợp lệ. Chỉ chấp nhận: ${validTypes.join(', ')}`
                });
            }
            resourceSet.type = type;
        }
        
        // Parse content if provided (textarea string -> array)
        if (content !== undefined) {
            const parsedContent = parseListInput(content);
            if (parsedContent.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Content không được để trống'
                });
            }
            resourceSet.content = parsedContent;
        }
        
        await resourceSet.save();
        
        console.log(`✅ [ResourceSet] Updated: ${resourceSet.name}`);
        
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
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'ID không hợp lệ'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật Resource Set',
            error: error.message
        });
    }
};

/**
 * Delete a Resource Set
 * DELETE /api/resource-sets/:id
 */
exports.delete = async (req, res) => {
    try {
        // Only owner can delete, and default sets cannot be deleted
        const resourceSet = await ResourceSet.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
            isDefault: { $ne: true }
        });
        
        if (!resourceSet) {
            return res.status(404).json({
                success: false,
                message: 'Resource Set không tìm thấy hoặc không có quyền xóa'
            });
        }
        
        console.log(`✅ [ResourceSet] Deleted: ${resourceSet.name}`);
        
        res.json({
            success: true,
            message: 'Resource Set đã được xóa'
        });
        
    } catch (error) {
        console.error('❌ [ResourceSet] Delete error:', error);
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'ID không hợp lệ'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi xóa Resource Set',
            error: error.message
        });
    }
};

/**
 * Get Resource Sets by type
 * GET /api/resource-sets/by-type/:type
 */
exports.getByType = async (req, res) => {
    try {
        const { type } = req.params;
        
        const validTypes = ['comment', 'group', 'page'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: `Loại không hợp lệ. Chỉ chấp nhận: ${validTypes.join(', ')}`
            });
        }
        
        const resourceSets = await ResourceSet.find({
            type,
            $or: [
                { userId: req.user._id },
                { isDefault: true }
            ]
        })
            .sort({ isDefault: -1, usageCount: -1, name: 1 })
            .select('_id name description type contentCount usageCount isDefault')
            .lean();
        
        // Add content count for display
        const setsWithCount = resourceSets.map(set => ({
            ...set,
            contentCount: set.contentCount || 0
        }));
        
        res.json({
            success: true,
            data: setsWithCount
        });
        
    } catch (error) {
        console.error('❌ [ResourceSet] GetByType error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy Resource Sets theo loại',
            error: error.message
        });
    }
};

/**
 * Mark a Resource Set as used (increment usage count)
 * POST /api/resource-sets/:id/use
 */
exports.markAsUsed = async (req, res) => {
    try {
        const resourceSet = await ResourceSet.findOneAndUpdate(
            {
                _id: req.params.id,
                $or: [
                    { userId: req.user._id },
                    { isDefault: true }
                ]
            },
            {
                $inc: { usageCount: 1 },
                lastUsedAt: new Date()
            },
            { new: true }
        );
        
        if (!resourceSet) {
            return res.status(404).json({
                success: false,
                message: 'Resource Set không tìm thấy'
            });
        }
        
        res.json({
            success: true,
            data: {
                usageCount: resourceSet.usageCount,
                lastUsedAt: resourceSet.lastUsedAt
            }
        });
        
    } catch (error) {
        console.error('❌ [ResourceSet] MarkAsUsed error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi đánh dấu sử dụng',
            error: error.message
        });
    }
};

/**
 * Export utility for use in other modules
 */
exports.parseListInput = parseListInput;
