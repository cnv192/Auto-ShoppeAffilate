/**
 * Banner Controller
 * 
 * API Controller cho quản lý Banner
 * Hỗ trợ: CRUD, A/B Testing, Statistics
 */

const Banner = require('../models/Banner');
const Link = require('../models/Link');

/**
 * Create new Banner
 * POST /api/banners
 */
const create = async (req, res) => {
    try {
        const {
            name,
            imageUrl,
            mobileImageUrl,
            targetSlug,
            targetUrl,
            type,
            weight,
            priority,
            mobileOnly,
            desktopOnly,
            targetArticles,
            targetCategories,
            startDate,
            endDate,
            altText,
            showDelay,
            autoHideAfter,
            dismissible,
            notes
        } = req.body;

        // Validate required fields
        if (!name || !imageUrl || !targetSlug) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, imageUrl, targetSlug'
            });
        }

        // Validate targetSlug exists (optional but recommended)
        const linkExists = await Link.findOne({ slug: targetSlug.toLowerCase() });
        if (!linkExists) {
            console.warn(`⚠️ [BannerController] Target slug "${targetSlug}" not found in Links`);
        }

        // Create banner
        const banner = new Banner({
            name,
            imageUrl,
            mobileImageUrl,
            targetSlug: targetSlug.toLowerCase(),
            targetUrl,
            type: type || 'sticky_bottom',
            weight: weight || 50,
            priority: priority || 10,
            mobileOnly: mobileOnly || false,
            desktopOnly: desktopOnly || false,
            targetArticles: targetArticles || [],
            targetCategories: targetCategories || [],
            startDate: startDate || null,
            endDate: endDate || null,
            altText: altText || '',
            showDelay: showDelay || 0,
            autoHideAfter: autoHideAfter || 0,
            dismissible: dismissible !== false,
            notes: notes || '',
            createdBy: req.user?._id
        });

        await banner.save();

        console.log(`✅ [BannerController] Banner created: ${banner.name} (${banner._id})`);

        res.status(201).json({
            success: true,
            data: banner,
            message: 'Banner created successfully'
        });

    } catch (error) {
        console.error('❌ [BannerController] Create error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create banner'
        });
    }
};

/**
 * Get random active Banner (for A/B testing)
 * GET /api/banners/random
 * Query: type, device, articleSlug, category
 */
const getRandom = async (req, res) => {
    try {
        const { 
            type = 'sticky_bottom', 
            device, 
            articleSlug, 
            category 
        } = req.query;

        const banner = await Banner.getRandomActive(type, {
            device,
            articleSlug,
            category
        });

        if (!banner) {
            return res.status(404).json({
                success: false,
                error: 'No active banner found'
            });
        }

        // Record impression
        await banner.recordImpression();

        // Build response (exclude internal fields)
        const response = {
            id: banner._id,
            name: banner.name,
            imageUrl: banner.imageUrl,
            mobileImageUrl: banner.mobileImageUrl,
            targetSlug: banner.targetSlug,
            targetUrl: banner.targetUrl,
            type: banner.type,
            altText: banner.altText,
            showDelay: banner.showDelay,
            autoHideAfter: banner.autoHideAfter,
            dismissible: banner.dismissible
        };

        console.log(`📊 [BannerController] Random banner served: ${banner.name}`);

        res.json({
            success: true,
            data: response
        });

    } catch (error) {
        console.error('❌ [BannerController] GetRandom error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get random banner'
        });
    }
};

/**
 * Get all Banners (Admin)
 * GET /api/banners
 * Query: type, isActive, page, limit
 */
