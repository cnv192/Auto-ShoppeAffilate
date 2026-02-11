/**
 * NEW MODULE: Facebook Automation Service v4.0 - Self-Healing Sequential Queue
 * 
 * FILE: facebookAutomationService-v4.js (append to existing service)
 * 
 * 🎯 MAJOR UPGRADES:
 * 1. Self-Healing: Dynamic doc_id từ FacebookOperation model
 * 2. Natural Behavior: 9-step sequential process (không song song)
 * 3. Queue Management: Xử lý từng bài một với delay tự nhiên
 * 4. Anti-Detect: Real browser fingerprint từ Extension
 * 5. Fallback System: Sử dụng default doc_id nếu không tìm được
 * 
 * USAGE:
 * const { processCommentQueue, getDynamicDocId } = require('./facebookAutomationService-v4');
 */

const FacebookOperation = require('../models/FacebookOperation');

// ============================================
// CACHE & CONSTANTS
// ============================================

/**
 * Local in-memory cache cho doc_ids
 * Format: { 'friendlyName': 'docId' }
 */
const docIdCache = new Map();

/**
 * Default doc_ids (hardcode fallback)
 */
const DEFAULT_DOC_IDS = {
    'FBScreenTimeLogger_syncMutation': '3372045876132204',
    'CometNewsFeedPaginationQuery': '4629763073702834',
    'CometFocusedStoryViewUFIQuery': '3732667810200581',
    'CommentsListComponentsPaginationQuery': '3421385768054719',
    'CometUFILiveTypingBroadcastMutation_StartMutation': '3532110346846784',
    'CometUFILiveTypingBroadcastMutation_StopMutation': '14368696669766945',
    'CometUFICreateCommentMutation': '3414370651979657'
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Tạo delay ngẫu nhiên (ms)
 */
async function randomDelay(min = 1000, max = 3000) {
    const delay = Math.random() * (max - min) + min;
    console.log(`   ⏱️  Delaying ${Math.floor(delay)}ms...`);
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Tạo delay với giây
 */
async function delaySeconds(min = 1, max = 3) {
    return randomDelay(min * 1000, max * 1000);
}

// ============================================
// DYNAMIC DOC_ID RESOLVER
// ============================================

/**
 * Lấy doc_id động từ cache -> DB -> hardcode fallback
 * 
 * @param {String} friendlyName - Ví dụ: 'CometUFICreateCommentMutation'
 * @param {String} defaultId - (Optional) fallback ID
 * @returns {Promise<String>} - doc_id
 */
async function getDynamicDocId(friendlyName, defaultId = null) {
    try {
        // ===== STEP 1: Check Local Cache =====
        if (docIdCache.has(friendlyName)) {
            const cachedDocId = docIdCache.get(friendlyName);
            console.log(`   ✅ [Cache] Found: ${friendlyName}`);
            return cachedDocId;
        }

        // ===== STEP 2: Query Database =====
        console.log(`   🔍 [DB Query] Searching: ${friendlyName}`);
        
        const operation = await FacebookOperation.findOne({
            friendlyName: { $regex: `^${friendlyName}$`, $options: 'i' },
            status: 'active'
        }).lean();

        if (operation) {
            const docId = operation.docId;
            docIdCache.set(friendlyName, docId);
            console.log(`   ✅ [DB] Found: ${friendlyName}`);
            return docId;
        }

        // ===== STEP 3: Use Fallback =====
        const fallbackId = defaultId || DEFAULT_DOC_IDS[friendlyName];
        
        if (fallbackId) {
            console.log(`   ⚡ [Fallback] Using: ${friendlyName}`);
            docIdCache.set(friendlyName, fallbackId);
            return fallbackId;
        }

        console.error(`   ❌ [Error] No doc_id found: ${friendlyName}`);
        return null;

    } catch (error) {
        console.error(`   ❌ [Error] getDynamicDocId: ${error.message}`);
        const fallbackId = defaultId || DEFAULT_DOC_IDS[friendlyName];
        if (fallbackId) {
            console.log(`   ⚡ [Fallback on Error]`);
            return fallbackId;
        }
        return null;
    }
}

/**
 * Reload cache từ database
 */
async function reloadDocIdCache() {
    try {
        console.log('[Service] 🔄 Reloading doc_id cache...');
        
        const operations = await FacebookOperation.find({ status: 'active' }).lean();
        
        docIdCache.clear();
        
        for (const op of operations) {
            docIdCache.set(op.friendlyName, op.docId);
        }

        console.log(`[Service] ✅ Cache reloaded: ${operations.length} operations`);
        return operations.length;
    } catch (error) {
        console.error('[Service] Error reloading cache:', error);
        return 0;
    }
}

// ============================================
// ENHANCED FACEBOOK API CLASS
// ============================================

class FacebookAPIv4 {
    constructor(accessToken, cookie, fbAccount = null) {
        this.accessToken = accessToken;
        this.cookie = cookie;
        this.fbAccount = fbAccount;
    }

    _extractUserId(cookieString) {
        try {
            const match = cookieString.match(/c_user=(\d+)/);
            return match ? match[1] : null;
        } catch (e) {
            return null;
        }
    }

    _encodeFeedbackId(postId) {
        const str = `feedback:${postId}`;
        return Buffer.from(str).toString('base64');
    }

    _generateJazoest(dtsg = '') {
        if (!dtsg) return '2' + Math.random().toString(36).substr(2);
        const sum = Array.from(dtsg).reduce((s, c) => s + c.charCodeAt(0), 0);
        return sum + ':' + Math.random().toString(36).substr(2);
    }

    _getHeaders() {
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://www.facebook.com',
            'Referer': 'https://www.facebook.com/',
            'Cookie': this.cookie,
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty'
        };
    }

    /**
     * CORE: 9-STEP SEQUENTIAL COMMENT PROCESS
     */
    async postCommentSequential(postId, message, dtsg, options = {}) {
        console.log('\n' + '='.repeat(70));
        console.log(`📝 [9-STEP COMMENT] Post: ${postId}`);
        console.log('='.repeat(70));

        try {
            const userId = this._extractUserId(this.cookie);
            if (!userId) throw new Error('Cannot extract User ID');

            // STEP 1: Heartbeat Start
            console.log('\n⏱️  STEP 1: Heartbeat (Start)');
            try {
                const docId = await getDynamicDocId('FBScreenTimeLogger_syncMutation');
                if (docId) {
                    await this._makeGraphQLCall(userId, dtsg, docId, { clientID: `${Date.now()}` });
                    console.log('   ✅ Sent');
                }
            } catch (e) {
                console.log(`   ⚠️  Failed: ${e.message}`);
            }
            await delaySeconds(1, 2);

            // STEP 2: Scroll
            console.log('\n📜 STEP 2: Scroll Feed');
            try {
                const docId = await getDynamicDocId('CometNewsFeedPaginationQuery');
                if (docId) {
                    await this._makeGraphQLCall(userId, dtsg, docId, { count: 3 });
                    console.log('   ✅ Completed');
                }
            } catch (e) {
                console.log(`   ⚠️  Failed: ${e.message}`);
            }
            await delaySeconds(3, 5);

            // STEP 3: View Post
            console.log('\n👁️  STEP 3: View Post');
            try {
                const docId = await getDynamicDocId('CometFocusedStoryViewUFIQuery');
                if (docId) {
                    const feedbackId = this._encodeFeedbackId(postId);
                    await this._makeGraphQLCall(userId, dtsg, docId, { feedbackTargetID: feedbackId });
                    console.log('   ✅ Completed');
                }
            } catch (e) {
                console.log(`   ⚠️  Failed: ${e.message}`);
            }
            await delaySeconds(2, 4);

            // STEP 4: Load Comments
            console.log('\n💬 STEP 4: Load Comments');
            try {
                const docId = await getDynamicDocId('CommentsListComponentsPaginationQuery');
                if (docId) {
                    const feedbackId = this._encodeFeedbackId(postId);
                    await this._makeGraphQLCall(userId, dtsg, docId, { 
                        feedbackTargetID: feedbackId,
                        first: 10
                    });
                    console.log('   ✅ Completed');
                }
            } catch (e) {
                console.log(`   ⚠️  Failed: ${e.message}`);
            }
            await delaySeconds(1, 2);

            // STEP 5: Start Typing
            console.log('\n⌨️  STEP 5: Start Typing');
            try {
                const docId = await getDynamicDocId('CometUFILiveTypingBroadcastMutation_StartMutation');
                if (docId) {
                    const feedbackId = this._encodeFeedbackId(postId);
                    await this._makeGraphQLCall(userId, dtsg, docId, { feedbackTargetID: feedbackId });
                    console.log('   ✅ Sent');
                }
            } catch (e) {
                console.log(`   ⚠️  Failed: ${e.message}`);
            }
            await delaySeconds(0.5, 1);

            // STEP 6: Typing Delay
            console.log('\n✍️  STEP 6: Simulating Typing');
            const typingDelay = Math.ceil(message.length * 0.2 * 1000);
            console.log(`   ⏱️  ${Math.floor(typingDelay / 1000)}s (${message.length} chars)`);
            await new Promise(resolve => setTimeout(resolve, typingDelay));
            console.log('   ✅ Done');

            // STEP 7: Stop Typing
            console.log('\n⛔ STEP 7: Stop Typing');
            try {
                const docId = await getDynamicDocId('CometUFILiveTypingBroadcastMutation_StopMutation');
                if (docId) {
                    const feedbackId = this._encodeFeedbackId(postId);
                    await this._makeGraphQLCall(userId, dtsg, docId, { feedbackTargetID: feedbackId });
                    console.log('   ✅ Sent');
                }
            } catch (e) {
                console.log(`   ⚠️  Failed: ${e.message}`);
            }
            await delaySeconds(0.5, 1);

            // STEP 8: Create Comment
            console.log('\n📨 STEP 8: Create Comment');
            const createDocId = await getDynamicDocId('CometUFICreateCommentMutation');
            if (!createDocId) throw new Error('No doc_id for comment creation');

            const feedbackId = this._encodeFeedbackId(postId);
            let finalMessage = message;
            if (options.targetName) {
                finalMessage = message.replace('{name}', options.targetName);
            }

            const variables = {
                input: {
                    feedbackTargetID: feedbackId,
                    message: { text: finalMessage },
                    clientID: `${Date.now()}`
                }
            };

            if (options.parentCommentId) {
                variables.input.parentCommentID = options.parentCommentId;
            }

            const response = await this._makeGraphQLCall(userId, dtsg, createDocId, variables.input);
            const commentIdMatch = response.match(/"id":"(\d+)"/);
            const commentId = commentIdMatch ? commentIdMatch[1] : null;

            if (!commentId) throw new Error('Comment ID not found');
            console.log(`   ✅ Created: ${commentId}`);
            await delaySeconds(1, 2);

            // STEP 9: Heartbeat End
            console.log('\n⏱️  STEP 9: Heartbeat (End)');
            try {
                const docId = await getDynamicDocId('FBScreenTimeLogger_syncMutation');
                if (docId) {
                    await this._makeGraphQLCall(userId, dtsg, docId, { clientID: `${Date.now()}` });
                    console.log('   ✅ Sent');
                }
            } catch (e) {
                console.log(`   ⚠️  Failed: ${e.message}`);
            }

            console.log('\n' + '='.repeat(70));
            console.log('✅ 9-STEP PROCESS COMPLETED');
            console.log('='.repeat(70) + '\n');

            return {
                success: true,
                id: commentId,
                message: finalMessage,
                postId
            };

        } catch (error) {
            console.error('\n' + '='.repeat(70));
            console.error(`❌ FAILED: ${error.message}`);
            console.error('='.repeat(70) + '\n');

            return {
                success: false,
                postId,
                error: error.message
            };
        }
    }

    async _makeGraphQLCall(userId, dtsg, docId, variables) {
        const formData = new URLSearchParams();
        formData.append('av', userId);
        formData.append('fb_dtsg', dtsg);
        formData.append('doc_id', docId);
        formData.append('variables', JSON.stringify(variables));

        const response = await fetch('https://www.facebook.com/api/graphql/', {
            method: 'POST',
            headers: this._getHeaders(),
            body: formData.toString()
        });

        return response.text();
    }
}

// ============================================
// QUEUE PROCESSOR (SEQUENTIAL)
// ============================================

/**
 * Xử lý hàng đợi bình luận SEQUENTIAL
 * 
 * QUAN TRỌNG: for...of loop (không Promise.all)
 * 
 * @param {Array} comments - [{ postId, message, options }]
 * @param {Object} fbAccount - Facebook account
 * @returns {Promise<Object>}
 */
async function processCommentQueueSequential(comments, fbAccount) {
    console.log('\n' + '🚀 '.repeat(35));
    console.log(`PROCESSING QUEUE: ${comments.length} comments`);
    console.log('🚀 '.repeat(35) + '\n');

    const results = {
        success: 0,
        failed: 0,
        total: comments.length,
        details: []
    };

    // Load doc_ids
    await reloadDocIdCache();

    const fbAPI = new FacebookAPIv4(
        fbAccount.accessToken,
        fbAccount.cookie,
        fbAccount
    );

    // Sequential processing
    for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        const num = i + 1;

        console.log(`\n${'─'.repeat(70)}`);
        console.log(`COMMENT ${num}/${comments.length}`);
        console.log(`${'─'.repeat(70)}`);

        try {
            const result = await fbAPI.postCommentSequential(
                comment.postId,
                comment.message,
                fbAccount.fb_dtsg,
                comment.options || {}
            );

            if (result.success) {
                results.success++;
                results.details.push({
                    num,
                    status: 'success',
                    postId: comment.postId,
                    commentId: result.id
                });
                console.log(`\n✅ Comment ${num} SUCCESS`);
            } else {
                results.failed++;
                results.details.push({
                    num,
                    status: 'failed',
                    postId: comment.postId,
                    error: result.error
                });
                console.log(`\n❌ Comment ${num} FAILED: ${result.error}`);
            }

        } catch (error) {
            results.failed++;
            results.details.push({
                num,
                status: 'error',
                postId: comment.postId,
                error: error.message
            });
            console.error(`\n💥 Comment ${num} ERROR: ${error.message}`);
        }

        // Delay between comments
        if (num < comments.length) {
            console.log(`\n⏸️  Waiting before next comment...`);
            await randomDelay(60000, 120000); // 60-120 seconds
        }
    }

    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('QUEUE COMPLETED');
    console.log('═'.repeat(70));
    console.log(`✅ Success: ${results.success}/${results.total}`);
    console.log(`❌ Failed: ${results.failed}/${results.total}`);
    console.log('═'.repeat(70) + '\n');

    return results;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    FacebookAPIv4,
    getDynamicDocId,
    reloadDocIdCache,
    processCommentQueueSequential,
    randomDelay,
    delaySeconds,
    DEFAULT_DOC_IDS,
    docIdCache
};
