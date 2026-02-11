/**
 * Facebook Operation Controller
 * 
 * API để quản lý Dynamic Doc IDs từ Extension
 * 
 * Endpoints:
 * - POST /api/operations/capture   - Capture doc_id từ Extension (real-time)
 * - POST /api/operations/sync       - Sync doc_id từ Extension
 * - GET /api/operations/:friendlyName - Lấy doc_id
 * - GET /api/operations             - Lấy tất cả operations
 * - PUT /api/operations/:friendlyName - Cập nhật thủ công
 * - DELETE /api/operations/:friendlyName - Xóa operation
 */

const FacebookOperation = require('../models/FacebookOperation');

// ============================================
// CAPTURE OPERATION (từ Extension - Real-time)
// ============================================

/**
 * POST /api/operations/capture
 * CRITICAL: Capture doc_id từ Extension khi nó intercept GraphQL requests
 * Called by Chrome Extension in real-time when browsing Facebook
 * 
 * Body:
 * {
 *   docId: "2345678901234567",
 *   friendlyName: "CometUFICreateCommentMutation",
 *   method: "fetch" | "xhr",
 *   url: "https://www.facebook.com/api/graphql/",
 *   payload: {...},
 *   timestamp: "2024-01-16T10:30:00Z"
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Doc ID captured and stored",
 *   operation: {...}
 * }
 */
const captureOperation = async (req, res) => {
    try {
        const { docId, friendlyName, method, url, payload, timestamp } = req.body;

        // Validate required fields
        if (!docId || !friendlyName) {
            console.warn('[OperationController] Capture: Missing fields', {
                hasDocId: !!docId,
                hasFriendlyName: !!friendlyName
            });
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: docId, friendlyName'
            });
        }

        console.log('[OperationController] 📨 Capturing doc_id from Extension:', {
            docId: docId,
            friendlyName: friendlyName,
            method: method,
            timestamp: timestamp
        });

        // Validate doc_id format
        if (!/^[A-Za-z0-9]+$/.test(docId) || docId.length < 5) {
            console.warn('[OperationController] Invalid doc_id format:', docId);
            return res.status(400).json({
                success: false,
                message: 'Invalid doc_id format'
            });
        }

        // Validate friendlyName format
        if (!/^[A-Za-z0-9_]+$/.test(friendlyName)) {
            console.warn('[OperationController] Invalid friendlyName format:', friendlyName);
            return res.status(400).json({
                success: false,
                message: 'Invalid friendlyName format'
            });
        }

        // Determine priority based on friendlyName (auto-detect operation type)
        const priority = determinePriority(friendlyName);
        console.log(`[OperationController] 🎯 Priority determined: ${friendlyName} -> ${priority}`);

        // UPSERT: Find or create operation
        const operation = await FacebookOperation.findOneAndUpdate(
            { friendlyName: friendlyName },
            {
                $set: {
                    docId: docId,
                    priority: priority,
                    lastUpdated: new Date(timestamp) || new Date(),
                    source: 'extension',
                    status: 'active',
                    lastUpdatedBy: 'extension'
                },
                $inc: { updateCount: 1 }
            },
            {
                upsert: true,      // Create if doesn't exist
                new: true,         // Return updated document
                runValidators: true
            }
        );

        console.log(`✅ [OperationController] Upserted: ${friendlyName} = ${docId} (priority: ${priority})`);

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Doc ID captured and stored successfully',
            operation: {
                friendlyName: operation.friendlyName,
                docId: operation.docId,
                priority: operation.priority,
                lastUpdated: operation.lastUpdated,
                updateCount: operation.updateCount,
                status: operation.status,
                isNew: operation.updateCount === 1
            }
        });

    } catch (error) {
        console.error('[OperationController] ❌ Capture error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to capture doc_id',
            error: error.message
        });
    }
};

/**
 * Helper: Determine priority based on friendlyName
 * HIGH: Comment, Like, Reaction, Scroll, Typing, Share, Message, Block
 * MEDIUM: Follow, Unfollow, View, Search
 * LOW: Mọi operation khác
 */
function determinePriority(friendlyName) {
    const name = friendlyName.toLowerCase();
    
    // HIGH priority operations
    const highKeywords = [
        'comment', 'like', 'reaction',
        'scroll', 'typing', 'broadcast',
        'share', 'message', 'block',
        'unblock', 'unfriend', 'mute',
        'unmute', 'createcomment', 'deletecomment',
        'mutation', 'broadcast'
    ];
    
    // MEDIUM priority operations
    const mediumKeywords = [
        'follow', 'unfollow', 'view',
        'search', 'profile', 'timeline',
        'hover', 'click'
    ];
    
    for (const keyword of highKeywords) {
        if (name.includes(keyword)) {
            return 'high';
        }
    }
    
    for (const keyword of mediumKeywords) {
        if (name.includes(keyword)) {
            return 'medium';
        }
    }
    
    return 'low';
}

