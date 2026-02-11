/**
 * AutomationController
 * 
 * Ví dụ thực tế cách sử dụng BehaviorService
 * để tạo dynamic execution plan cho automation workflows
 */

const BehaviorService = require('../services/BehaviorService');
const FacebookOperation = require('../models/FacebookOperation');

class AutomationController {
    constructor() {
        this.behaviorService = new BehaviorService();
    }

    /**
     * POST /api/automations/plan
     * 
     * Tạo execution plan động cho một automation task
     * 
     * Body:
     * {
     *   userId: "user_123",
     *   taskType: "comment", // 'comment', 'like', 'follow', etc
     *   customSteps?: [...]  // Optional: custom main steps
     * }
     * 
     * Response:
     * {
     *   success: true,
     *   plan: [...],
     *   statistics: {...}
     * }
     */
    async generatePlan(req, res) {
        try {
            const { userId, taskType, customSteps } = req.body;

            console.log('[AutomationController] 📋 Generating execution plan:', {
                userId,
                taskType,
                hasCustomSteps: !!customSteps
            });

            // STEP 1: Define main steps (hoặc sử dụng custom steps)
            const mainSteps = customSteps || this.getDefaultSteps(taskType);

            // STEP 2: Load behavioral operations (high/medium priority)
            const behavioralOps = await this.behaviorService.loadBehavioralOperations();

            // STEP 3: Load low-priority operations (casual browsing)
            const lowPriorityOps = await this.behaviorService.loadLowPriorityOperations();

            // STEP 4: Generate dynamic execution plan
            const executionPlan = this.behaviorService.generateExecutionPlan(
                mainSteps,
                behavioralOps,
                lowPriorityOps
            );

            // STEP 5: Get statistics
            const stats = this.behaviorService.getExecutionStatistics(executionPlan);

            // STEP 6: Log formatted plan
            console.log('[AutomationController] ✅ Plan generated successfully');
            console.log(this.behaviorService.formatExecutionPlan(executionPlan));

            // STEP 7: Return plan to client
            return res.status(200).json({
                success: true,
                taskId: this.generateTaskId(),
                userId: userId,
                taskType: taskType,
                plan: executionPlan,
                statistics: stats,
                createdAt: new Date().toISOString()
            });

        } catch (error) {
            console.error('[AutomationController] ❌ Error generating plan:', error.message);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * POST /api/automations/execute
     * 
     * Thực thi execution plan đã tạo
     * 
     * Body:
     * {
     *   taskId: "task_123",
     *   plan: [...],
     *   targetData: {...}
     * }
     */
    async executePlan(req, res) {
        try {
            const { taskId, plan, targetData } = req.body;

            console.log('[AutomationController] 🚀 Executing plan:', {
                taskId,
                actionCount: plan.length,
                target: targetData?.target || 'unknown'
            });

            // Simulate execution
            const results = [];
            for (const action of plan) {
                // Simulate delay and execution
                await new Promise(resolve => setTimeout(resolve, action.delay || 0));

                const result = {
                    order: action.order,
                    type: action.type,
                    name: action.name,
                    status: 'completed',
                    timestamp: new Date().toISOString()
                };

                results.push(result);

                // Log each action
                const icon = action.type === 'main' ? '📌' :
                           action.type === 'behavioral' ? '🧬' : '🌀';
                console.log(`[AutomationController] ${icon} Executed: ${action.name}`);
            }

            console.log('[AutomationController] ✅ Plan execution completed');

            return res.status(200).json({
                success: true,
                taskId: taskId,
                executedActions: results.length,
                results: results,
                completedAt: new Date().toISOString()
            });

        } catch (error) {
            console.error('[AutomationController] ❌ Error executing plan:', error.message);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * GET /api/automations/operations
     * 
     * List available operations by priority
     * 
     * Query: ?priority=high|medium|low
     */
    async getOperations(req, res) {
        try {
            const { priority = 'all' } = req.query;

            let operations;
            if (priority === 'all') {
                operations = await FacebookOperation.find({ status: 'active' })
                    .select('friendlyName docId priority')
                    .limit(100);
            } else {
                operations = await FacebookOperation.find({
                    status: 'active',
                    priority: priority
                }).select('friendlyName docId priority');
            }

            return res.status(200).json({
                success: true,
                priority: priority === 'all' ? 'all_priorities' : priority,
                count: operations.length,
                operations: operations
            });

        } catch (error) {
            console.error('[AutomationController] ❌ Error fetching operations:', error.message);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * DELETE /api/automations/cache
     * 
     * Clear behavior service cache (admin only)
     */
    async clearCache(req, res) {
        try {
            this.behaviorService.clearCache();

            return res.status(200).json({
                success: true,
                message: 'Cache cleared successfully'
            });

        } catch (error) {
            console.error('[AutomationController] ❌ Error clearing cache:', error.message);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // ============================================
    // HELPERS
    // ============================================

    /**
     * Get default steps based on task type
     * 
     * @param {String} taskType - 'comment', 'like', 'follow', etc
     * @returns {Array} Default main steps
     */
    getDefaultSteps(taskType) {
        const stepsMap = {
            comment: [
                { name: 'Step 1: Initialize', delay: 1000 },
                { name: 'Step 2: Load page DOM', delay: 1500 },
                { name: 'Step 3: Fetch post context', delay: 1200 },
                { name: 'Step 4: Generate mutation ID', delay: 800 },
                { name: 'Step 5: Build request payload', delay: 1000 },
                { name: 'Step 6: Execute GraphQL mutation', delay: 2000 },
                { name: 'Step 7: Validate response', delay: 1000 },
                { name: 'Step 8: Process success', delay: 500 },
                { name: 'Step 9: Cleanup', delay: 800 }
            ],
            like: [
                { name: 'Step 1: Initialize', delay: 800 },
                { name: 'Step 2: Locate post', delay: 1000 },
                { name: 'Step 3: Fetch reactions context', delay: 900 },
                { name: 'Step 4: Generate like mutation', delay: 600 },
                { name: 'Step 5: Build payload', delay: 800 },
                { name: 'Step 6: Send GraphQL request', delay: 1500 },
                { name: 'Step 7: Verify success', delay: 700 },
                { name: 'Step 8: Update UI state', delay: 400 },
                { name: 'Step 9: Cleanup', delay: 600 }
            ],
            follow: [
                { name: 'Step 1: Initialize', delay: 800 },
                { name: 'Step 2: Load profile page', delay: 1200 },
                { name: 'Step 3: Fetch subscription data', delay: 1000 },
                { name: 'Step 4: Generate follow mutation', delay: 700 },
                { name: 'Step 5: Build request payload', delay: 900 },
                { name: 'Step 6: Execute mutation', delay: 1800 },
                { name: 'Step 7: Validate response', delay: 900 },
                { name: 'Step 8: Update subscription', delay: 500 },
                { name: 'Step 9: Cleanup', delay: 700 }
            ]
        };

        return stepsMap[taskType] || stepsMap.comment; // Default to comment steps
    }

    /**
     * Generate unique task ID
     * 
     * @returns {String} Task ID
     */
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
}

// ============================================
// EXPORT
// ============================================

module.exports = new AutomationController();
