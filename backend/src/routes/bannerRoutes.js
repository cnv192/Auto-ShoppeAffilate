/**
 * Banner Routes
 * 
 * API Endpoints cho quản lý Banner
 * 
 * Public:
 * - GET /api/banners/random - Get random active banner (A/B testing)
 * - POST /api/banners/:id/click - Record banner click
 * 
 * Admin (require auth):
 * - GET /api/banners - Get all banners
 * - GET /api/banners/stats - Get aggregated stats
 * - GET /api/banners/active/:type - Get active banners by type
 * - GET /api/banners/:id - Get banner by ID
 * - POST /api/banners - Create banner
 * - PUT /api/banners/:id - Update banner
 * - DELETE /api/banners/:id - Delete banner
 * - POST /api/banners/:id/toggle - Toggle active status
 */

const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// =================================================================
// PUBLIC ROUTES (No auth required)
// =================================================================

/**
 * GET /api/banners/random
 * Get random active banner for A/B testing
 * Query params: type, device, articleSlug, category
 */
router.get('/random', bannerController.getRandom);

/**
 * POST /api/banners/:id/click
 * Record banner click (tracking)
 */
router.post('/:id/click', bannerController.recordClick);

// =================================================================
// ADMIN ROUTES (Auth required)
// =================================================================

/**
 * GET /api/banners/stats
 * Get aggregated statistics for all banners
 */
router.get('/stats', authenticate, bannerController.getStats);

/**
 * GET /api/banners/active/:type
 * Get all active banners by type
 */
router.get('/active/:type', authenticate, bannerController.getActiveByType);

/**
 * GET /api/banners
 * Get all banners with pagination
 * Query params: type, isActive, page, limit
 */
router.get('/', authenticate, bannerController.getAll);

/**
 * GET /api/banners/:id
 * Get specific banner by ID
 */
router.get('/:id', authenticate, bannerController.getById);

/**
 * POST /api/banners
 * Create new banner
 */
router.post('/', authenticate, bannerController.create);

/**
 * PUT /api/banners/:id
 * Update banner
 */
router.put('/:id', authenticate, bannerController.update);

/**
 * DELETE /api/banners/:id
 * Delete banner
 */
router.delete('/:id', authenticate, requireAdmin, bannerController.remove);

/**
 * POST /api/banners/:id/toggle
 * Toggle banner active status
 */
router.post('/:id/toggle', authenticate, requireAdmin, bannerController.toggleActive);

module.exports = router;