// ============================================
// SYNC OPERATION (từ Extension)
// ============================================

/**
 * POST /api/operations/sync
 * 
 * Nhận doc_id từ Extension và cập nhật vào database
 * Tự động tạo mới nếu chưa tồn tại (upsert)
 * 
 * Body:
 * {
 *   name: "CometUFICreateCommentMutation",
 *   doc_id: "2345678901234567",
 *   timestamp: "2024-01-16T10:30:00Z"  // optional
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   operation: { ... },
 *   message: "Doc ID synced successfully"
 * }
 */
const syncOperation = async (req, res) => {
    try {
        const { name, doc_id, timestamp } = req.body;

        // Validate required fields
        if (!name || !doc_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, doc_id'
            });
        }

        // Validate name format (alphanumeric + underscore)
        if (!/^[A-Za-z0-9_]+$/.test(name)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid friendly name format'
            });
        }

        // Validate doc_id (numeric or alphanumeric)
        if (!/^[A-Za-z0-9]+$/.test(doc_id) || doc_id.length < 5) {
            return res.status(400).json({
                success: false,
                error: 'Invalid doc_id format'
            });
        }

        // Sync using static method (upsert with auto-increment)
        const operation = await FacebookOperation.syncFromExtension(
            name, 
            doc_id, 
            req.headers['x-extension-id'] || 'unknown'
        );

        console.log(`✅ [OperationController] Synced: ${name} = ${doc_id}`);

        return res.status(200).json({
            success: true,
            operation,
            message: `Doc ID synced for ${name}`,
            isNew: operation.updateCount === 1
        });

    } catch (error) {
        console.error('[OperationController] Sync error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to sync operation'
        });
    }
};

// ============================================
// GET OPERATION BY NAME
// ============================================

/**
 * GET /api/operations/:friendlyName
 * 
 * Lấy doc_id theo friendly name
 * 
 * Response:
 * {
 *   success: true,
 *   operation: { 
 *     friendlyName: "CometUFICreateCommentMutation",
 *     docId: "2345678901234567",
 *     lastUpdated: "2024-01-16T10:30:00Z",
 *     age: 45  // minutes
 *   }
 * }
 */
