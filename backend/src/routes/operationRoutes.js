/**
 * Facebook Operations Routes
 * 
 * Endpoints untuk manage Dynamic Doc IDs
 * 
 * Routes:
 * - POST   /api/operations/capture      - Capture doc_id từ Extension
 * - POST   /api/operations/sync         - Sync doc_id từ Extension
 * - GET    /api/operations/:friendlyName - Lấy doc_id
 * - GET    /api/operations              - Lấy tất cả
 * - PUT    /api/operations/:friendlyName - Cập nhật
 * - DELETE /api/operations/:friendlyName - Xóa
 * - GET    /api/operations/health/stale - Kiểm tra cũ
 * - POST   /api/operations/batch/sync   - Batch sync
 */

const express = require('express');
const router = express.Router();
const facebookOperationController = require('../controllers/facebookOperationController');

// Middleware to check authentication (tùy chỉnh theo hệ thống)
const isAuthenticated = (req, res, next) => {
    // TODO: Thêm authentication logic
    next();
};

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/operations/capture
 * CRITICAL: Capture doc_id từ Extension (real-time during Facebook interaction)
 * This is called by the Chrome Extension when it intercepts GraphQL requests
 */
router.post('/capture', facebookOperationController.captureOperation);

/**
 * POST /api/operations/sync
 * Sync doc_id từ Extension (auto-create if not exists)
 */
router.post('/sync', facebookOperationController.syncOperation);

/**
 * GET /api/operations
 * Lấy danh sách tất cả operations
 * Query: ?status=active&stale=true
 */
router.get('/', facebookOperationController.getAllOperations);

/**
 * GET /api/operations/health/stale
 * Lấy danh sách operations cũ (cần cập nhật)
 */
router.get('/health/stale', facebookOperationController.getStaleOperations);

/**
 * GET /api/operations/:friendlyName
 * Lấy doc_id theo friendly name
 */
router.get('/:friendlyName', facebookOperationController.getOperation);

/**
 * PUT /api/operations/:friendlyName
 * Cập nhật operation (admin)
 */
router.put('/:friendlyName', isAuthenticated, facebookOperationController.updateOperation);

/**
 * DELETE /api/operations/:friendlyName
 * Xóa operation
 */
router.delete('/:friendlyName', isAuthenticated, facebookOperationController.deleteOperation);

/**
 * POST /api/operations/batch/sync
 * Batch sync multiple operations
 */
router.post('/batch/sync', facebookOperationController.batchSyncOperations);

// ============================================
// EXPORTS
// ============================================

module.exports = router;
