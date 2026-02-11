/**
 * BehaviorService
 * 
 * Quản lý xen kẽ hành vi người dùng:
 * - Load behavioral operations từ Database
 * - Generate execution plan động với random injections
 * - Tạo traffic pattern giống người dùng thực
 * 
 * Sử dụng:
 * const service = new BehaviorService();
 * const plan = await service.generateExecutionPlan(mainSteps, userId);
 */

const FacebookOperation = require('../models/FacebookOperation');

class BehaviorService {
    /**
     * Constructor
     */
    constructor() {
        this.operationCache = new Map(); // Cache operations để tránh load nhiều lần
    }

    // ============================================
    // LOAD OPERATIONS
    // ============================================

    /**
     * Load behavioral operations từ DB (high/medium priority)
     * 
     * Được sử dụng cho:
     * - Step 2, 4, 6, 8: Behavioral operations quan trọng
     * - Có likelihood cao được inject vào execution plan
     * 
     * @param {String} priority - 'high', 'medium', hoặc ['high', 'medium']
     * @returns {Array} Operations array
     */
    async loadBehavioralOperations(priority = ['high', 'medium']) {
        try {
            // Check cache first
            const cacheKey = `behavioral_${Array.isArray(priority) ? priority.join(',') : priority}`;
            if (this.operationCache.has(cacheKey)) {
                console.log(`[BehaviorService] 📦 Using cached behavioral operations`);
                return this.operationCache.get(cacheKey);
            }

            const operations = await FacebookOperation.find({
                status: 'active',
                priority: Array.isArray(priority) ? { $in: priority } : priority
            }).select('friendlyName docId priority');

            console.log(`[BehaviorService] 📚 Loaded ${operations.length} behavioral operations (${Array.isArray(priority) ? priority.join('/') : priority})`);

            // Cache for 5 minutes
            this.operationCache.set(cacheKey, operations);
            setTimeout(() => this.operationCache.delete(cacheKey), 5 * 60 * 1000);

            return operations;
        } catch (error) {
            console.error('[BehaviorService] ❌ Error loading behavioral operations:', error.message);
            return [];
        }
    }

    /**
     * Load low-priority operations từ DB
     * 
     * Được sử dụng cho:
     * - Steps 1-7: Random casual browsing
     * - Low likelihood, 30% chance per step
     * 
     * @returns {Array} Low-priority operations
     */
    async loadLowPriorityOperations() {
        try {
            // Check cache first
            const cacheKey = 'low_priority_ops';
            if (this.operationCache.has(cacheKey)) {
                console.log(`[BehaviorService] 📦 Using cached low-priority operations`);
                return this.operationCache.get(cacheKey);
            }

            const operations = await FacebookOperation.find({
                status: 'active',
                priority: 'low'
            })
            .select('friendlyName docId priority')
            .limit(100); // Limit để query nhanh

            console.log(`[BehaviorService] 📋 Loaded ${operations.length} low-priority operations`);

            // Cache for 5 minutes
            this.operationCache.set(cacheKey, operations);
            setTimeout(() => this.operationCache.delete(cacheKey), 5 * 60 * 1000);

            return operations;
        } catch (error) {
            console.error('[BehaviorService] ❌ Error loading low-priority operations:', error.message);
            return [];
        }
    }

    // ============================================
    // BEHAVIOR INJECTION
    // ============================================

    /**
     * Inject random low-priority operations
     * 
     * Mô phỏng người dùng lướt Facebook lung tung
     * 30% chance để inject 1-2 low-priority operations
     * 
     * @param {Array} lowPriorityOps - Available low-priority operations
     * @returns {Object} {injected: count, operations: [...]}
     */
    injectRandomBehavior(lowPriorityOps) {
        if (!lowPriorityOps || lowPriorityOps.length === 0) {
            return { injected: 0, operations: [] };
        }

        // 30% chance to inject
        const shouldInject = Math.random() > 0.7;
        if (!shouldInject) {
            return { injected: 0, operations: [] };
        }

        // Random: 1-2 operations
        const injectCount = Math.random() > 0.6 ? 1 : 2;
        const injected = [];

        for (let i = 0; i < injectCount && lowPriorityOps.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * lowPriorityOps.length);
            injected.push({
                ...lowPriorityOps[randomIndex],
                delay: Math.random() * 1500 + 500, // 500-2000ms
                type: 'casual_browsing'
            });
            lowPriorityOps.splice(randomIndex, 1);
        }