const getOperation = async (req, res) => {
    try {
        const { friendlyName } = req.params;

        const operation = await FacebookOperation.findOne({
            friendlyName: { $regex: `^${friendlyName}$`, $options: 'i' },
            status: 'active'
        });

        if (!operation) {
            return res.status(404).json({
                success: false,
                error: `Operation not found: ${friendlyName}`
            });
        }

        return res.status(200).json({
            success: true,
            operation: {
                friendlyName: operation.friendlyName,
                docId: operation.docId,
                lastUpdated: operation.lastUpdated,
                age: operation.getAge(),
                updateCount: operation.updateCount,
                status: operation.status
            }
        });

    } catch (error) {
        console.error('[OperationController] Get error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================
// GET ALL OPERATIONS
// ============================================

/**
 * GET /api/operations
 * 
 * Lấy danh sách tất cả operations
 * 
 * Query params:
 * - status: 'active' | 'deprecated' | 'pending'
 * - stale: true (chỉ lấy những cũ hơn 1 ngày)
 * 
 * Response:
 * {
 *   success: true,
 *   operations: [
 *     { friendlyName, docId, lastUpdated, age, ... }
 *   ],
 *   count: 15,
 *   stats: { ... }
 * }
 */
const getAllOperations = async (req, res) => {
    try {
        const { status, stale } = req.query;

        let query = {};
        
        if (status) {
            query.status = status;
        } else {
            query.status = 'active'; // Default: chỉ active
        }

        let operations = await FacebookOperation.find(query)
            .sort({ friendlyName: 1 });

        // Filter stale if requested
        if (stale === 'true') {
            operations = operations.filter(op => op.isStale());
        }

        // Map to response format
        const operationList = operations.map(op => ({
            friendlyName: op.friendlyName,
            docId: op.docId,
            lastUpdated: op.lastUpdated,
            age: op.getAge(),
            isStale: op.isStale(),
            updateCount: op.updateCount,
            status: op.status,
            source: op.source,
            version: op.version
        }));

        // Calculate stats
        const stats = {
            total: operationList.length,
            active: operations.filter(op => op.status === 'active').length,
            deprecated: operations.filter(op => op.status === 'deprecated').length,
            staleCount: operationList.filter(op => op.isStale).length,
            averageAge: operationList.length > 0 
                ? Math.floor(operationList.reduce((sum, op) => sum + op.age, 0) / operationList.length)
                : 0
        };

        return res.status(200).json({
            success: true,
            operations: operationList,
            count: operationList.length,
            stats
        });

    } catch (error) {
        console.error('[OperationController] Get all error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================
// UPDATE OPERATION (MANUAL)
// ============================================

/**
 * PUT /api/operations/:friendlyName
 * 
 * Cập nhật operation thủ công (bởi admin)
 * 
 * Body:
 * {
 *   docId: "new_doc_id",
 *   notes: "Updated because...",
 *   status: "active" // optional
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   operation: { ... }
 * }
 */
const updateOperation = async (req, res) => {
    try {
        const { friendlyName } = req.params;
        const { docId, notes, status } = req.body;

        if (!docId && !notes && !status) {
            return res.status(400).json({
                success: false,
                error: 'Nothing to update'
            });
        }

        const operation = await FacebookOperation.findOne({
            friendlyName: { $regex: `^${friendlyName}$`, $options: 'i' }
        });

        if (!operation) {
            return res.status(404).json({
                success: false,
                error: `Operation not found: ${friendlyName}`
            });
        }

        // Update doc_id if provided
        if (docId && docId !== operation.docId) {
            operation.docId = docId;
            operation.lastUpdated = new Date();
            operation.updateCount = operation.updateCount + 1;
            operation.source = 'manual';
        }

        // Update notes if provided
        if (notes) {
            operation.notes = notes;
        }

        // Update status if provided
        if (status && ['active', 'deprecated', 'pending'].includes(status)) {
            operation.status = status;
        }

        await operation.save();

        console.log(`✅ [OperationController] Updated: ${friendlyName}`);

        return res.status(200).json({
            success: true,
            operation: {
                friendlyName: operation.friendlyName,
                docId: operation.docId,
                lastUpdated: operation.lastUpdated,
                updateCount: operation.updateCount,
                status: operation.status,
                notes: operation.notes
            },
            message: `Operation updated: ${friendlyName}`
        });

    } catch (error) {
        console.error('[OperationController] Update error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================
// DELETE OPERATION
// ============================================

/**
 * DELETE /api/operations/:friendlyName
 * 
 * Xóa operation khỏi database
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Operation deleted"
 * }
 */
const deleteOperation = async (req, res) => {
    try {
        const { friendlyName } = req.params;

        const result = await FacebookOperation.findOneAndDelete({
            friendlyName: { $regex: `^${friendlyName}$`, $options: 'i' }
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                error: `Operation not found: ${friendlyName}`
            });
        }

        console.log(`🗑️  [OperationController] Deleted: ${friendlyName}`);

        return res.status(200).json({
            success: true,
            message: `Operation deleted: ${friendlyName}`
        });

    } catch (error) {
        console.error('[OperationController] Delete error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================
// HEALTH CHECK - Get stale operations
// ============================================

/**
 * GET /api/operations/health/stale
 * 
 * Lấy danh sách operations cũ hơn 1 ngày (cần cập nhật)
 * 
 * Response:
 * {
 *   success: true,
 *   staleOperations: [...],
 *   needsUpdate: count
 * }
 */
const getStaleOperations = async (req, res) => {
    try {
        const operations = await FacebookOperation.getStaleOperations(1); // 1 day

        return res.status(200).json({
            success: true,
            staleOperations: operations.map(op => ({
                friendlyName: op.friendlyName,
                docId: op.docId,
                lastUpdated: op.lastUpdated,
                age: op.getAge()
            })),
            needsUpdate: operations.length,
            message: operations.length > 0 
                ? `${operations.length} operations need update` 
                : 'All operations are up to date'
        });

    } catch (error) {
        console.error('[OperationController] Health check error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * POST /api/operations/batch/sync
 * 
 * Sync multiple operations at once (từ Extension)
 * 
 * Body:
 * {
 *   operations: [
 *     { name: "Op1", doc_id: "123" },
 *     { name: "Op2", doc_id: "456" }
 *   ]
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   synced: 2,
 *   failed: 0,
 *   operations: [...]
 * }
 */
const batchSyncOperations = async (req, res) => {
    try {
        const { operations } = req.body;

        if (!Array.isArray(operations) || operations.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid operations array'
            });
        }

        const results = [];
        let synced = 0;
        let failed = 0;

        for (const { name, doc_id } of operations) {
            try {
                if (!name || !doc_id) continue;

                const operation = await FacebookOperation.syncFromExtension(
                    name,
                    doc_id,
                    req.headers['x-extension-id'] || 'unknown'
                );

                results.push({
                    name,
                    success: true,
                    docId: operation.docId
                });
                synced++;

            } catch (error) {
                results.push({
                    name,
                    success: false,
                    error: error.message
                });
                failed++;
            }
        }

        console.log(`✅ [OperationController] Batch synced: ${synced} operations`);

        return res.status(200).json({
            success: true,
            synced,
            failed,
            operations: results,
            message: `Batch sync completed: ${synced} synced, ${failed} failed`
        });

    } catch (error) {
        console.error('[OperationController] Batch sync error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
    captureOperation,
    syncOperation,
    getOperation,
    getAllOperations,
    updateOperation,
    deleteOperation,
    getStaleOperations,
    batchSyncOperations
};
