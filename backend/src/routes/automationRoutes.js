/**
 * Automation Routes
 * 
 * API endpoints cho dynamic behavior simulation
 * 
 * Routes:
 * - POST   /api/automations/plan     - Generate execution plan
 * - POST   /api/automations/execute  - Execute plan
 * - GET    /api/automations/operations - List available operations
 * - DELETE /api/automations/cache    - Clear cache (admin)
 */

const express = require('express');
const router = express.Router();
const automationController = require('../controllers/AutomationController');

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/automations/plan
 * 
 * Generate dynamic execution plan
 * 
 * Body:
 * {
 *   userId: "user_123",
 *   taskType: "comment",
 *   customSteps?: [...]
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   taskId: "task_...",
 *   plan: [...],
 *   statistics: {...}
 * }
 */
router.post('/plan', async (req, res) => {
    return automationController.generatePlan(req, res);
});

/**
 * POST /api/automations/execute
 * 
 * Execute a generated plan
 * 
 * Body:
 * {
 *   taskId: "task_...",
 *   plan: [...],
 *   targetData: {...}
 * }
 */
router.post('/execute', async (req, res) => {
    return automationController.executePlan(req, res);
});

/**
 * GET /api/automations/operations
 * 
 * List available operations
 * 
 * Query: ?priority=high|medium|low|all
 * 
 * Response:
 * {
 *   success: true,
 *   priority: "high",
 *   count: 150,
 *   operations: [...]
 * }
 */
router.get('/operations', async (req, res) => {
    return automationController.getOperations(req, res);
});

/**
 * DELETE /api/automations/cache
 * 
 * Clear service cache
 * (Admin only - should add authentication)
 */
router.delete('/cache', async (req, res) => {
    return automationController.clearCache(req, res);
});

// ============================================
// EXPORT
// ============================================

module.exports = router;