        return {
            injected: injected.length,
            operations: injected
        };
    }

    /**
     * Inject behavioral operations (high/medium priority)
     * 
     * Để vào step 2, 4, 6, 8
     * 
     * @param {Array} behavioralOps - Available behavioral operations
     * @param {Number} count - Số lượng operations (1-2)
     * @returns {Array} Operations to inject
     */
    injectBehavioralOperation(behavioralOps, count = 2) {
        if (!behavioralOps || behavioralOps.length === 0) {
            return [];
        }

        const injected = [];
        const opsCopy = [...behavioralOps];

        for (let i = 0; i < count && opsCopy.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * opsCopy.length);
            injected.push({
                ...opsCopy[randomIndex],
                delay: Math.random() * 3000 + 1000, // 1-4 seconds
                type: 'behavioral'
            });
            opsCopy.splice(randomIndex, 1);
        }

        return injected;
    }

    // ============================================
    // EXECUTION PLAN GENERATION
    // ============================================

    /**
     * Generate Dynamic Execution Plan
     * 
     * Tạo một kịch bản chạy động với:
     * - Main steps (9 bước)
     * - Behavioral injections (at steps 2, 4, 6, 8)
     * - Random casual browsing (between steps 1-7)
     * - Dynamic delays
     * 
     * @param {Array} mainSteps - Danh sách 9 bước chính
     * @param {Array} behavioralOps - High/medium priority operations
     * @param {Array} lowPriorityOps - Low-priority operations
     * @returns {Array} Final execution plan
     * 
     * Example Return:
     * [
     *   { order: 1, type: 'main', name: 'Step 1', delay: 1000 },
     *   { order: 2, type: 'casual', name: 'RefetchQuery', delay: 750 },
     *   { order: 3, type: 'main', name: 'Step 2', delay: 1500 },
     *   { order: 4, type: 'behavioral', name: 'CometNewsFeed', delay: 2000 },
     *   ...
     * ]
     */
    generateExecutionPlan(mainSteps, behavioralOps, lowPriorityOps) {
        const plan = [];
        let order = 1;

        // Deep copy to avoid mutation
        const lowPriorityOpsBackup = [...(lowPriorityOps || [])];

        for (let i = 0; i < mainSteps.length; i++) {
            const step = mainSteps[i];

            // Add main step
            plan.push({
                order: order++,
                type: 'main',
                name: step.name,
                delay: step.delay,
                stepNumber: i + 1
            });

            // Steps 1-7: Maybe inject random low-priority ops
            if (i < 7) {
                const casualBehavior = this.injectRandomBehavior(lowPriorityOpsBackup);
                
                for (const op of casualBehavior.operations) {
                    plan.push({
                        order: order++,
                        type: 'casual_browsing',
                        name: op.friendlyName,
                        docId: op.docId,
                        delay: op.delay,
                        afterStep: i + 1
                    });
                }
            }

            // Steps 2, 4, 6, 8: Inject behavioral operations
            if ([2, 4, 6, 8].includes(i + 1) && behavioralOps && behavioralOps.length > 0) {
                const injectCount = Math.random() > 0.5 ? 1 : 2;
                const injected = this.injectBehavioralOperation(behavioralOps, injectCount);

                for (const op of injected) {
                    plan.push({
                        order: order++,
                        type: 'behavioral',
                        name: op.friendlyName,
                        docId: op.docId,
                        priority: op.priority,
                        delay: op.delay,
                        afterStep: i + 1
                    });
                }
            }
        }

        return plan;
    }

    // ============================================
    // STATISTICS
    // ============================================

    /**
     * Calculate execution plan statistics
     * 
     * @param {Array} plan - Execution plan from generateExecutionPlan()
     * @returns {Object} Statistics
     */
    getExecutionStatistics(plan) {
        const stats = {
            totalActions: plan.length,
            mainSteps: plan.filter(a => a.type === 'main').length,
            behavioralOps: plan.filter(a => a.type === 'behavioral').length,
            casualBrowsing: plan.filter(a => a.type === 'casual_browsing').length,
            totalDuration: plan.reduce((sum, action) => sum + (action.delay || 0), 0),
            naturalness: 0
        };

        // Calculate naturalness percentage
        const totalActions = stats.behavioralOps + stats.casualBrowsing;
        stats.naturalness = totalActions > 0 
            ? ((stats.casualBrowsing / totalActions) * 100).toFixed(1)
            : 0;

        return stats;
    }

    /**
     * Stringify execution plan for logging
     * 
     * @param {Array} plan - Execution plan
     * @returns {String} Formatted output
     */
    formatExecutionPlan(plan) {
        let output = '\n┌─ EXECUTION PLAN ──────────────────────────────────┐\n';

        plan.forEach((action, idx) => {
            const icon = action.type === 'main' ? '📌' : 
                        action.type === 'behavioral' ? '🧬' : '🌀';
            
            output += `│ ${idx + 1}. ${icon} ${action.name.padEnd(35)} [${action.delay}ms]\n`;
        });

        const stats = this.getExecutionStatistics(plan);
        output += `├─ STATS ────────────────────────────────────────────┤\n`;
        output += `│ Total: ${stats.totalActions} | Main: ${stats.mainSteps} | Behavioral: ${stats.behavioralOps} | Casual: ${stats.casualBrowsing}\n`;
        output += `│ Duration: ${(stats.totalDuration / 1000).toFixed(1)}s | Naturalness: ${stats.naturalness}%\n`;
        output += `└────────────────────────────────────────────────────┘\n`;

        return output;
    }

    // ============================================
    // CLEAR CACHE
    // ============================================

    /**
     * Clear all cached operations
     */
    clearCache() {
        this.operationCache.clear();
        console.log('[BehaviorService] 🗑️  Cache cleared');
    }
}

// ============================================
// EXPORT
// ============================================

module.exports = BehaviorService;