const getAll = async (req, res) => {
    try {
        const { 
            type, 
            isActive, 
            page = 1, 
            limit = 20 
        } = req.query;

        // Build query
        const query = {};
        if (type) query.type = type;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [banners, total] = await Promise.all([
            Banner.find(query)
                .sort({ priority: 1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('createdBy', 'username'),
            Banner.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: banners,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('❌ [BannerController] GetAll error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get banners'
        });
    }
};

/**
 * Get Banner by ID
 * GET /api/banners/:id
 */
const getById = async (req, res) => {
    try {
        const { id } = req.params;

        const banner = await Banner.findById(id).populate('createdBy', 'username');

        if (!banner) {
            return res.status(404).json({
                success: false,
                error: 'Banner not found'
            });
        }

        res.json({
            success: true,
            data: banner
        });

    } catch (error) {
        console.error('❌ [BannerController] GetById error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get banner'
        });
    }
};

/**
 * Update Banner
 * PUT /api/banners/:id
 */
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Remove fields that shouldn't be updated directly
        delete updates._id;
        delete updates.stats;
        delete updates.createdAt;
        delete updates.updatedAt;

        // Validate targetSlug if being updated
        if (updates.targetSlug) {
            updates.targetSlug = updates.targetSlug.toLowerCase();
            const linkExists = await Link.findOne({ slug: updates.targetSlug });
            if (!linkExists) {
                console.warn(`⚠️ [BannerController] Target slug "${updates.targetSlug}" not found`);
            }
        }

        const banner = await Banner.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!banner) {
            return res.status(404).json({
                success: false,
                error: 'Banner not found'
            });
        }

        console.log(`✅ [BannerController] Banner updated: ${banner.name}`);

        res.json({
            success: true,
            data: banner,
            message: 'Banner updated successfully'
        });

    } catch (error) {
        console.error('❌ [BannerController] Update error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update banner'
        });
    }
};

/**
 * Delete Banner
 * DELETE /api/banners/:id
 */
const remove = async (req, res) => {
    try {
        const { id } = req.params;

        const banner = await Banner.findByIdAndDelete(id);

        if (!banner) {
            return res.status(404).json({
                success: false,
                error: 'Banner not found'
            });
        }

        console.log(`🗑️ [BannerController] Banner deleted: ${banner.name}`);

        res.json({
            success: true,
            message: 'Banner deleted successfully'
        });

    } catch (error) {
        console.error('❌ [BannerController] Delete error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete banner'
        });
    }
};

/**
 * Toggle Banner Active Status
 * POST /api/banners/:id/toggle
 */
const toggleActive = async (req, res) => {
    try {
        const { id } = req.params;

        const banner = await Banner.findById(id);

        if (!banner) {
            return res.status(404).json({
                success: false,
                error: 'Banner not found'
            });
        }

        banner.isActive = !banner.isActive;
        await banner.save();

        console.log(`🔄 [BannerController] Banner ${banner.isActive ? 'activated' : 'deactivated'}: ${banner.name}`);

        res.json({
            success: true,
            data: banner,
            message: `Banner ${banner.isActive ? 'activated' : 'deactivated'}`
        });

    } catch (error) {
        console.error('❌ [BannerController] ToggleActive error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to toggle banner'
        });
    }
};

/**
 * Record Banner Click
 * POST /api/banners/:id/click
 */
const recordClick = async (req, res) => {
    try {
        const { id } = req.params;
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

        const banner = await Banner.findById(id);

        if (!banner) {
            return res.status(404).json({
                success: false,
                error: 'Banner not found'
            });
        }

        await banner.recordClick(ip);

        console.log(`🖱️ [BannerController] Banner click recorded: ${banner.name}`);

        res.json({
            success: true,
            message: 'Click recorded'
        });

    } catch (error) {
        console.error('❌ [BannerController] RecordClick error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to record click'
        });
    }
};

/**
 * Get Banner Statistics
 * GET /api/banners/stats
 */
const getStats = async (req, res) => {
    try {
        const stats = await Banner.getAggregatedStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ [BannerController] GetStats error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get stats'
        });
    }
};

/**
 * Get Active Banners by Type
 * GET /api/banners/active/:type
 */
const getActiveByType = async (req, res) => {
    try {
        const { type } = req.params;

        const banners = await Banner.getAllActive(type);

        res.json({
            success: true,
            data: banners,
            count: banners.length
        });

    } catch (error) {
        console.error('❌ [BannerController] GetActiveByType error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get banners'
        });
    }
};

module.exports = {
    create,
    getRandom,
    getAll,
    getById,
    update,
    remove,
    toggleActive,
    recordClick,
    getStats,
    getActiveByType
};
