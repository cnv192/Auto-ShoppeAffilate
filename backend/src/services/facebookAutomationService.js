const Campaign = require('../models/Campaign');
const FacebookAccount = require('../models/FacebookAccount');
const Link = require('../models/Link');

// Import FacebookCrawler module for URL resolution (legacy, kept for compatibility)
const { 
    FacebookCrawler, 
    FacebookUrlResolver, 
    MbasicParser,
    getHeaders, 
    MODERN_HEADERS 
} = require('./facebookCrawler');

/**
 * Facebook Automation Service
 * 
 * UNIFIED DESKTOP SIMULATION ARCHITECTURE v3.1
 * =============================================
 * All traffic now uses Desktop Chrome simulation.
 * Backend NEVER requests mbasic.facebook.com to avoid cookie mismatches.
 * 
 * Features:
 * - Send comments to Facebook posts using Desktop GraphQL API
 * - Cookie-based commenting (matches Browser Extension data)
 * - Desktop HTML Scraping feed crawler (newsfeed, groups, pages)
 * - GraphQL-based health check (no mbasic ping)
 * - Group post detection and groupID handling
 * - Safety check: Verify comment exists after posting
 * - Auto-stop campaign if blocked
 * 
 * v2.0 Updates:
 * - Modern headers to avoid WAP detection
 * - Advanced URL resolver for /share/p/ links
 * 
 * v2.1 Updates (Dual-Mode Commenting):
 * - Mode A: Direct Post Comment - Comments directly on posts
 * - Mode B: Reply to Comment - Replies to specific user comments with name substitution
 * - Fixed WAP detection with Desktop Chrome headers
 * - Added jazoest token generation for better request validation
 * 
 * v3.0 Updates (Unified Desktop GraphQL):
 * - Migrated crawler from mbasic HTML parsing to Desktop GraphQL API
 * - Health check now uses GraphQL ping (same endpoint as commenter)
 * - Group posts: Extract groupID from URL, set feedbackSource to 0
 * - All traffic looks like standard Windows/Chrome user interacting via GraphQL
 * 
 * v3.1 Updates (Desktop HTML Scraping):
 * - Switched feed crawler from GraphQL to Desktop HTML Scraping
 * - Fetches www.facebook.com and extracts post IDs from embedded script data
 * - Uses regex patterns: top_level_post_id, story_fbid, feedback (Base64), post_id
 * - More reliable than GraphQL which requires valid cursor for pagination
 * - Mimics real user opening browser - safest possible action
 * 
 * ========================================
 * USAGE EXAMPLES
 * ========================================
 * 
 * // Example 1: Mode A - Direct Comment on Post
 * const fbAPI = new FacebookAPI(accessToken, cookie);
 * const result = await fbAPI.postCommentWithCookie(
 *     '123456789',                    // Post ID
 *     'Great product! 🔥',           // Message
 *     'AQBxxx...'                     // fb_dtsg token
 * );
 * // Output: { success: true, id: 'cookie_123456789_1234567890', message: 'Great product! 🔥', mode: 'A' }
 * 
 * // Example 2: Mode B - Reply to a User's Comment with Name Substitution
 * const result = await fbAPI.postCommentWithCookie(
 *     '123456789',                    // Post ID
 *     'Xin chào {name}, cảm ơn bạn đã quan tâm!',  // Message with placeholder
 *     'AQBxxx...',                    // fb_dtsg token
 *     {
 *         parentCommentId: '987654321',      // ID of comment to reply to
 *         targetName: 'Nguyen Van A'         // Name to replace {name}
 *     }
 * );
 * // Output: { success: true, id: 'cookie_123456789_1234567890', 
 * //          message: 'Xin chào Nguyen Van A, cảm ơn bạn đã quan tâm!', 
 * //          mode: 'B', parentCommentId: '987654321' }
 * 
 * // Example 3: Group Post Comment (auto-detects groupID from URL)
 * const result = await fbAPI.postCommentWithCookie(
 *     '123456789',
 *     'Thank you for your feedback!',
 *     'AQBxxx...',
 *     {
 *         postUrl: 'https://www.facebook.com/groups/340470219463371/posts/123456789/'
 *     }
 * );
 * // groupID: 340470219463371, feedbackSource: 0
 * 
 * ========================================
 * INTEGRATION WITH CAMPAIGNS
 * ========================================
 * 
 * // In your campaign logic, you can now support reply mode:
 * const commentData = campaign.generateComment(); // Returns { text, fullUrl }
 * 
 * // For direct comments (existing behavior)
 * const result = await fbAPI.postCommentWithCookie(postId, commentData.text, fbAccount.fb_dtsg);
 * 
 * // For reply mode (new feature)
 * const result = await fbAPI.postCommentWithCookie(
 *     postId, 
 *     commentData.text, 
 *     fbAccount.fb_dtsg,
 *     {
 *         parentCommentId: commentToReplyTo.id,
 *         targetName: commentToReplyTo.authorName
 *     }
 * );
 */

/**
 * Extract Post ID từ Facebook URL (sync version - không resolve redirect)
 * @param {String} input - Post ID hoặc URL
 * @returns {String|null} - Post ID hoặc null nếu cần async resolve
 */
function extractPostIdSync(input) {
    if (!input) return null;
    
    // Nếu đã là ID (chỉ chứa số)
    if (/^\d+$/.test(input)) {
        return input;
    }
    
    // Thử extract từ URL
    try {
        const url = new URL(input);
        
        // Format: /posts/123456
        const postsMatch = url.pathname.match(/\/posts\/(\d+)/);
        if (postsMatch) return postsMatch[1];
        
        // Format: /permalink/123456
        const permalinkMatch = url.pathname.match(/\/permalink\/(\d+)/);
        if (permalinkMatch) return permalinkMatch[1];
        
        // Format: story_fbid trong query
        const storyFbid = url.searchParams.get('story_fbid');
        if (storyFbid && /^\d+$/.test(storyFbid)) return storyFbid;
        
        // Format: /photo?fbid=123456
        const fbid = url.searchParams.get('fbid');
        if (fbid && /^\d+$/.test(fbid)) return fbid;
        
        // Format: id trong query (photo links)
        const id = url.searchParams.get('id');
        if (id && /^\d+$/.test(id)) return id;
        
        // Format: /{user_id}/posts/{post_id} hoặc /groups/{group_id}/posts/{post_id}
        const pathParts = url.pathname.split('/');
        for (let i = 0; i < pathParts.length; i++) {
            if (pathParts[i] === 'posts' && pathParts[i + 1] && /^\d+$/.test(pathParts[i + 1])) {
                return pathParts[i + 1];
            }
        }
        
        // Format mới: /share/p/{shortcode}/ - cần resolve redirect
        const shareMatch = url.pathname.match(/\/share\/p\/([^\/]+)/);
        if (shareMatch) {
            return null; // Signal that async resolution is needed
        }
        
    } catch (e) {
        // Không phải URL valid
    }
    
    return null;
}

/**
 * Resolve /share/p/ URL to get actual post ID by following redirects
 * NOW USES: Advanced URL Resolver with multi-step resolution
 * @param {String} shareUrl - Facebook share URL
 * @param {String} cookie - Facebook cookie (optional, for authenticated requests)
 * @returns {Promise<String|null>} - Numeric post ID or null
 */
async function resolveShareUrl(shareUrl, cookie = '') {
    console.log(`🔗 [Resolve Share URL] Resolving: ${shareUrl}`);
    
    try {
        // Use the new FacebookUrlResolver for robust resolution
        const resolver = new FacebookUrlResolver(cookie);
        const result = await resolver.resolveFacebookUrl(shareUrl);
        
        if (result.success && result.postId) {
            console.log(`✅ [Resolve Share URL] Success via ${result.method}: ${result.postId}`);
            console.log(`   Resolution chain: ${result.resolveChain.map(s => s.type).join(' → ')}`);
            return result.postId;
        }
        
        // Fallback: Try legacy method if new resolver fails
        console.log(`⚠️ [Resolve Share URL] New resolver failed, trying legacy method...`);
        return await _legacyResolveShareUrl(shareUrl, cookie);
        
    } catch (error) {
        console.error(`❌ [Resolve Share URL] Error:`, error.message);
        return await _legacyResolveShareUrl(shareUrl, cookie);
    }
}

/**
 * Resolve Facebook URL and return BOTH postId AND finalUrl
 * This is essential for Group Posts where we need the URL to extract groupID
 * @param {String} inputUrl - Facebook URL to resolve
 * @param {String} cookie - Facebook cookie (optional)
 * @returns {Promise<Object>} - { postId, resolvedUrl } or { postId: null, resolvedUrl: null }
 */
async function resolveUrlWithDetails(inputUrl, cookie = '') {
    console.log(`🔗 [Resolve URL Details] Resolving: ${inputUrl}`);
    
    try {
        // Use the new FacebookUrlResolver for robust resolution
        const resolver = new FacebookUrlResolver(cookie);
        const result = await resolver.resolveFacebookUrl(inputUrl);
        
        if (result.success && result.postId) {
            console.log(`✅ [Resolve URL Details] Success via ${result.method}`);
            console.log(`   Post ID: ${result.postId}`);
            console.log(`   Final URL: ${result.finalUrl}`);
            return {
                postId: result.postId,
                resolvedUrl: result.finalUrl || inputUrl
            };
        }
        
        // Fallback: Try sync extraction
        const syncPostId = extractPostIdSync(inputUrl);
        if (syncPostId) {
            return {
                postId: syncPostId,
                resolvedUrl: inputUrl // Original URL contains the postId
            };
        }
        
        console.log(`⚠️ [Resolve URL Details] Could not resolve URL`);
        return { postId: null, resolvedUrl: null };
        
    } catch (error) {
        console.error(`❌ [Resolve URL Details] Error:`, error.message);
        
        // Fallback to sync extraction
        const syncPostId = extractPostIdSync(inputUrl);
        return {
            postId: syncPostId,
            resolvedUrl: syncPostId ? inputUrl : null
        };
    }
}

/**
 * Legacy share URL resolver (fallback)
 * @private
 */
