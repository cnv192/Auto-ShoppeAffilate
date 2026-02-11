/**
 * Category Routes
 * 
 * API Endpoints cho quản lý danh mục
 * 
 * Public:
 * - GET /api/categories/public - Lấy danh mục active
 * 
 * Admin (require auth):
 * - GET /api/categories - Lấy tất cả danh mục
 * - POST /api/categories - Tạo danh mục mới
 * - PUT /api/categories/:id - Cập nhật danh mục
 * - DELETE /api/categories/:id - Xóa danh mục
 */

const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Link = require('../models/Link');
const { authenticate, requireAdmin } = require('../middleware/auth');

// =================================================================
// PUBLIC ROUTES
// =================================================================

/**
 * GET /api/categories/public
 * Lấy danh sách danh mục active (cho frontend public & form)
 */
router.get('/public', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true })
            .sort({ sortOrder: 1, name: 1 })
            .select('name slug color icon sortOrder');

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('❌ [CategoryRoutes] Get public error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get categories'
        });
    }
});

// =================================================================
// ADMIN ROUTES (Auth required)
// =================================================================

/**
 * GET /api/categories
 * Lấy tất cả danh mục (admin)
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const categories = await Category.find()
            .sort({ sortOrder: 1, name: 1 });

        // Count articles for each category
        const categoriesWithCount = await Promise.all(
            categories.map(async (cat) => {
                const count = await Link.countDocuments({ 
                    category: cat.name, 
                    isActive: true 
                });
                return {
                    ...cat.toObject(),
                    articleCount: count
                };
            })
        );

        res.json({
            success: true,
            data: categoriesWithCount
        });
    } catch (error) {
        console.error('❌ [CategoryRoutes] GetAll error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get categories'
        });
    }
});

/**
 * POST /api/categories
 * Tạo danh mục mới
 */
router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const { name, slug, description, color, icon, sortOrder } = req.body;

        if (!name || !slug) {
            return res.status(400).json({
                success: false,
                error: 'Tên và slug là bắt buộc'
            });
        }

        // Check duplicate
        const existing = await Category.findOne({ 
            $or: [{ name }, { slug: slug.toLowerCase() }] 
        });
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Danh mục hoặc slug đã tồn tại'
            });
        }

        const category = new Category({
            name,
            slug: slug.toLowerCase(),
            description: description || '',
            color: color || '#D31016',
            icon: icon || '',
            sortOrder: sortOrder || 0
        });

        await category.save();

        res.status(201).json({
            success: true,
            data: category,
            message: 'Tạo danh mục thành công'
        });
    } catch (error) {
        console.error('❌ [CategoryRoutes] Create error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create category'
        });
    }
});

/**
 * PUT /api/categories/:id
 * Cập nhật danh mục
 */
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        delete updates._id;
        delete updates.createdAt;
        delete updates.updatedAt;

        if (updates.slug) {
            updates.slug = updates.slug.toLowerCase();
        }

        // If name changed, update all links with old category name
        const oldCategory = await Category.findById(id);
        if (!oldCategory) {
            return res.status(404).json({
                success: false,
                error: 'Danh mục không tồn tại'
            });
        }

        if (updates.name && updates.name !== oldCategory.name) {
            await Link.updateMany(
                { category: oldCategory.name },
                { category: updates.name }
            );
        }

        const category = await Category.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            data: category,
            message: 'Cập nhật danh mục thành công'
        });
    } catch (error) {
        console.error('❌ [CategoryRoutes] Update error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update category'
        });
    }
});

/**
 * DELETE /api/categories/:id
 * Xóa danh mục
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                error: 'Danh mục không tồn tại'
            });
        }

        // Check if any articles use this category
        const articleCount = await Link.countDocuments({ category: category.name });
        if (articleCount > 0) {
            return res.status(400).json({
                success: false,
                error: `Không thể xóa: có ${articleCount} bài viết đang sử dụng danh mục này`
            });
        }

        await Category.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Xóa danh mục thành công'
        });
    } catch (error) {
        console.error('❌ [CategoryRoutes] Delete error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete category'
        });
    }
});

module.exports = router;