async function _legacyResolveShareUrl(shareUrl, cookie = '') {
    try {
        // Use modern headers to avoid WAP page
        const response = await fetch(shareUrl, {
            method: 'GET',
            headers: getHeaders('desktop', cookie, {
                'Referer': 'https://www.facebook.com/'
            }),
            redirect: 'follow'
        });
        
        const finalUrl = response.url;
        console.log(`🔗 [Legacy Resolver] Final URL: ${finalUrl}`);
        
        // Try to extract post ID from final URL
        const postId = extractPostIdSync(finalUrl);
        if (postId) {
            console.log(`✅ [Legacy Resolver] Extracted Post ID: ${postId}`);
            return postId;
        }
        
        // Parse HTML for post ID
        const html = await response.text();
        
        // Check for WAP page indicator
        if (html.includes('WAPFORUM') || html.includes('<!DOCTYPE wml')) {
            console.error(`❌ [Legacy Resolver] WAP page detected! Headers need update.`);
            return null;
        }
        
        // Look for story_fbid in HTML
        const storyFbidMatch = html.match(/story_fbid[=:](\d+)/);
        if (storyFbidMatch) {
            console.log(`✅ [Legacy Resolver] Found story_fbid in HTML: ${storyFbidMatch[1]}`);
            return storyFbidMatch[1];
        }
        
        // Look for ft_ent_identifier
        const ftEntMatch = html.match(/ft_ent_identifier[=:"](\d+)/);
        if (ftEntMatch) {
            console.log(`✅ [Legacy Resolver] Found ft_ent_identifier in HTML: ${ftEntMatch[1]}`);
            return ftEntMatch[1];
        }
        
        // Look for post ID in various meta tags
        const ogUrlMatch = html.match(/og:url['"]\s*content=['"](.*?)['"]/);
        if (ogUrlMatch) {
            const ogPostId = extractPostIdSync(ogUrlMatch[1]);
            if (ogPostId) {
                console.log(`✅ [Legacy Resolver] Found post ID in og:url: ${ogPostId}`);
                return ogPostId;
            }
        }
        
        console.warn(`⚠️ [Legacy Resolver] Could not extract post ID from resolved URL`);
        return null;
        
    } catch (error) {
        console.error(`❌ [Legacy Resolver] Error:`, error.message);
        return null;
    }
}

/**
 * Extract Post ID từ Facebook URL (async version - có thể resolve redirect)
 * @param {String} input - Post ID hoặc URL
 * @param {String} cookie - Facebook cookie (for resolving /share/p/ URLs)
 * @returns {Promise<String|null>} - Post ID
 */
async function extractPostIdAsync(input, cookie = '') {
    if (!input) return null;
    
    // First try sync extraction
    const syncResult = extractPostIdSync(input);
    if (syncResult) return syncResult;
    
    // Check if it's a /share/p/ URL that needs resolution
    try {
        const url = new URL(input);
        const shareMatch = url.pathname.match(/\/share\/p\/([^\/]+)/);
        if (shareMatch) {
            console.log(`🔗 [Extract Post ID] Detected /share/p/ URL, resolving...`);
            return await resolveShareUrl(input, cookie);
        }
    } catch (e) {}
    
    console.error(`❌ [Extract Post ID] Cannot extract numeric post ID from: ${input}`);
    return null;
}

// Legacy sync function for backwards compatibility
function extractPostId(input) {
    const result = extractPostIdSync(input);
    if (!result) {
        // Check if it's a share URL
        try {
            const url = new URL(input);
            if (url.pathname.includes('/share/p/')) {
                console.warn(`⚠️ [Extract Post ID] /share/p/ URL detected, use extractPostIdAsync() instead`);
                return 'NEEDS_ASYNC_RESOLVE';
            }
        } catch (e) {}
        
        console.error(`❌ [Extract Post ID] Cannot extract numeric post ID from: ${input}`);
    }
    return result;
}

/**
 * Facebook Graph API helper
 */
class FacebookAPI {
    constructor(accessToken, cookie) {
        this.accessToken = accessToken;
        this.cookie = cookie;
        this.baseUrl = 'https://graph.facebook.com/v18.0';
    }
    
    /**
     * Get post details (likes, comments, shares count)
     * @param {String} postId - Facebook Post ID
     * @returns {Object} - { id, likes, comments, shares }
     */
    async getPostStats(postId) {
        try {
            const url = `${this.baseUrl}/${postId}?fields=id,likes.summary(true),comments.summary(true),shares&access_token=${this.accessToken}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            return {
                id: data.id,
                likes: data.likes?.summary?.total_count || 0,
                comments: data.comments?.summary?.total_count || 0,
                shares: data.shares?.count || 0
            };
        } catch (error) {
            console.error('❌ Get post stats error:', error);
            throw error;
        }
    }
    
    /**
     * Post a comment to Facebook
     * @param {String} postId - Facebook Post ID
     * @param {String} message - Comment text
     * @returns {Object} - { id, message }
     */
    async postComment(postId, message) {
        try {
            const url = `${this.baseUrl}/${postId}/comments`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': this.cookie || ''
                },
                body: JSON.stringify({
                    message,
                    access_token: this.accessToken
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message);
            }
            
            return {
                id: data.id,
                message: message
            };
        } catch (error) {
            console.error('❌ Post comment error:', error);
            throw error;
        }
    }
    
    /**
     * Get a comment by ID (để verify comment còn tồn tại)
     * @param {String} commentId - Facebook Comment ID
     * @returns {Object|null} - Comment data hoặc null nếu bị gỡ
     */
    async getComment(commentId) {
        try {
            const url = `${this.baseUrl}/${commentId}?fields=id,message,created_time&access_token=${this.accessToken}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.error) {
                // Error code 100 = comment không tồn tại (bị gỡ)
                if (data.error.code === 100) {
                    return null;
                }
                throw new Error(data.error.message);
            }
            
            return data;
        } catch (error) {
            console.error('❌ Get comment error:', error);
            return null;
        }
    }
    
    /**
     * Post comment using Cookie (Mobile Basic Facebook)
     * Dùng khi không có OAuth access token
     * NOW USES: Modern headers from facebookCrawler module
     * @param {String} postId - Facebook Post ID (numeric)
     * @param {String} message - Comment text
     * @param {String} dtsg - fb_dtsg token
     * @returns {Object} - { success, message }
     */
    /**
     * Helper: Generate UUID v4
     * @returns {String} UUID string
     */
    _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Helper: Encode feedback ID to Base64
     * @param {String} postId - Numeric post ID
     * @returns {String} Base64 encoded feedback ID
     */
    _encodeFeedbackId(postId) {
        const feedbackStr = `feedback:${postId}`;
        return Buffer.from(feedbackStr).toString('base64');
    }

    /**
     * Helper: Extract User ID from cookie
     * @param {String} cookie - Cookie string
     * @returns {String|null} User ID or null
     */
    _extractUserId(cookie) {
        const match = cookie.match(/c_user=(\d+)/);
        return match ? match[1] : null;
    }

    /**
     * Helper: Extract LSD token from cookie or page
     * @param {String} cookie - Cookie string
     * @returns {String|null} LSD token or null
     */
    _extractLSD(cookie) {
        // Try to extract from cookie first (some accounts have it)
        const lsdMatch = cookie.match(/lsd=([^;]+)/);
        if (lsdMatch) {
            return lsdMatch[1];
        }
        // If not in cookie, you may need to extract from HTML page
        // For now, return null and let it be optional in headers
        return null;
    }

    /**
     * Helper: Generate message ranges for URL linkification
     * Detects all URLs in the message and creates entity ranges for Facebook to render as clickable links
     * 
     * @param {String} text - Message text that may contain URLs
     * @returns {Array} Array of entity objects: [{ entity: { __typename: "ExternalUrl", url: ... }, offset: ..., length: ... }]
     */
    _generateMessageRanges(text) {
        if (!text) return [];
        
        // Regex to detect URLs (http/https)
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const ranges = [];
        let match;
        
        while ((match = urlRegex.exec(text)) !== null) {
            const url = match[0];
            const offset = match.index;
            const length = url.length;
            
            ranges.push({
                entity: {
                    __typename: "ExternalUrl",
                    url: url
                },
                offset: offset,
                length: length
            });
        }
        
        if (ranges.length > 0) {
            console.log(`🔗 [Linkify] Detected ${ranges.length} URL(s) in message`);
            ranges.forEach((range, idx) => {
                console.log(`   ${idx + 1}. "${range.entity.url}" at offset ${range.offset}`);
            });
        }
        
        return ranges;
    }

    /**
     * Helper: Extract Group ID from Facebook URL
     * Supports multiple URL formats:
     * - /groups/GROUP_ID/
     * - /groups/GROUP_ID/permalink/POST_ID/
     * - /groups/GROUP_ID/posts/POST_ID/
     * - https://www.facebook.com/groups/340470219463371/permalink/3292576427586054/
     * 
     * @param {String} url - Facebook post URL
     * @returns {String|null} Group ID or null if not a group post
     */
    _extractGroupId(url) {
        if (!url) {
            console.log(`⚠️ [Extract Group ID] No URL provided`);
            return null;
        }
        
        console.log(`🔍 [Extract Group ID] Analyzing URL: ${url}`);
        
        // Pattern 1: /groups/GROUP_ID/ (general pattern)
        const match = url.match(/\/groups\/(\d+)/i);
        if (match) {
            const groupId = match[1];
            console.log(`✅ [Extract Group ID] Extracted Group ID: ${groupId}`);
            return groupId;
        }
        
        // Pattern 2: Encoded URL with groups in query params
        const encodedMatch = url.match(/groups%2F(\d+)/i);
        if (encodedMatch) {
            const groupId = encodedMatch[1];
            console.log(`✅ [Extract Group ID] Extracted Group ID from encoded URL: ${groupId}`);
            return groupId;
        }
        
        console.log(`ℹ️ [Extract Group ID] No group ID found - this is a regular post (not in a group)`);
        return null;
    }

    /**
     * Post Comment with Cookie - GraphQL API VERSION (Production Payload)
     * 
     * MODE A (Direct Comment): Comment directly on a post
     * MODE B (Reply to Comment): Reply to a specific user's comment
     * 
     * IMPLEMENTATION:
     * 1. Uses GraphQL endpoint: /api/graphql/
     * 2. Mutation: useCometUFICreateCommentMutation
     * 3. Exact production payload structure
     * 4. Auto {name} handling for both modes
     * 5. Supports Facebook Group posts (groupID passed explicitly or extracted from URL)
     * 
     * @param {String} postId - Numeric post ID (required)
     * @param {String} message - Comment text (supports {name} placeholder)
     * @param {String} dtsg - Facebook DTSG token (required)
     * @param {Object} options - Optional parameters
     * @param {String} options.groupId - Group ID (PREFERRED - passed from crawler)
     * @param {String} options.postUrl - Post URL (fallback for group detection)
     * @param {String} options.parentCommentId - ID of comment to reply to (enables Mode B)
     * @param {String} options.targetName - Name of user being replied to (for {name} substitution)
     * @returns {Promise<Object>} - { success, id, message, mode, error }
     */
    async postCommentWithCookie(postId, message, dtsg, options = {}) {
        try {
            console.log('\n' + '='.repeat(80));
            console.log('🚀 [GRAPHQL COMMENT] Starting GraphQL mutation...');
            console.log('='.repeat(80));
            
            // === VALIDATION ===
            if (!/^\d+$/.test(postId)) {
                console.error(`❌ [Validation] Invalid post ID format: ${postId}`);
                return { success: false, error: 'Post ID must be numeric' };
            }
            
            if (!dtsg) {
                console.error(`❌ [Validation] Missing fb_dtsg token`);
                return { success: false, error: 'Missing fb_dtsg token' };
            }
            
            // Extract User ID from cookie
            const userId = this._extractUserId(this.cookie);
            if (!userId) {
                console.error(`❌ [Validation] Cannot extract User ID from cookie`);
                return { success: false, error: 'Missing User ID in cookie' };
            }
            
            console.log(`✅ [Validation] Post ID: ${postId}`);
            console.log(`✅ [Validation] User ID: ${userId}`);
            console.log(`✅ [Validation] DTSG: ${dtsg.substring(0, 20)}...`);
            
            // === DETERMINE MODE ===
            const isReplyMode = options.parentCommentId && /^\d+$/.test(options.parentCommentId);
            const mode = isReplyMode ? 'B' : 'A';
            
            console.log(`\n📋 [Mode] ${mode} (${isReplyMode ? 'Reply to Comment' : 'Direct Comment'})`);
            if (isReplyMode) {
                console.log(`   Parent Comment ID: ${options.parentCommentId}`);
                console.log(`   Target Name: ${options.targetName || 'Not provided'}`);
            }
            
            // === PROCESS MESSAGE ===
            let processedMessage = message;
            
            if (mode === 'A') {
                // MODE A: Auto-replace {name} with "bạn"
                if (processedMessage.includes('{name}')) {
                    processedMessage = processedMessage.replace(/\{name\}/g, 'bạn');
                    console.log(`🔧 [Mode A] Replaced {name} → "bạn"`);
                }
            } else {
                // MODE B: Replace {name} with target name
                if (options.targetName && processedMessage.includes('{name}')) {
                    processedMessage = processedMessage.replace(/\{name\}/g, options.targetName);
                    console.log(`🔄 [Mode B] Replaced {name} → "${options.targetName}"`);
                } else if (processedMessage.includes('{name}')) {
                    processedMessage = processedMessage.replace(/\{name\}/g, 'bạn');
                    console.log(`⚠️  [Mode B] No target name, using "bạn"`);
                }
            }
            
            console.log(`📝 [Final Message] "${processedMessage}"`);
            
            // === GENERATE TOKENS ===
            const jazoest = this._generateJazoest(dtsg);
            const lsd = this._extractLSD(this.cookie) || dtsg; // Fallback to dtsg if no LSD
            const feedbackId = this._encodeFeedbackId(postId);
            
            console.log(`\n🔐 [Tokens]`);
            console.log(`   jazoest: ${jazoest}`);
            console.log(`   lsd: ${lsd.substring(0, 20)}...`);
            console.log(`   feedback_id (Base64): ${feedbackId}`);
            
            // === GENERATE UUIDs ===
            const clientMutationId = this._generateUUID();
            const idempotenceToken = this._generateUUID();
            const sessionId = this._generateUUID();
            
            console.log(`\n🆔 [UUIDs]`);
            console.log(`   client_mutation_id: ${clientMutationId}`);
            console.log(`   idempotence_token: ${idempotenceToken}`);
            console.log(`   session_id: ${sessionId}`);
            
            // === EXTRACT GROUP ID - STRICT NULL HANDLING ===
            // PRIORITY: options.groupId > URL extraction > null
            // CRITICAL: groupID key MUST exist in the payload, even if null
            // JSON.stringify removes undefined values, so we force null explicitly
            let groupId = null;
            
            // 1. Check if groupId was passed explicitly from crawler (MOST RELIABLE)
            if (options.groupId) {
                groupId = options.groupId;
                console.log(`\n👥 [Group Detection] Group ID from crawler: ${groupId}`);
            }
            // 2. Fallback: Try to extract from URL
            else if (options.postUrl) {
                const extractedGroupId = this._extractGroupId(options.postUrl);
                if (extractedGroupId) {
                    groupId = extractedGroupId;
                    console.log(`\n👥 [Group Detection] Group ID from URL: ${groupId}`);
                }
            }
            
            // Force null if still undefined
            groupId = groupId || null;
            
            // feedbackSource MUST be an Integer: 0 for Group, 110 for Feed
            const feedbackSource = groupId ? 0 : 110;
            
            if (groupId) {
                console.log(`   Post URL: ${options.postUrl || 'N/A'}`);
                console.log(`   This is a GROUP POST - groupID will be included`);
                console.log(`   feedbackSource: ${feedbackSource} (Integer)`);
            } else {
                console.log(`\n📄 [Post Type] Regular post (not in a group)`);
                console.log(`   groupID: null (explicitly set)`);
                console.log(`   feedbackSource: ${feedbackSource} (Integer)`);
            }
            
            // === GENERATE MESSAGE RANGES (LINKIFY URLs) ===
            const messageRanges = this._generateMessageRanges(processedMessage);
            
            // === BUILD GRAPHQL VARIABLES - STRICT NULLABLE HANDLING ===
            // All keys MUST exist. Use null instead of undefined to prevent JSON.stringify from removing them.
            const variables = {
                feedLocation: "DEDICATED_COMMENTING_SURFACE",
                feedbackSource: feedbackSource, // Integer: 0 or 110
                groupID: groupId, // CRITICAL: Must exist, null or string
                input: {
                    client_mutation_id: clientMutationId,
                    actor_id: userId,
                    attachments: null, // Explicitly null
                    feedback_id: feedbackId, // Base64 encoded
                    formatting_style: null, // Explicitly null
                    message: {
                        ranges: messageRanges, // LINKIFY: Array of URL entity ranges
                        text: processedMessage
                    },
                    is_tracking_encrypted: true,
                    tracking: [], // Empty array
                    feedback_source: "DEDICATED_COMMENTING_SURFACE",
                    idempotence_token: idempotenceToken,
                    session_id: sessionId,
                    // CRITICAL FOR REPLY MODE B: Add parent_comment_id if replying to a comment
                    ...(options.parentCommentId ? { parent_comment_id: options.parentCommentId } : {})
                },
                inviteShortLinkKey: null, // Explicitly null
                renderLocation: null, // Explicitly null
                scale: 1,
                useDefaultActor: false,
                focusCommentID: null, // Explicitly null
                // RELAY FLAGS - Required for proper GraphQL response handling
                __relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider: false,
                __relay_internal__pv__IsWorkUserrelayprovider: false,
                __relay_internal__pv__CometUFIShareActionMigrationrelayprovider: true
            };
            
            // Log Mode B addition
            if (options.parentCommentId) {
                console.log(`\n↩️  [Mode B REPLY] Added parent_comment_id: ${options.parentCommentId}`);
                console.log(`   This will REPLY to comment ${options.parentCommentId}, not post a top-level comment`);
            }
            
            // === DEBUG: Log final variables string to verify all keys exist ===
            const variablesString = JSON.stringify(variables);
            console.log(`\n📦 [Variables] Final JSON (${variablesString.length} chars):`);
            console.log(JSON.stringify(variables, null, 2));
            
            // Verify critical keys exist
            const parsedCheck = JSON.parse(variablesString);
            console.log(`\n🔍 [Validation] Critical keys check:`);
            console.log(`   groupID exists: ${'groupID' in parsedCheck}`);
            console.log(`   groupID value: ${parsedCheck.groupID}`);
            console.log(`   feedbackSource exists: ${'feedbackSource' in parsedCheck}`);
            console.log(`   feedbackSource value: ${parsedCheck.feedbackSource}`);
            console.log(`   input.feedback_id exists: ${'feedback_id' in parsedCheck.input}`);
            
            // === BUILD FORM DATA ===
            const formData = new URLSearchParams();
            formData.append('av', userId);
            formData.append('__user', userId);
            formData.append('__a', '1');
            formData.append('fb_dtsg', dtsg);
            formData.append('jazoest', jazoest);
            formData.append('lsd', lsd);
            formData.append('fb_api_caller_class', 'RelayModern');
            formData.append('fb_api_req_friendly_name', 'useCometUFICreateCommentMutation');
            formData.append('doc_id', '33815332361398625'); // HARDCODED DOC ID
            formData.append('variables', JSON.stringify(variables));
            
            console.log(`\n📋 [Form Data]`);
            console.log(`   av: ${userId}`);
            console.log(`   __user: ${userId}`);
            console.log(`   doc_id: 33815332361398625`);
            console.log(`   fb_api_req_friendly_name: useCometUFICreateCommentMutation`);
            
            // === BUILD HEADERS ===
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://www.facebook.com',
                'Referer': `https://www.facebook.com/`,
                'X-FB-Friendly-Name': 'useCometUFICreateCommentMutation',
                'X-FB-LSD': lsd,
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Cookie': this.cookie
            };
            
            console.log(`\n🔑 [Headers]`);
            console.log(`   User-Agent: ${headers['User-Agent'].substring(0, 50)}...`);
            console.log(`   X-FB-Friendly-Name: ${headers['X-FB-Friendly-Name']}`);
            console.log(`   X-FB-LSD: ${headers['X-FB-LSD'].substring(0, 20)}...`);
            
            // === SEND REQUEST ===
            const url = 'https://www.facebook.com/api/graphql/';
            console.log(`\n🌐 [Endpoint] ${url}`);
            console.log(`⏳ [Request] Sending GraphQL mutation...`);
            
            const startTime = Date.now();
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: formData.toString()
            });
            
            const duration = Date.now() - startTime;
            console.log(`\n📡 [Response] Status: ${response.status} (${duration}ms)`);
            
            // === PARSE RESPONSE ===
            const responseText = await response.text();
            console.log(`📄 [Response] Length: ${responseText.length} chars`);
            
            let jsonResponse = null;
            try {
                jsonResponse = JSON.parse(responseText);
                console.log(`✅ [JSON Parse] Success!`);
                console.log(JSON.stringify(jsonResponse, null, 2));
            } catch (e) {
                console.log(`⚠️  [JSON Parse] Failed:`, e.message);
                console.log(`   Preview: ${responseText.substring(0, 500)}`);
            }
            
            // === CHECK FOR SUCCESS - ROBUST ERROR HANDLING ===
            if (response.status === 200 && jsonResponse) {
                // PRIORITY 1: Check if comment was created successfully (ignore warnings)
                const commentData = jsonResponse.data?.comment_create;
                
                // Try multiple paths to extract comment ID
                const commentId = commentData?.comment?.id 
                    || commentData?.feedback_comment_edge?.node?.id 
                    || commentData?.id;
                
                // If we have a comment ID, it's a SUCCESS - ignore any warnings in errors array
                if (commentId) {
                    console.log(`\n🎉 [SUCCESS] Comment Posted!`);
                    console.log(`   Comment ID: ${commentId}`);
                    
                    // Log warnings if present, but don't fail
                    if (jsonResponse.errors && jsonResponse.errors.length > 0) {
                        console.log(`\n⚠️  [Warning] GraphQL returned warnings (but comment was created):`);
                        jsonResponse.errors.forEach((err, idx) => {
                            console.log(`   ${idx + 1}. ${err.message}`);
                        });
                    }
                    
                    console.log('='.repeat(80));
                    return {
                        success: true,
                        id: commentId,
                        message: processedMessage,
                        mode,
                        ...(options.parentCommentId ? { parentCommentId: options.parentCommentId } : {}),
                        response: jsonResponse
                    };
                }
                
                // PRIORITY 2: Only check for errors if no comment was created
                if (jsonResponse.errors && jsonResponse.errors.length > 0) {
                    console.error(`❌ [GraphQL Error]`, jsonResponse.errors);
                    return {
                        success: false,
                        error: jsonResponse.errors[0].message || 'GraphQL mutation failed',
                        mode,
                        response: jsonResponse
                    };
                }
                
                // No comment ID and no errors - ambiguous result, assume success
                console.log(`\n✅ [Success] Status 200, no errors, no comment ID (assuming success)`);
                console.log('='.repeat(80));
                return {
                    success: true,
                    id: `graphql_${postId}_${Date.now()}`,
                    message: processedMessage,
                    mode,
                    response: jsonResponse
                };
            }
            
            // === HANDLE ERRORS ===
            console.error(`\n❌ [Error] Status ${response.status}`);
            if (jsonResponse) {
                console.error(`   Response:`, JSON.stringify(jsonResponse, null, 2));
            }
            console.log('='.repeat(80));
            
            return {
                success: false,
                error: `HTTP ${response.status}`,
                mode,
                response: jsonResponse || responseText.substring(0, 500)
            };
            
        } catch (error) {
            console.error(`\n💥 [Exception]`, error);
            console.log('='.repeat(80));
            return {
                success: false,
                error: error.message,
                mode: 'unknown'
            };
        }
    }

    /**
     * Generate jazoest token from fb_dtsg
     * Facebook's client-side logic: sum of char codes + "2" prefix
     * @param {String} dtsg - Facebook DTSG token
     * @returns {String} - jazoest token
     */
    _generateJazoest(dtsg) {
        let sum = 0;
        for (let i = 0; i < dtsg.length; i++) {
            sum += dtsg.charCodeAt(i);
        }
        return '2' + sum;
    }
    
    /**
     * Check if token is a valid OAuth access token format
     * OAuth tokens start with 'EAA' (for app tokens) or are long strings
     * @returns {Boolean}
     */
    isValidOAuthToken() {
        if (!this.accessToken) return false;
        
        // Facebook OAuth access tokens typically start with 'EAA' 
        // or are very long strings (100+ chars)
        const isEAAToken = this.accessToken.startsWith('EAA');
        const isLongToken = this.accessToken.length > 100;
        
        // DTSG tokens are typically shorter and don't start with EAA
        const isDTSGFormat = this.accessToken.includes(':') || this.accessToken.length < 50;
        
        return (isEAAToken || isLongToken) && !isDTSGFormat;
    }
    
    /**
     * Check if account is blocked from posting
     * Performs LIVE health check using Desktop GraphQL API
     * NEVER uses mbasic.facebook.com - all traffic looks like standard Windows/Chrome user
     * @param {Object} options - Optional settings
     * @param {String} options.userAgent - Custom User-Agent (from account settings)
     * @param {String} options.fb_dtsg - Facebook DTSG token for GraphQL validation
     * @returns {Promise<Object>} - { healthy: Boolean, reason: String, details: Object }
     */
    async checkAccountHealth(options = {}) {
        const result = {
            healthy: false,
            reason: '',
            details: {},
            checkedAt: new Date().toISOString()
        };
        
        try {
            console.log('\n' + '='.repeat(80));
            console.log('🏥 [Health Check] Starting Desktop GraphQL health check...');
            console.log('='.repeat(80));
            
            // ===============================================
            // STEP 1: Check if we have OAuth token
            // ===============================================
            if (this.accessToken && this.isValidOAuthToken()) {
                console.log('🔍 [Health Check] Valid OAuth token detected, checking with Graph API...');
                const url = `${this.baseUrl}/me?fields=id,name&access_token=${this.accessToken}`;
                
                const response = await fetch(url);
                const data = await response.json();
                
                console.log(`🔍 [Health Check] Graph API Response:`, data);
                
                if (data.error) {
                    console.error(`❌ [Health Check] API Error: ${data.error.message} (Code: ${data.error.code})`);
                    if ([190, 200].includes(data.error.code)) {
                        result.reason = `OAuth token invalid: ${data.error.message}`;
                        result.details = { errorCode: data.error.code, errorMessage: data.error.message };
                        return result;
                    }
                }
                
                if (data.id) {
                    console.log(`✅ [Health Check] OAuth check passed: ${data.name} (${data.id})`);
                    result.healthy = true;
                    result.reason = 'OAuth token valid';
                    result.details = { userId: data.id, userName: data.name, method: 'oauth' };
                    return result;
                }
            }
            
            // ===============================================
            // STEP 2: Perform Desktop GraphQL Health Check
            // Uses the same endpoint as the commenter - looks like normal browser
            // ===============================================
            if (!this.cookie) {
                console.error('❌ [Health Check] No cookie available for validation');
                result.reason = 'No authentication credentials (no token, no cookie)';
                return result;
            }
            
            console.log('🍪 [Health Check] Performing Desktop GraphQL cookie validation...');
            console.log('📋 [Health Check] Cookie length:', this.cookie.length);
            
            // Extract User ID from cookie
            const userId = this._extractUserId(this.cookie);
            if (!userId) {
                console.error('❌ [Health Check] Cannot extract User ID from cookie');
                result.reason = 'Invalid cookie - no c_user found';
                result.details = { method: 'graphql' };
                return result;
            }
            
            console.log(`📋 [Health Check] User ID: ${userId}`);
            
            // Get fb_dtsg from options or generate a validation request
            const dtsg = options.fb_dtsg || this.accessToken;
            if (!dtsg) {
                console.log('⚠️ [Health Check] No fb_dtsg provided, attempting cookie-only validation...');
            }
            
            // Perform GraphQL health check
            const graphqlResult = await this._checkCookieWithGraphQL(userId, dtsg);
            
            if (graphqlResult.isLoginPage || graphqlResult.isUnauthorized) {
                console.error('❌ [Health Check] DEAD COOKIE - GraphQL returned unauthorized!');
                result.reason = 'Cookie expired or invalid - GraphQL authentication failed';
                result.details = {
                    method: 'graphql',
                    error: graphqlResult.error
                };
                return result;
            }
            
            if (graphqlResult.success) {
                console.log('✅ [Health Check] Cookie VALID - GraphQL authentication successful');
                result.healthy = true;
                result.reason = 'Cookie valid - Desktop GraphQL accessible';
                result.details = {
                    method: 'graphql',
                    userId: userId,
                    isDesktopCookie: true,
                    responseData: graphqlResult.data
                };
                return result;
            }
            
            // GraphQL check failed
            console.error('❌ [Health Check] GraphQL validation failed');
            result.reason = 'Cookie validation failed via GraphQL';
            result.details = { graphqlResult };
            return result;
            
        } catch (error) {
            console.error('❌ [Health Check] Exception:', error.message);
            result.reason = `Exception during health check: ${error.message}`;
            result.details = { error: error.message };
            return result;
        } finally {
            console.log('='.repeat(80));
            console.log(`🏥 [Health Check] Result: ${result.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
            console.log(`📋 [Health Check] Reason: ${result.reason}`);
            console.log('='.repeat(80) + '\n');
        }
    }
    
    /**
     * Helper: Check cookie validity using Desktop GraphQL API
     * This looks like a normal browser request - never triggers security flags
     * @private
     */
    async _checkCookieWithGraphQL(userId, dtsg) {
        const result = {
            success: false,
            isLoginPage: false,
            isUnauthorized: false,
            error: null,
            data: null
        };
        
        try {
            console.log('   🔍 [GraphQL Health] Sending validation request...');
            
            // Use a lightweight GraphQL query that validates the session
            // CometMarketplaceRootQuery is lightweight and commonly used
            const formData = new URLSearchParams();
            formData.append('av', userId);
            formData.append('__user', userId);
            formData.append('__a', '1');
            if (dtsg) {
                formData.append('fb_dtsg', dtsg);
                formData.append('jazoest', this._generateJazoest(dtsg));
            }
            formData.append('fb_api_caller_class', 'RelayModern');
            formData.append('fb_api_req_friendly_name', 'CometMarketplaceRootQuery');
            formData.append('doc_id', '6603566716407983'); // Lightweight marketplace query
            formData.append('variables', JSON.stringify({ buyLocation: { latitude: 0, longitude: 0 }, scale: 1 }));
            
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://www.facebook.com',
                'Referer': 'https://www.facebook.com/',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Cookie': this.cookie
            };
            
            const response = await fetch('https://www.facebook.com/api/graphql/', {
                method: 'POST',
                headers,
                body: formData.toString()
            });
            
            console.log(`   📡 [GraphQL Health] Response status: ${response.status}`);
            
            const responseText = await response.text();
            
            // Check for login redirect or unauthorized
            if (response.status === 401 || response.status === 403) {
                result.isUnauthorized = true;
                result.error = `HTTP ${response.status}`;
                return result;
            }
            
            // Check if redirected to login page
            if (responseText.includes('"error_code":1348006') || 
                responseText.includes('"error_code":190') ||
                responseText.includes('"code":190')) {
                result.isUnauthorized = true;
                result.error = 'Session expired or invalid';
                return result;
            }
            
            // Check for checkpoint/login required
            if (responseText.includes('checkpoint') && responseText.includes('login')) {
                result.isLoginPage = true;
                result.error = 'Checkpoint required';
                return result;
            }
            
            // Try to parse JSON
            try {
                const jsonData = JSON.parse(responseText);
                
                // Check for GraphQL errors
                if (jsonData.errors && jsonData.errors.length > 0) {
                    const errorCode = jsonData.errors[0].code;
                    if (errorCode === 190 || errorCode === 1348006) {
                        result.isUnauthorized = true;
                        result.error = jsonData.errors[0].message;
                        return result;
                    }
                }
                
                // If we got data, the session is valid
                if (jsonData.data) {
                    result.success = true;
                    result.data = { hasData: true };
                    console.log('   ✅ [GraphQL Health] Valid response with data');
                    return result;
                }
                
            } catch (parseError) {
                // JSON parse failed but might still be valid
                console.log('   ⚠️ [GraphQL Health] JSON parse failed, checking raw response...');
            }
            
            // If response is OK and no errors found, consider it valid
            if (response.ok && !result.isUnauthorized && !result.isLoginPage) {
                result.success = true;
                result.data = { rawResponse: true };
                console.log('   ✅ [GraphQL Health] Response OK, session valid');
            }
            
            return result;
            
        } catch (error) {
            console.error(`   ❌ [GraphQL Health] Error:`, error.message);
            result.error = error.message;
            return result;
        }
    }
    
    /**
     * Helper: Detect best header profile based on User-Agent
     * DEPRECATED: Now always returns 'desktop' since we use GraphQL exclusively
     * @private
     */
    _detectBestHeaderProfile(userAgent) {
        // Always return desktop - we no longer use mbasic
        return 'desktop';
    }
}

/**
 * Campaign Automation Service
 */
class CampaignAutomationService {
    /**
     * Process một campaign active
     * @param {Campaign} campaign
     */
    async processCampaign(campaign) {
        console.log(`🚀 Processing campaign: ${campaign.name} (${campaign._id})`);
        
        try {
            // 1. Get Facebook account với token
            const fbAccount = await FacebookAccount.getWithToken(campaign.facebookAccountId);
            
            if (!fbAccount) {
                console.log(`❌ Facebook account not found for campaign ${campaign._id}`);
                await campaign.pauseCampaign('Không tìm thấy tài khoản Facebook');
                return;
            }
            
            console.log(`📱 FB Account: ${fbAccount.name} | Status: ${fbAccount.tokenStatus} | Active: ${fbAccount.isActive}`);
            console.log(`🔑 Has Token: ${!!fbAccount.accessToken} | Has Cookie: ${!!fbAccount.cookie}`);
            console.log(`🔐 Auth Mode: ${fbAccount.authMode || 'unknown'}`);
            
            if (!fbAccount.isTokenValid()) {
                console.log(`❌ Facebook token invalid for campaign ${campaign._id} (status: ${fbAccount.tokenStatus})`);
                await campaign.pauseCampaign('Token Facebook không còn hoạt động');
                return;
            }
            
            // 2. Init Facebook API
            const fbAPI = new FacebookAPI(fbAccount.accessToken, fbAccount.cookie);
            
            // 3. Check account health (LIVE check for all modes)
            console.log('🏥 Checking account health...');
            
            const isCookieOnly = fbAccount.authMode === 'cookie_only' || fbAccount.tokenStatus === 'cookie_only';
            
            // Perform comprehensive health check (works for both OAuth and Cookie-only)
            const healthResult = await fbAPI.checkAccountHealth({
                userAgent: fbAccount.userAgent // Pass custom UA if stored
            });
            
            if (!healthResult.healthy) {
                console.log(`❌ Facebook account UNHEALTHY for campaign ${campaign._id}`);
                console.log('📋 Reason:', healthResult.reason);
                console.log('📋 Details:', JSON.stringify(healthResult.details, null, 2));
                
                // Update account status in DB
                try {
                    fbAccount.tokenStatus = 'invalid';
                    fbAccount.healthStatus = {
                        isHealthy: false,
                        lastError: healthResult.reason,
                        lastErrorAt: new Date()
                    };
                    fbAccount.lastCheckedAt = new Date();
                    await fbAccount.save();
                    console.log('📋 Account status updated to invalid in database');
                } catch (dbError) {
                    console.error('⚠️ Failed to update account status:', dbError.message);
                }
                
                await campaign.pauseCampaign(`Cookie/Token không hợp lệ: ${healthResult.reason}`);
                return;
            }
            
            console.log(`✅ Account healthy: ${healthResult.reason}`);
            console.log('📋 Health check details:', JSON.stringify(healthResult.details, null, 2));
            
            // Update healthy status in DB
            try {
                fbAccount.healthStatus = {
                    isHealthy: true,
                    lastError: null,
                    lastErrorAt: null
                };
                fbAccount.lastCheckedAt = new Date();
                await fbAccount.save();
            } catch (e) {
                // Non-critical, continue
            }
            
            // Log Desktop cookie confirmation (all crawling now uses GraphQL)
            if (healthResult.details?.isDesktopCookie) {
                console.log('✅ [Info] Desktop cookie confirmed - using GraphQL crawler (unified with extension)');
            }
            
            // 4. Get target posts to comment
            const targetPosts = await this.getTargetPosts(campaign);
            
            if (!targetPosts || targetPosts.length === 0) {
                console.log(`⚠️ [Campaign] No target posts to comment for campaign ${campaign._id}`);
                console.log(`📋 targetPostIds: ${campaign.targetPostIds?.length || 0}`);
                console.log(`📋 linkGroups: ${campaign.linkGroups?.length || 0}`);
                console.log(`📋 fanpages: ${campaign.fanpages?.length || 0}`);
                return;
            }
            
            console.log(`📝 Found ${targetPosts.length} posts to process`);
            
            // 5. Process each post with LIVE status checking
            let commentsPosted = 0;
            const maxCommentsThisRun = 3; // Limit per run để tránh spam
            
            for (const targetPost of targetPosts) {
                // === CRITICAL: RE-FETCH CAMPAIGN STATUS BEFORE EACH ACTION ===
                // This ensures immediate stop when user clicks "Stop" in UI
                const currentCampaign = await Campaign.findById(campaign._id).select('status');
                
                if (!currentCampaign || currentCampaign.status !== 'active') {
                    console.log(`\n⏹️  [CAMPAIGN STOPPED] Campaign ${campaign._id} was stopped/paused by user.`);
                    console.log(`   Current status: ${currentCampaign?.status || 'not found'}`);
                    console.log(`   Terminating processing loop immediately.`);
                    break;
                }
                
                const { postId, postUrl, groupId } = targetPost; // Destructure post object with groupId
                
                if (commentsPosted >= maxCommentsThisRun) {
                    console.log(`⏸️ Reached max comments limit (${maxCommentsThisRun}) for this run`);
                    break;
                }
                
                // Check if already commented on this post
                if (!campaign.canCommentOnPost(postId)) {
                    console.log(`⏭️ Post ${postId} đã đủ số lượng comment`);
                    continue;
                }
                
                // Generate comment content
                const commentData = campaign.generateComment();
                if (!commentData) {
                    console.log(`❌ Failed to generate comment for campaign ${campaign._id}`);
                    continue;
                }
                
                console.log(`💬 Commenting on post ${postId}:`);
                console.log(`   📝 Text: ${commentData.text.substring(0, 50)}...`);
                console.log(`   🔗 Link: ${commentData.fullUrl}`);
                console.log(`   🌐 Post URL: ${postUrl || 'N/A'}`);
                console.log(`   👥 Group ID: ${groupId || 'null (not a group post)'}`);
                
                // Post comment (cookie or OAuth based on auth mode)
                let result;
                if (isCookieOnly) {
                    // Pass groupId explicitly (PREFERRED) and postUrl as fallback
                    result = await fbAPI.postCommentWithCookie(postId, commentData.text, fbAccount.fb_dtsg, {
                        groupId: groupId,      // EXPLICIT: From crawler data
                        postUrl: postUrl       // FALLBACK: For URL-based extraction
                    });
                } else {
                    try {
                        const comment = await fbAPI.postComment(postId, commentData.text);
                        result = { success: true, id: comment.id, message: commentData.text };
                    } catch (error) {
                        result = { success: false, error: error.message };
                    }
                }
                
                if (result.success) {
                    console.log(`✅ Comment posted successfully: ${result.id}`);
                    await campaign.recordSuccessfulComment(postId, result.id);
                    commentsPosted++;
                    
                    // Update stats
                    campaign.stats.totalCommentsSent = (campaign.stats.totalCommentsSent || 0) + 1;
                    campaign.stats.successfulComments = (campaign.stats.successfulComments || 0) + 1;
                    await campaign.save();
                } else {
                    console.error(`❌ Comment failed: ${result.error}`);
                    await campaign.recordFailedComment(postId, result.error);
                    
                    // Update stats
                    campaign.stats.failedComments = (campaign.stats.failedComments || 0) + 1;
                    await campaign.save();
                }
                
                // Delay between comments (random delay)
                const delay = Math.floor(Math.random() * (campaign.delayMax - campaign.delayMin + 1)) + campaign.delayMin;
                console.log(`⏳ Waiting ${delay} seconds before next comment...`);
                await this.sleep(delay * 1000);
            }
            
            console.log(`✅ Campaign ${campaign.name} processed - ${commentsPosted} comments posted this run`);
            
        } catch (error) {
            console.error(`❌ Process campaign ${campaign._id} error:`, error);
            await campaign.recordFailedComment('N/A', error.message);
        }
    }
    
    /**
     * Get target posts for a campaign
     * @param {Campaign} campaign
     * @returns {Array<Object>} - Array of { postId, postUrl } objects
     */
    async getTargetPosts(campaign) {
        const posts = []; // Changed from postIds array to posts array with objects
        
        // Get FB account for cookie
        const fbAccount = await FacebookAccount.getWithToken(campaign.facebookAccountId);
        const cookie = fbAccount?.cookie || '';
        
        // 1. From targetPostIds (direct input by user)
        if (campaign.targetPostIds && campaign.targetPostIds.length > 0) {
            console.log(`📋 Processing ${campaign.targetPostIds.length} target post inputs...`);
            for (const input of campaign.targetPostIds) {
                let postId = null;
                let resolvedUrl = input; // Default to original input
                
                // Try sync extraction first
                postId = extractPostIdSync(input);
                
                // If sync failed or it looks like a share URL, try async with full details
                if (!postId || input.includes('/share/p/')) {
                    console.log(`   🔗 Resolving URL: ${input.substring(0, 60)}...`);
                    const resolved = await resolveUrlWithDetails(input, cookie);
                    postId = resolved.postId;
                    resolvedUrl = resolved.resolvedUrl || input;
                    console.log(`   📍 Resolved URL: ${resolvedUrl}`);
                }
                
                if (postId && postId !== 'NEEDS_ASYNC_RESOLVE') {
                    // Extract groupId from URL and include in post object
                    const groupId = this._extractGroupId(resolvedUrl) || null;
                    posts.push({ postId, postUrl: resolvedUrl, groupId });
                    console.log(`   ✅ Post ID: ${postId} (from: ${input.substring(0, 50)}...)`);
                    
                    if (groupId) {
                        console.log(`   👥 Group Post Detected - Group ID: ${groupId}`);
                    }
                } else {
                    console.error(`   ❌ Invalid post URL/ID: ${input}`);
                    console.error(`   ℹ️  Please use numeric post ID or classic Facebook URL`);
                }
            }
            console.log(`📊 Valid posts: ${posts.length}/${campaign.targetPostIds.length}`);
        }
        
        // 2. Crawl from linkGroups (Facebook Groups)
        if (campaign.linkGroups && campaign.linkGroups.length > 0) {
            console.log(`📋 Crawling ${campaign.linkGroups.length} Facebook groups...`);
            if (fbAccount && fbAccount.cookie) {
                for (const groupUrl of campaign.linkGroups) {
                    try {
                        const groupPosts = await this.crawlGroupPosts(groupUrl, fbAccount.cookie);
                        // Extract group ID from the group URL
                        const groupId = this._extractGroupId(groupUrl) || null;
                        // Convert to objects with postUrl and groupId
                        for (const crawledPost of groupPosts) {
                            // crawledPost can be string (postId) or object { postId, groupId }
                            const postId = typeof crawledPost === 'string' ? crawledPost : crawledPost.postId;
                            const postGroupId = typeof crawledPost === 'object' ? (crawledPost.groupId || groupId) : groupId;
                            // Construct group post URL
                            const postUrl = postGroupId 
                                ? `https://www.facebook.com/groups/${postGroupId}/posts/${postId}/`
                                : null;
                            posts.push({ postId, postUrl, groupId: postGroupId });
                        }
                        console.log(`   ✅ Found ${groupPosts.length} posts from group (Group ID: ${groupId || 'unknown'})`);
                    } catch (error) {
                        console.error(`   ❌ Failed to crawl group: ${groupUrl}`, error.message);
                    }
                }
            }
        }
        
        // 3. Crawl from fanpages
        if (campaign.fanpages && campaign.fanpages.length > 0) {
            console.log(`📋 Crawling ${campaign.fanpages.length} fanpages...`);
            if (fbAccount && fbAccount.cookie) {
                for (const pageUrl of campaign.fanpages) {
                    try {
                        const pagePosts = await this.crawlPagePosts(pageUrl, fbAccount.cookie);
                        // Fanpage posts don't have group ID
                        for (const crawledPost of pagePosts) {
                            const postId = typeof crawledPost === 'string' ? crawledPost : crawledPost.postId;
                            posts.push({ postId, postUrl: null, groupId: null }); // Explicitly null
                        }
                        console.log(`   ✅ Found ${pagePosts.length} posts from fanpage`);
                    } catch (error) {
                        console.error(`   ❌ Failed to crawl fanpage: ${pageUrl}`, error.message);
                    }
                }
            }
        }
        
        // 4. If no specific targets, crawl from News Feed (auto mode)
        if (posts.length === 0) {
            console.log(`📋 No specific targets, crawling News Feed (auto mode)...`);
            if (fbAccount && fbAccount.cookie) {
                try {
                    const feedPosts = await this.crawlNewsFeed(fbAccount.cookie, 10);
                    // News Feed posts can contain group posts - handle both formats
                    for (const crawledPost of feedPosts) {
                        if (typeof crawledPost === 'string') {
                            // Legacy format: just postId
                            posts.push({ postId: crawledPost, postUrl: null, groupId: null });
                        } else {
                            // New format: { postId, groupId, url }
                            const postUrl = crawledPost.groupId 
                                ? `https://www.facebook.com/groups/${crawledPost.groupId}/posts/${crawledPost.postId}/`
                                : crawledPost.url || null;
                            posts.push({ 
                                postId: crawledPost.postId, 
                                postUrl: postUrl, 
                                groupId: crawledPost.groupId || null 
                            });
                        }
                    }
                    console.log(`📰 Found ${feedPosts.length} posts from News Feed`);
                } catch (error) {
                    console.error(`❌ Failed to crawl News Feed:`, error.message);
                }
            }
        }
        
        // Remove duplicates based on postId
        const uniquePosts = [];
        const seenPostIds = new Set();
        for (const post of posts) {
            if (!seenPostIds.has(post.postId)) {
                seenPostIds.add(post.postId);
                uniquePosts.push(post);
            }
        }
        console.log(`📊 Total unique posts: ${uniquePosts.length}`);
        
        return uniquePosts;
    }
    
    /**
     * Helper: Extract Group ID from Facebook URL
     * Supports multiple URL formats:
     * - /groups/GROUP_ID/
     * - /groups/GROUP_ID/permalink/POST_ID/
     * - /groups/GROUP_ID/posts/POST_ID/
     * - https://www.facebook.com/groups/340470219463371/permalink/3292576427586054/
     * 
     * @param {String} url - Facebook post URL
     * @returns {String|null} Group ID or null if not a group post
     */
    _extractGroupId(url) {
        if (!url) {
            return null;
        }
        
        // Pattern 1: /groups/GROUP_ID/ (general pattern)
        const match = url.match(/\/groups\/(\d+)/i);
        if (match) {
            return match[1];
        }
        
        // Pattern 2: Encoded URL with groups in query params
        const encodedMatch = url.match(/groups%2F(\d+)/i);
        if (encodedMatch) {
            return encodedMatch[1];
        }
        
        return null;
    }
    
    /**
     * Crawl posts from Facebook News Feed using Desktop HTML Scraping
     * Fetches the main homepage and extracts post IDs from embedded script data
     * NEVER uses mbasic.facebook.com - all traffic looks like standard Windows/Chrome user
     * @param {String} cookie - Facebook cookie
     * @param {Number} limit - Max posts to fetch
     * @param {String} dtsg - Facebook DTSG token (optional, not used for HTML scraping)
     * @returns {Array<String>} - Array of post IDs
     */
    async crawlNewsFeed(cookie, limit = 10, dtsg = null) {
        console.log(`🔍 [Desktop HTML Crawler] Crawling News Feed via Desktop HTML (limit: ${limit})...`);
        
        try {
            const result = await this._desktopHtmlCrawl(cookie, 'newsfeed', null, limit);
            
            if (result.length > 0) {
                console.log(`✅ [Desktop HTML Crawler] Found ${result.length} posts`);
                return result;
            }
            
            console.log(`⚠️ [Desktop HTML Crawler] No posts found via HTML scraping`);
            return [];
            
        } catch (error) {
            console.error('❌ [Desktop HTML Crawler] Error:', error.message);
            return [];
        }
    }
    
    /**
     * Crawl posts from a Facebook Group using Desktop HTML Scraping
     * NEVER uses mbasic.facebook.com
     * @param {String} groupUrl - Group URL or ID
     * @param {String} cookie - Facebook cookie
     * @param {String} dtsg - Facebook DTSG token (optional)
     * @returns {Array<String>} - Array of post IDs
     */
    async crawlGroupPosts(groupUrl, cookie, dtsg = null) {
        console.log(`🔍 [Desktop HTML Group Crawler] Crawling group: ${groupUrl}`);
        
        // Extract group ID from URL
        let groupId = groupUrl;
        try {
            const url = new URL(groupUrl);
            const match = url.pathname.match(/\/groups\/([^\/]+)/);
            if (match) groupId = match[1];
        } catch (e) {
            // If not a valid URL, assume it's already a group ID
        }
        
        try {
            const result = await this._desktopHtmlCrawl(cookie, 'group', groupId, 10);
            
            if (result.length > 0) {
                console.log(`✅ [Desktop HTML Group Crawler] Found ${result.length} posts`);
                return result;
            }
            
            console.log(`⚠️ [Desktop HTML Group Crawler] No posts found via HTML scraping`);
            return [];
            
        } catch (error) {
            console.error('❌ [Desktop HTML Group Crawler] Error:', error.message);
            return [];
        }
    }
    
    /**
     * Crawl posts from a Facebook Page using Desktop HTML Scraping
     * NEVER uses mbasic.facebook.com
     * @param {String} pageUrl - Page URL or username
     * @param {String} cookie - Facebook cookie
     * @param {String} dtsg - Facebook DTSG token (optional)
     * @returns {Array<String>} - Array of post IDs
     */
    async crawlPagePosts(pageUrl, cookie, dtsg = null) {
        console.log(`🔍 [Desktop HTML Page Crawler] Crawling page: ${pageUrl}`);
        
        // Extract page ID/username from URL
        let pageId = pageUrl;
        try {
            const url = new URL(pageUrl);
            pageId = url.pathname.replace(/^\//, '').split('/')[0];
        } catch (e) {
            // If not a valid URL, assume it's already a page ID
        }
        
        try {
            const result = await this._desktopHtmlCrawl(cookie, 'page', pageId, 10);
            
            if (result.length > 0) {
                console.log(`✅ [Desktop HTML Page Crawler] Found ${result.length} posts`);
                return result;
            }
            
            console.log(`⚠️ [Desktop HTML Page Crawler] No posts found via HTML scraping`);
            return [];
            
        } catch (error) {
            console.error('❌ [Desktop HTML Page Crawler] Error:', error.message);
            return [];
        }
    }
    
    /**
     * Core Desktop HTML Scraping Crawler
     * Fetches the page and extracts post IDs from embedded script data
     * Uses exact same Desktop User-Agent and Cookie as Health Check
     * @private
     * @param {String} cookie - Facebook cookie
     * @param {String} feedType - 'newsfeed', 'group', or 'page'
     * @param {String} targetId - Group ID or Page ID (null for newsfeed)
     * @param {Number} limit - Max posts to fetch
     * @returns {Array<String>} - Array of post IDs
     */
    async _desktopHtmlCrawl(cookie, feedType, targetId, limit = 10) {
        console.log(`   🌐 [Desktop HTML Crawler] Type: ${feedType}, Target: ${targetId || 'Homepage'}, Limit: ${limit}`);
        
        // Build URL based on feed type
        let url;
        switch (feedType) {
            case 'group':
                url = `https://www.facebook.com/groups/${targetId}`;
                break;
            case 'page':
                url = `https://www.facebook.com/${targetId}`;
                break;
            case 'newsfeed':
            default:
                url = 'https://www.facebook.com/';
                break;
        }
        
        console.log(`   📍 [Desktop HTML Crawler] URL: ${url}`);
        
        // Desktop Chrome headers - identical to Health Check
        // IMPORTANT: Accept header ensures we get full HTML page
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Cookie': cookie
        };
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers,
                redirect: 'follow'
            });
            
            console.log(`   📡 [Desktop HTML Crawler] Response status: ${response.status}`);
            
            if (!response.ok) {
                console.error(`   ❌ [Desktop HTML Crawler] HTTP error: ${response.status}`);
                return [];
            }
            
            // Check for login redirect
            if (response.url.includes('/login')) {
                console.error(`   ❌ [Desktop HTML Crawler] Redirected to login - cookie invalid`);
                return [];
            }
            
            const html = await response.text();
            console.log(`   📄 [Desktop HTML Crawler] Response length: ${html.length} chars`);
            
            // Extract post IDs from HTML using regex patterns
            const postIds = this._extractPostIdsFromDesktopHtml(html, limit);
            
            console.log(`   📊 Found ${postIds.length} posts via Desktop HTML`);
            return postIds;
            
        } catch (error) {
            console.error(`   ❌ [Desktop HTML Crawler] Fetch error:`, error.message);
            return [];
        }
    }
    
    /**
     * Extract post IDs from Desktop Facebook HTML
     * Post data is hidden inside <script> tags - use regex to find patterns
     * NOW RETURNS OBJECTS with { postId, groupId } for full data flow
     * @private
     * @param {String} html - Raw HTML content
     * @param {Number} limit - Max posts to extract
     * @returns {Array<Object>} - Array of { postId, groupId } objects
     */
    _extractPostIdsFromDesktopHtml(html, limit = 10) {
        const foundIds = new Set(); // For deduplication
        const postDataMap = new Map(); // postId -> { postId, groupId }
        
        console.log(`   🔍 [HTML Parser] Scanning HTML for post IDs and group associations...`);
        
        // ========================================
        // FIRST: Build a groupId lookup table from HTML
        // Pattern: "associated_group":{"id":"123456789"} near post data
        // Also: "owning_profile":{"__typename":"Group","id":"123456789"}
        // ========================================
        const groupAssociations = new Map(); // postId -> groupId
        
        // Pattern A: Look for associated_group patterns near feedback IDs
        // Example: "associated_group":{"__typename":"Group","id":"1234567890"}
        const groupPattern1 = /"associated_group":\s*\{\s*"(?:__typename":\s*"Group",\s*)?"id":\s*"(\d+)"/g;
        let groupMatch;
        while ((groupMatch = groupPattern1.exec(html)) !== null) {
            // Try to find nearby postId - look backwards 1000 chars for top_level_post_id
            const contextStart = Math.max(0, groupMatch.index - 1000);
            const contextEnd = Math.min(html.length, groupMatch.index + 500);
            const context = html.slice(contextStart, contextEnd);
            
            const postIdMatch = context.match(/"top_level_post_id":\s*"(\d+)"/);
            if (postIdMatch) {
                groupAssociations.set(postIdMatch[1], groupMatch[1]);
                console.log(`      🔗 [Group Mapping] Post ${postIdMatch[1]} -> Group ${groupMatch[1]}`);
            }
        }
        
        // Pattern B: Look for owning_profile with Group typename
        // Example: "owning_profile":{"__typename":"Group","id":"123456789"}
        const groupPattern2 = /"owning_profile":\s*\{\s*"__typename":\s*"Group",\s*"id":\s*"(\d+)"/g;
        while ((groupMatch = groupPattern2.exec(html)) !== null) {
            const contextStart = Math.max(0, groupMatch.index - 1500);
            const contextEnd = Math.min(html.length, groupMatch.index + 500);
            const context = html.slice(contextStart, contextEnd);
            
            const postIdMatch = context.match(/"top_level_post_id":\s*"(\d+)"/);
            if (postIdMatch) {
                groupAssociations.set(postIdMatch[1], groupMatch[1]);
                console.log(`      🔗 [Group Mapping via owning_profile] Post ${postIdMatch[1]} -> Group ${groupMatch[1]}`);
            }
        }
        
        // ========================================
        // PATTERN 1: top_level_post_id (Most reliable)
        // Example: "top_level_post_id":"1330864165751471"
        // ========================================
        const pattern1 = /"top_level_post_id":"(\d+)"/g;
        let match;
        while ((match = pattern1.exec(html)) !== null && foundIds.size < limit) {
            const postId = match[1];
            if (!foundIds.has(postId) && postId.length >= 10) {
                foundIds.add(postId);
                const groupId = groupAssociations.get(postId) || null;
                postDataMap.set(postId, { postId, groupId });
                console.log(`      ✅ [Pattern 1] top_level_post_id: ${postId}${groupId ? ` (Group: ${groupId})` : ''}`);
            }
        }
        
        // ========================================
        // PATTERN 2: story_fbid (Array or single)
        // Example: "story_fbid":["1330864165751471"] or "story_fbid":"1330864165751471"
        // ========================================
        const pattern2 = /"story_fbid":\[?"(\d+)"\]?/g;
        while ((match = pattern2.exec(html)) !== null && foundIds.size < limit) {
            const postId = match[1];
            if (!foundIds.has(postId) && postId.length >= 10) {
                foundIds.add(postId);
                const groupId = groupAssociations.get(postId) || null;
                postDataMap.set(postId, { postId, groupId });
                console.log(`      ✅ [Pattern 2] story_fbid: ${postId}${groupId ? ` (Group: ${groupId})` : ''}`);
            }
        }
        
        // ========================================
        // PATTERN 3: UFI Feedback ID (Base64 encoded - MOST RELIABLE)
        // Example: "feedback":{"id":"ZmVlZGJhY2s6MTMzMDg2NDE2NTc1MTQ3MQ=="}
        // Decode Base64 -> "feedback:1330864165751471" -> Extract number
        // ========================================
        const pattern3 = /"feedback":\{"id":"(ZmVlZGJhY2s6[A-Za-z0-9+/=]+)"/g;
        while ((match = pattern3.exec(html)) !== null && foundIds.size < limit) {
            const base64Id = match[1];
            try {
                const decoded = Buffer.from(base64Id, 'base64').toString('utf-8');
                // decoded format: "feedback:1330864165751471"
                const postIdMatch = decoded.match(/feedback:(\d+)/);
                if (postIdMatch) {
                    const postId = postIdMatch[1];
                    if (!foundIds.has(postId) && postId.length >= 10) {
                        foundIds.add(postId);
                        const groupId = groupAssociations.get(postId) || null;
                        postDataMap.set(postId, { postId, groupId });
                        console.log(`      ✅ [Pattern 3] feedback (decoded): ${postId}${groupId ? ` (Group: ${groupId})` : ''}`);
                    }
                }
            } catch (e) {
                // Skip invalid Base64
                continue;
            }
        }
        
        // ========================================
        // PATTERN 4: post_id in various contexts
        // Example: "post_id":"1330864165751471"
        // ========================================
        const pattern4 = /"post_id":"(\d+)"/g;
        while ((match = pattern4.exec(html)) !== null && foundIds.size < limit) {
            const postId = match[1];
            if (!foundIds.has(postId) && postId.length >= 10) {
                foundIds.add(postId);
                const groupId = groupAssociations.get(postId) || null;
                postDataMap.set(postId, { postId, groupId });
                console.log(`      ✅ [Pattern 4] post_id: ${postId}${groupId ? ` (Group: ${groupId})` : ''}`);
            }
        }
        
        // ========================================
        // PATTERN 5: legacy_story_hideable_id
        // Example: "legacy_story_hideable_id":"1330864165751471"
        // ========================================
        const pattern5 = /"legacy_story_hideable_id":"(\d+)"/g;
        while ((match = pattern5.exec(html)) !== null && foundIds.size < limit) {
            const postId = match[1];
            if (!foundIds.has(postId) && postId.length >= 10) {
                foundIds.add(postId);
                const groupId = groupAssociations.get(postId) || null;
                postDataMap.set(postId, { postId, groupId });
                console.log(`      ✅ [Pattern 5] legacy_story_hideable_id: ${postId}${groupId ? ` (Group: ${groupId})` : ''}`);
            }
        }
        
        // ========================================
        // PATTERN 6: content_id for posts
        // Example: "content_id":"1330864165751471"
        // ========================================
        const pattern6 = /"content_id":"(\d+)"/g;
        while ((match = pattern6.exec(html)) !== null && foundIds.size < limit) {
            const postId = match[1];
            if (!foundIds.has(postId) && postId.length >= 10) {
                foundIds.add(postId);
                const groupId = groupAssociations.get(postId) || null;
                postDataMap.set(postId, { postId, groupId });
                console.log(`      ✅ [Pattern 6] content_id: ${postId}${groupId ? ` (Group: ${groupId})` : ''}`);
            }
        }
        
        // Convert Map to Array of objects { postId, groupId }
        const result = Array.from(postDataMap.values()).slice(0, limit);
        
        // Count group posts
        const groupPostCount = result.filter(p => p.groupId).length;
        
        // Summary log
        console.log(`   📊 [HTML Parser] Summary: Found ${result.length} unique posts`);
        console.log(`       - Group posts: ${groupPostCount}`);
        console.log(`       - Regular posts: ${result.length - groupPostCount}`);
        
        return result;
    }

    /**
     * Core Desktop GraphQL Feed Crawler (DEPRECATED - kept as fallback)
     * Uses the same endpoint and headers as the browser extension
     * @private
     * @param {String} cookie - Facebook cookie
     * @param {String} feedType - 'newsfeed', 'group', or 'page'
     * @param {String} targetId - Group ID or Page ID (null for newsfeed)
     * @param {Number} limit - Max posts to fetch
     * @param {String} dtsg - Facebook DTSG token
     * @param {String} cursor - Pagination cursor (null for first page)
     * @returns {Array<Object>} - Array of { postId, feedbackId, isSponsored }
     */
    async _graphqlFeedCrawl(cookie, feedType, targetId, limit = 10, dtsg = null, cursor = null) {
        console.log(`   📡 [GraphQL Crawler] Type: ${feedType}, Target: ${targetId || 'N/A'}, Limit: ${limit}`);
        
        // Extract User ID from cookie
        const userIdMatch = cookie.match(/c_user=(\d+)/);
        const userId = userIdMatch ? userIdMatch[1] : null;
        
        if (!userId) {
            console.error('   ❌ [GraphQL Crawler] Cannot extract User ID from cookie');
            return [];
        }
        
        // Generate jazoest from dtsg if available
        let jazoest = '2' + (dtsg ? [...dtsg].reduce((sum, c) => sum + c.charCodeAt(0), 0) : '0000');
        
        // Build GraphQL request based on feed type
        let docId, variables, friendlyName;
        
        switch (feedType) {
            case 'group':
                // GroupsCometFeedRegularStoriesPaginationQuery for group feeds
                docId = '7286892931344498';
                friendlyName = 'GroupsCometFeedRegularStoriesPaginationQuery';
                variables = {
                    groupID: targetId,
                    scale: 1,
                    count: limit,
                    cursor: cursor
                };
                break;
                
            case 'page':
                // ProfileCometTimelineFeedRefetchQuery for page feeds
                docId = '6438710716156284';
                friendlyName = 'ProfileCometTimelineFeedRefetchQuery';
                variables = {
                    id: targetId,
                    scale: 1,
                    count: limit,
                    cursor: cursor
                };
                break;
                
            case 'newsfeed':
            default:
                // UPDATED: CometNewsFeedQuery - Correct doc_id from captured traffic
                docId = '33727413766871870';
                friendlyName = 'CometNewsFeedQuery';
                variables = {
                    UFI2CommentsProvider_commentsKey: 'CometNewsFeed',
                    count: limit,
                    cursor: cursor, // null for first page, or cursor for pagination
                    feedLocation: 'NEWSFEED',
                    feedbackSource: 1,
                    privacySelectorRenderLocation: 'COMET_STREAM',
                    renderLocation: 'homepage_stream',
                    scale: 1,
                    useDefaultActor: false
                };
                break;
        }
        
        // Build form data
        const formData = new URLSearchParams();
        formData.append('av', userId);
        formData.append('__user', userId);
        formData.append('__a', '1');
        if (dtsg) {
            formData.append('fb_dtsg', dtsg);
            formData.append('jazoest', jazoest);
        }
        formData.append('fb_api_caller_class', 'RelayModern');
        formData.append('fb_api_req_friendly_name', friendlyName);
        formData.append('doc_id', docId);
        formData.append('variables', JSON.stringify(variables));
        
        // Desktop Chrome headers - identical to the commenter
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://www.facebook.com',
            'Referer': 'https://www.facebook.com/',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'X-FB-Friendly-Name': friendlyName,
            'Cookie': cookie
        };
        
        console.log(`   📋 [GraphQL Crawler] doc_id: ${docId}`);
        console.log(`   📋 [GraphQL Crawler] friendly_name: ${friendlyName}`);
        
        try {
            const response = await fetch('https://www.facebook.com/api/graphql/', {
                method: 'POST',
                headers,
                body: formData.toString()
            });
            
            console.log(`   📡 [GraphQL Crawler] Response status: ${response.status}`);
            
            if (!response.ok) {
                console.error(`   ❌ [GraphQL Crawler] HTTP error: ${response.status}`);
                return [];
            }
            
            const responseText = await response.text();
            console.log(`   📄 [GraphQL Crawler] Response length: ${responseText.length} chars`);
            
            // Parse and extract post IDs from GraphQL response
            const posts = this._extractPostIdsFromGraphQL(responseText, feedType, limit);
            
            console.log(`   📊 Found ${posts.length} posts via GraphQL`);
            return posts;
            
        } catch (error) {
            console.error(`   ❌ [GraphQL Crawler] Fetch error:`, error.message);
            return [];
        }
    }
    
    /**
     * Decode Base64 Facebook ID to extract numeric post ID
     * Facebook encodes IDs like "feedback:1234567890" or "S:_I1234567890:1234567890"
     * @private
     * @param {String} base64Id - Base64 encoded ID
     * @returns {String|null} - Numeric post ID or null
     */
    _decodeBase64PostId(base64Id) {
        try {
            const decoded = Buffer.from(base64Id, 'base64').toString('utf-8');
            console.log(`      🔓 Decoded Base64: "${decoded}"`);
            
            // Pattern: "feedback:POST_ID"
            const feedbackMatch = decoded.match(/feedback:(\d+)/);
            if (feedbackMatch) {
                return feedbackMatch[1];
            }
            
            // Pattern: "S:_IAUTHOR_ID:POST_ID" 
            const storyMatch = decoded.match(/:(\d{10,20})$/);
            if (storyMatch) {
                return storyMatch[1];
            }
            
            // Pattern: Just a number
            const numericMatch = decoded.match(/(\d{10,20})/);
            if (numericMatch) {
                return numericMatch[1];
            }
            
            return null;
        } catch (e) {
            console.log(`      ⚠️ Failed to decode Base64: ${e.message}`);
            return null;
        }
    }

    /**
     * Extract post IDs from GraphQL JSON response
     * Parses the specific Facebook GraphQL news_feed structure:
     * data.viewer.news_feed.edges[].node.post_id
     * @private
     * @param {String} responseText - Raw GraphQL response
     * @param {String} feedType - 'newsfeed', 'group', or 'page'
     * @param {Number} limit - Max posts to extract
     * @returns {Array<String>} - Array of post IDs
     */
    _extractPostIdsFromGraphQL(responseText, feedType = 'newsfeed', limit = 10) {
        const posts = [];
        const postIds = [];
        let sponsoredCount = 0;
        
        console.log(`   🔍 [GraphQL Parser] Parsing ${feedType} response...`);
        
        try {
            // Handle NDJSON format (multiple JSON objects separated by newlines)
            const jsonLines = responseText.split('\n').filter(line => line.trim());
            
            for (const line of jsonLines) {
                if (posts.length >= limit) break;
                
                try {
                    const data = JSON.parse(line);
                    
                    // ========================================
                    // PRIMARY PATH: data.viewer.news_feed.edges
                    // ========================================
                    let edges = null;
                    
                    try {
                        if (feedType === 'newsfeed') {
                            edges = data?.data?.viewer?.news_feed?.edges;
                        } else if (feedType === 'group') {
                            edges = data?.data?.group?.group_feed?.edges;
                        } else if (feedType === 'page') {
                            edges = data?.data?.page?.timeline_feed_units?.edges;
                        }
                    } catch (e) {
                        // Path doesn't exist, will try fallback
                    }
                    
                    if (edges && Array.isArray(edges)) {
                        console.log(`   ✅ [GraphQL Parser] Found edges array with ${edges.length} items`);
                        
                        for (const edge of edges) {
                            if (posts.length >= limit) break;
                            
                            try {
                                const node = edge?.node;
                                if (!node) continue;
                                
                                // Check if sponsored (th_dat_spo indicates ad)
                                const isSponsored = !!node.th_dat_spo;
                                if (isSponsored) {
                                    sponsoredCount++;
                                    console.log(`      📢 [Sponsored] Skipping ad post`);
                                    continue; // Skip sponsored posts
                                }
                                
                                // PRIMARY: Get post_id directly
                                let postId = node.post_id;
                                let feedbackId = null;
                                
                                // Get feedback ID if available
                                if (node.feedback?.id) {
                                    feedbackId = node.feedback.id;
                                }
                                
                                // FALLBACK 1: If no post_id, try to decode node.id
                                if (!postId && node.id) {
                                    console.log(`      🔄 No post_id, trying to decode node.id...`);
                                    postId = this._decodeBase64PostId(node.id);
                                }
                                
                                // FALLBACK 2: Decode from feedback.id
                                if (!postId && feedbackId) {
                                    console.log(`      🔄 Trying to decode feedback.id...`);
                                    postId = this._decodeBase64PostId(feedbackId);
                                }
                                
                                // FALLBACK 3: Look for legacy_story_hideable_id
                                if (!postId && node.legacy_story_hideable_id) {
                                    postId = node.legacy_story_hideable_id;
                                }
                                
                                // FALLBACK 4: Look for story_id
                                if (!postId && node.story?.id) {
                                    postId = this._decodeBase64PostId(node.story.id);
                                }
                                
                                // Validate and add
                                if (postId && /^\d{10,20}$/.test(postId) && !postIds.includes(postId)) {
                                    postIds.push(postId);
                                    posts.push({
                                        postId,
                                        feedbackId,
                                        isSponsored: false
                                    });
                                    console.log(`      ✅ Post ID: ${postId}`);
                                }
                                
                            } catch (nodeError) {
                                console.log(`      ⚠️ Error parsing node: ${nodeError.message}`);
                                continue;
                            }
                        }
                    }
                    
                    // ========================================
                    // FALLBACK: Recursive search if no edges found
                    // ========================================
                    if (posts.length === 0) {
                        this._recursiveExtractPostIds(data, postIds, limit);
                        // Convert to post objects
                        for (const id of postIds) {
                            if (!posts.find(p => p.postId === id)) {
                                posts.push({ postId: id, feedbackId: null, isSponsored: false });
                            }
                        }
                    }
                    
                } catch (e) {
                    // Skip invalid JSON lines
                    continue;
                }
            }
            
            // ========================================
            // LAST RESORT: Regex patterns if JSON parsing failed
            // ========================================
            if (posts.length === 0) {
                console.log(`   ⚠️ [GraphQL Parser] JSON parsing found 0 posts, trying regex...`);
                
                const patterns = [
                    // "post_id":"1234567890"
                    /"post_id"\s*:\s*"(\d{10,20})"/g,
                    // feedback:POST_ID in Base64 decoded content
                    /feedback:(\d{10,20})/g,
                    // legacy_story_hideable_id
                    /"legacy_story_hideable_id"\s*:\s*"(\d{10,20})"/g
                ];
                
                for (const pattern of patterns) {
                    let match;
                    while ((match = pattern.exec(responseText)) !== null && posts.length < limit) {
                        const postId = match[1];
                        if (!postIds.includes(postId)) {
                            postIds.push(postId);
                            posts.push({ postId, feedbackId: null, isSponsored: false });
                            console.log(`      ✅ Found via regex: ${postId}`);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('   ⚠️ [GraphQL Parser] Error:', error.message);
        }
        
        // Summary log
        console.log(`   📊 [GraphQL Parser] Summary: ${posts.length} posts found, ${sponsoredCount} sponsored skipped`);
        
        // Return just post IDs for backward compatibility
        return postIds.slice(0, limit);
    }
    
    /**
     * Recursively extract post IDs from nested JSON structure
     * @private
     */
    _recursiveExtractPostIds(obj, postIds, limit) {
        if (postIds.length >= limit) return;
        if (!obj || typeof obj !== 'object') return;
        
        // Look for common post ID fields
        const idFields = ['post_id', 'id', 'story_fbid', 'legacy_story_hideable_id'];
        
        for (const field of idFields) {
            if (obj[field] && typeof obj[field] === 'string') {
                const id = obj[field];
                // Validate: 15-20 digit number
                if (/^\d{15,20}$/.test(id) && !postIds.includes(id)) {
                    postIds.push(id);
                }
            }
        }
        
        // Check for feedback object (contains post_id)
        if (obj.feedback && obj.feedback.id) {
            // feedback.id is usually in format "feedback:POST_ID"
            const feedbackId = obj.feedback.id;
            const match = feedbackId.match(/feedback:(\d+)/);
            if (match && !postIds.includes(match[1])) {
                postIds.push(match[1]);
            }
        }
        
        // Recurse into arrays and objects
        if (Array.isArray(obj)) {
            for (const item of obj) {
                this._recursiveExtractPostIds(item, postIds, limit);
            }
        } else {
            for (const key of Object.keys(obj)) {
                this._recursiveExtractPostIds(obj[key], postIds, limit);
            }
        }
    }
    
    /**
     * Extract post IDs from mbasic Facebook HTML
     * DEPRECATED: Kept for emergency fallback only
     * Updated patterns for mbasic.facebook.com structure
     * @param {String} html - HTML content
     * @param {Number} limit - Max posts to extract
     * @returns {Array<String>} - Array of post IDs
     */
    /**
     * Extract post IDs from mbasic Facebook HTML
     * Updated patterns for mbasic.facebook.com structure
     * NOW INCLUDES: WAP detection and enhanced patterns
     * @param {String} html - HTML content
     * @param {Number} limit - Max posts to extract
     * @returns {Array<String>} - Array of post IDs
     */
    extractPostIdsFromHtml(html, limit = 10) {
        const postIds = [];
        let match;
        
        // === WAP PAGE DETECTION ===
        if (html.includes('WAPFORUM') || html.includes('<!DOCTYPE wml') || html.includes('application/vnd.wap')) {
            console.error(`   ❌ [HTML Parser] WAP PAGE DETECTED!`);
            console.error(`   ℹ️  This means Facebook treated the request as an ancient mobile device.`);
            console.error(`   ℹ️  The User-Agent or headers need to be updated.`);
            console.log(`   📋 HTML Preview: ${html.substring(0, 300)}`);
            return [];
        }
        
        // DEBUG: Log first 2000 chars to see structure
        console.log(`   🔍 [HTML Parser] HTML Preview (first 500 chars):`);
        console.log(html.substring(0, 500).replace(/\n/g, ' ').substring(0, 200));
        
        // Pattern 1: action="/a/comment.php" with ft_ent_identifier
        // mbasic uses this for comment forms: action="/a/comment.php" + input name="ft_ent_identifier" value="12345"
        const commentFormPattern = /action="\/a\/comment\.php"[^>]*>[\s\S]*?name="ft_ent_identifier"\s*value="(\d+)"/g;
        while ((match = commentFormPattern.exec(html)) !== null && postIds.length < limit) {
            if (!postIds.includes(match[1])) {
                postIds.push(match[1]);
                console.log(`   ✅ Pattern (comment_form): ${match[1]}`);
            }
        }
        
        // Pattern 2: ft_ent_identifier anywhere (as input value or data attribute)
        const ftEntValuePattern = /ft_ent_identifier['"=:]+\s*['"=:]?(\d+)/gi;
        while ((match = ftEntValuePattern.exec(html)) !== null && postIds.length < limit) {
            if (!postIds.includes(match[1])) {
                postIds.push(match[1]);
                console.log(`   ✅ Pattern (ft_ent): ${match[1]}`);
            }
        }
        
        // Pattern 3: /story.php?story_fbid=123456&id=xxx
        const storyPattern = /story\.php\?story_fbid=(\d+)/g;
        while ((match = storyPattern.exec(html)) !== null && postIds.length < limit) {
            if (!postIds.includes(match[1])) {
                postIds.push(match[1]);
                console.log(`   ✅ Pattern (story): ${match[1]}`);
            }
        }
        
        // Pattern 4: /comment/replies/?ctoken=POST_ID_COMMENT_ID
        const ctokenPattern = /ctoken=(\d+)_/g;
        while ((match = ctokenPattern.exec(html)) !== null && postIds.length < limit) {
            if (!postIds.includes(match[1])) {
                postIds.push(match[1]);
                console.log(`   ✅ Pattern (ctoken): ${match[1]}`);
            }
        }
        
        // Pattern 5: /posts/123456 (classic format)
        const postsPattern = /\/posts\/(\d+)/g;
        while ((match = postsPattern.exec(html)) !== null && postIds.length < limit) {
            if (!postIds.includes(match[1])) {
                postIds.push(match[1]);
                console.log(`   ✅ Pattern (posts): ${match[1]}`);
            }
        }
        
        // Pattern 6: /permalink/123456
        const permalinkPattern = /\/permalink\/(\d+)/g;
        while ((match = permalinkPattern.exec(html)) !== null && postIds.length < limit) {
            if (!postIds.includes(match[1])) {
                postIds.push(match[1]);
                console.log(`   ✅ Pattern (permalink): ${match[1]}`);
            }
        }
        
        // Pattern 7: /photo.php?fbid=123456
        const photoPattern = /photo\.php\?fbid=(\d+)/g;
        while ((match = photoPattern.exec(html)) !== null && postIds.length < limit) {
            if (!postIds.includes(match[1])) {
                postIds.push(match[1]);
                console.log(`   ✅ Pattern (photo): ${match[1]}`);
            }
        }
        
        // Pattern 8: mf_story_key in data-ft
        const mfStoryPattern = /mf_story_key[\.":]+(\d+)/g;
        while ((match = mfStoryPattern.exec(html)) !== null && postIds.length < limit) {
            if (!postIds.includes(match[1])) {
                postIds.push(match[1]);
                console.log(`   ✅ Pattern (mf_story): ${match[1]}`);
            }
        }
        
        // Pattern 9: /like.php?... (like buttons have post IDs)
        const likePattern = /like\.php\?[^"']*?action_item_id=(\d+)/g;
        while ((match = likePattern.exec(html)) !== null && postIds.length < limit) {
            if (!postIds.includes(match[1])) {
                postIds.push(match[1]);
                console.log(`   ✅ Pattern (like): ${match[1]}`);
            }
        }
        
        // Pattern 10: /reaction/picker/... with ft_id
        const reactionPattern = /reaction\/picker\/[^"']*?ft_id=(\d+)/g;
        while ((match = reactionPattern.exec(html)) !== null && postIds.length < limit) {
            if (!postIds.includes(match[1])) {
                postIds.push(match[1]);
                console.log(`   ✅ Pattern (reaction): ${match[1]}`);
            }
        }
        
        // Pattern 11: /ufi/reaction/profile/... with ft_ent_identifier
        const ufiPattern = /ufi\/[^"']*?ft_ent_identifier=(\d+)/g;
        while ((match = ufiPattern.exec(html)) !== null && postIds.length < limit) {
            if (!postIds.includes(match[1])) {
                postIds.push(match[1]);
                console.log(`   ✅ Pattern (ufi): ${match[1]}`);
            }
        }
        
        console.log(`   📊 [HTML Parser] Total unique posts found: ${postIds.length}`);
        
        // If still no posts found, log more HTML for debugging
        if (postIds.length === 0) {
            console.log(`   ⚠️ [HTML Parser] No posts found! Checking for patterns...`);
            console.log(`   - Contains 'comment.php': ${html.includes('comment.php')}`);
            console.log(`   - Contains 'story_fbid': ${html.includes('story_fbid')}`);
            console.log(`   - Contains 'ft_ent_identifier': ${html.includes('ft_ent_identifier')}`);
            console.log(`   - Contains 'mf_story_key': ${html.includes('mf_story_key')}`);
            console.log(`   - Contains '/posts/': ${html.includes('/posts/')}`);
            console.log(`   - Contains 'like.php': ${html.includes('like.php')}`);
            console.log(`   - Contains login redirect: ${html.includes('login')}`);
            console.log(`   - HTML length: ${html.length}`);
            
            // Check if we got a login page
            if (html.includes('login') && html.length < 10000) {
                console.error(`   ❌ [HTML Parser] Possible login page - cookie may be invalid`);
            }
        }
        
        return postIds;
    }
    
    /**
     * Comment vào một post
     * @param {Campaign} campaign
     * @param {String} postId - Facebook Post ID
     * @param {Object} postStats - { likes, comments, shares }
     * @returns {Boolean} - Success or not
     */
    async commentOnPost(campaign, postId, postStats) {
        try {
            // 1. Check if post matches filters
            if (!campaign.matchesFilters(postStats)) {
                console.log(`⏭️  Post ${postId} không thỏa filters`);
                return false;
            }
            
            // 2. Check if can comment on this post
            if (!campaign.canCommentOnPost(postId)) {
                console.log(`⏭️  Post ${postId} đã đủ số lượng comment hoặc bị block`);
                return false;
            }
            
            // 3. Get Facebook API instance
            const fbAccount = await FacebookAccount.getWithToken(campaign.facebookAccountId);
            const fbAPI = new FacebookAPI(fbAccount.accessToken, fbAccount.cookie);
            
            // 4. Generate comment content
            const { text, slug, fullUrl } = campaign.generateComment();
            
            console.log(`💬 Commenting on post ${postId}: ${text}`);
            
            // 5. Post comment
            const comment = await fbAPI.postComment(postId, text);
            
            console.log(`✅ Comment posted: ${comment.id}`);
            
            // 6. Add post to targeted list (nếu là lần đầu)
            await campaign.addTargetedPost({
                postId,
                postUrl: `https://facebook.com/${postId}`,
                stats: postStats
            });
            
            // 7. Record successful comment
            await campaign.recordSuccessfulComment(postId, comment.id);
            
            // 8. SAFETY CHECK: Verify comment sau 5 giây
            await this.safetyCheckComment(campaign, postId, comment.id, fbAPI);
            
            return true;
            
        } catch (error) {
            console.error(`❌ Comment on post ${postId} error:`, error);
            await campaign.recordFailedComment(postId, error.message);
            return false;
        }
    }
    
    /**
     * Safety Check: Kiểm tra comment có bị gỡ không
     * @param {Campaign} campaign
     * @param {String} postId
     * @param {String} commentId
     * @param {FacebookAPI} fbAPI
     */
    async safetyCheckComment(campaign, postId, commentId, fbAPI) {
        console.log(`🔍 Safety check for comment ${commentId}...`);
        
        // Đợi 5 giây
        await this.sleep(5000);
        
        try {
            const comment = await fbAPI.getComment(commentId);
            
            if (!comment) {
                // Comment bị gỡ!
                console.log(`⚠️  BLOCKED! Comment ${commentId} đã bị gỡ`);
                
                // Block post này
                await campaign.blockPost(postId, 'Comment bị gỡ ngay lập tức');
                
                // Auto-stop campaign
                await campaign.stopCampaign('Comment bị gỡ - Tài khoản có thể bị block');
                
                return false;
            }
            
            console.log(`✅ Safety check passed for comment ${commentId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Safety check error:`, error);
            return false;
        }
    }
    
    /**
     * Helper: Sleep
     * @param {Number} ms - Milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Process all active campaigns
     */
    async processAllActiveCampaigns() {
        try {
            console.log('🔄 Checking active campaigns...');
            
            const campaigns = await Campaign.getActiveCampaigns();
            
            console.log(`📊 Found ${campaigns.length} active campaigns`);
            
            for (const campaign of campaigns) {
                await this.processCampaign(campaign);
                
                // Delay giữa các campaigns
                await this.sleep(5000);
            }
            
        } catch (error) {
            console.error('❌ Process all campaigns error:', error);
        }
    }
}

// Export singleton instance
const automationService = new CampaignAutomationService();

module.exports = {
    FacebookAPI,
    CampaignAutomationService,
    automationService,
    // Export utility functions for testing
    extractPostId,
    extractPostIdSync,
    extractPostIdAsync,
    resolveShareUrl,
    resolveUrlWithDetails, // New: Returns both postId and resolvedUrl
    // Export new crawler components
    FacebookCrawler,
    FacebookUrlResolver,
    MbasicParser,
    getHeaders,
    MODERN_HEADERS
};
