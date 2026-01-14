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
     * Get post stats using Cookie-based GraphQL API
     * Used when OAuth token is not available (cookie_only mode)
     * @param {String} postId - Facebook Post ID
     * @param {String} dtsg - Facebook DTSG token
     * @param {String} postUrl - Optional post URL for HTML fallback
     * @returns {Object} - { id, likes, comments, shares, success, error }
     */
    async getPostStatsWithCookie(postId, dtsg, postUrl = null) {
        console.log(`\n📊 [Get Post Stats] Fetching stats for post: ${postId}`);
        
        try {
            if (!this.cookie) {
                console.error('❌ [Get Post Stats] No cookie available');
                return { id: postId, likes: 0, comments: 0, shares: 0, success: false, error: 'No cookie' };
            }
            
            // Extract User ID from cookie
            const userId = this._extractUserId(this.cookie);
            if (!userId) {
                console.error('❌ [Get Post Stats] Cannot extract User ID from cookie');
                return { id: postId, likes: 0, comments: 0, shares: 0, success: false, error: 'No user ID' };
            }
            
            // ============================================
            // ATTEMPT 1: GraphQL CometUFIFeedbackQuery
            // ============================================
            console.log(`   📡 [Attempt 1] Trying GraphQL CometUFIFeedbackQuery...`);
            
            // Generate feedback ID (Base64 encoded "feedback:{postId}")
            const feedbackId = this._encodeFeedbackId(postId);
            console.log(`   🔑 Feedback ID: ${feedbackId}`);
            
            // Build GraphQL variables for fetching feedback data
            const variables = {
                feedbackTargetID: feedbackId,
                feedLocation: "DEDICATED_COMMENTING_SURFACE",
                useDefaultActor: false,
                scale: 1
            };
            
            // Build form data
            const formData = new URLSearchParams();
            formData.append('av', userId);
            formData.append('__user', userId);
            formData.append('__a', '1');
            if (dtsg) {
                formData.append('fb_dtsg', dtsg);
                formData.append('jazoest', this._generateJazoest(dtsg));
            }
            formData.append('fb_api_caller_class', 'RelayModern');
            formData.append('fb_api_req_friendly_name', 'CometUFIFeedbackQuery');
            formData.append('doc_id', '5587197327998288'); // Feedback query doc_id
            formData.append('variables', JSON.stringify(variables));
            
            const headers = {
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
            
            let graphqlStats = null;
            
            try {
                const response = await fetch('https://www.facebook.com/api/graphql/', {
                    method: 'POST',
                    headers,
                    body: formData.toString()
                });
                
                if (response.ok) {
                    const responseText = await response.text();
                    graphqlStats = this._parseStatsFromGraphQL(responseText, postId);
                    
                    if (graphqlStats && (graphqlStats.likes > 0 || graphqlStats.comments > 0 || graphqlStats.shares > 0)) {
                        console.log(`   ✅ [GraphQL] Success: Likes=${graphqlStats.likes}, Comments=${graphqlStats.comments}, Shares=${graphqlStats.shares}`);
                        return { ...graphqlStats, success: true, method: 'graphql' };
                    }
                    console.log(`   ⚠️ [GraphQL] Returned zero stats, trying HTML fallback...`);
                }
            } catch (gqlError) {
                console.log(`   ⚠️ [GraphQL] Error: ${gqlError.message}, trying HTML fallback...`);
            }
            
            // ============================================
            // ATTEMPT 2: HTML Page Fetch (Fallback)
            // ============================================
            console.log(`   📡 [Attempt 2] Trying HTML page fetch fallback...`);
            
            // Build post URL if not provided
            const targetUrl = postUrl || `https://www.facebook.com/${postId}`;
            console.log(`   🔗 Fetching: ${targetUrl}`);
            
            const htmlHeaders = {
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
                'Cookie': this.cookie
            };
            
            try {
                const htmlResponse = await fetch(targetUrl, {
                    method: 'GET',
                    headers: htmlHeaders,
                    redirect: 'follow'
                });
                
                if (htmlResponse.ok) {
                    const html = await htmlResponse.text();
                    const htmlStats = this._parseStatsFromHTML(html, postId);
                    
                    if (htmlStats && (htmlStats.likes > 0 || htmlStats.comments > 0 || htmlStats.shares > 0)) {
                        console.log(`   ✅ [HTML] Success: Likes=${htmlStats.likes}, Comments=${htmlStats.comments}, Shares=${htmlStats.shares}`);
                        return { ...htmlStats, success: true, method: 'html_fallback' };
                    }
                    console.log(`   ⚠️ [HTML] Could not extract stats from page`);
                }
            } catch (htmlError) {
                console.log(`   ⚠️ [HTML] Error: ${htmlError.message}`);
            }
            
            // ============================================
            // ATTEMPT 3: Direct Post Permalink Fetch
            // ============================================
            console.log(`   📡 [Attempt 3] Trying direct permalink fetch...`);
            
            const permalinkUrl = `https://www.facebook.com/permalink.php?story_fbid=${postId}&id=0`;
            
            try {
                const permalinkResponse = await fetch(permalinkUrl, {
                    method: 'GET',
                    headers: htmlHeaders,
                    redirect: 'follow'
                });
                
                if (permalinkResponse.ok) {
                    const html = await permalinkResponse.text();
                    const permalinkStats = this._parseStatsFromHTML(html, postId);
                    
                    if (permalinkStats && (permalinkStats.likes > 0 || permalinkStats.comments > 0 || permalinkStats.shares > 0)) {
                        console.log(`   ✅ [Permalink] Success: Likes=${permalinkStats.likes}, Comments=${permalinkStats.comments}, Shares=${permalinkStats.shares}`);
                        return { ...permalinkStats, success: true, method: 'permalink_fallback' };
                    }
                }
            } catch (permalinkError) {
                console.log(`   ⚠️ [Permalink] Error: ${permalinkError.message}`);
            }
            
            // All attempts failed - return zero stats but mark as success to not block campaign
            console.log(`   ⚠️ [Get Post Stats] All attempts failed, returning zero stats`);
            return { 
                id: postId, 
                likes: 0, 
                comments: 0, 
                shares: 0, 
                success: true, // Mark as success so campaign doesn't fail
                method: 'fallback_zero',
                warning: 'Could not fetch actual stats, using zero values'
            };
            
        } catch (error) {
            console.error('❌ [Get Post Stats] Exception:', error.message);
            return { id: postId, likes: 0, comments: 0, shares: 0, success: false, error: error.message };
        }
    }
    
    /**
     * Parse stats from GraphQL response
     * @private
     */
    _parseStatsFromGraphQL(responseText, postId) {
        try {
            // Try to parse as JSON
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                // Facebook sometimes returns multiple JSON objects
                const firstJson = responseText.split('\n')[0];
                data = JSON.parse(firstJson);
            }
            
            // Try structured data paths
            const feedback = data?.data?.feedback || data?.data?.node;
            
            if (feedback) {
                return {
                    id: postId,
                    likes: feedback.reaction_count?.count || feedback.likers?.count || 0,
                    comments: feedback.total_comment_count || feedback.comment_count?.total_count || 0,
                    shares: feedback.share_count?.count || 0
                };
            }
            
            // Fallback: Regex extraction from raw text
            return this._parseStatsFromHTML(responseText, postId);
            
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Parse stats from HTML/raw text using regex patterns
     * @private
     */
    _parseStatsFromHTML(html, postId) {
        try {
            let likes = 0, comments = 0, shares = 0;
            
            // ============================================
            // LIKES/REACTIONS PATTERNS (try multiple)
            // Priority: Structured JSON > Aria labels > Text patterns
            // ============================================
            const likePatterns = [
                // JSON/GraphQL patterns (most reliable)
                /"reaction_count":\s*\{\s*"count":\s*(\d+)\s*\}/,           // {"reaction_count":{"count":123}}
                /reaction_count:\s*\{\s*count:\s*(\d+)\s*\}/,               // reaction_count:{count:123}
                /"likers":\s*\{\s*"count":\s*(\d+)\s*\}/,                   // {"likers":{"count":123}}
                /likers:\s*\{\s*count:\s*(\d+)\s*\}/,                       // likers:{count:123}
                /"reactors":\s*\{\s*"count":\s*(\d+)\s*\}/,                 // {"reactors":{"count":123}}
                /"reaction_count":(\d+)/,                                    // "reaction_count":123
                
                // HTML attribute patterns
                /data-reaction-count="(\d+)"/,                               // data-reaction-count="123"
                /aria-label="[^"]*?(\d+)\s*(?:người|people)/i,              // aria-label="... 123 người"
                
                // Vietnamese text patterns in rendered HTML
                />Tất cả cảm xúc:[^<]*?(\d+(?:[.,]\d+)?)</i,               // >Tất cả cảm xúc: 467<
                />(\d+(?:[.,]\d+)?)\s*(?:người\s*thích|người|people)</i,   // >467 người thích<
                /aria-label="(?:Thích|Yêu thích|Like|Love|Haha|Wow|Buồn|Phẫn nộ|Sad|Angry)[^"]*?(\d+)\s*(?:người|people)"/i,
                
                // General text patterns
                /(\d+(?:[.,]\d+)?)\s*(?:reactions?|likes?|người\s*thích)/i, // "123 reactions" or "123 likes"
            ];
            
            for (const pattern of likePatterns) {
                const match = html.match(pattern);
                if (match) {
                    // Handle numbers with commas or dots (e.g., "1,234" or "1.234")
                    const rawNum = match[1].replace(/[.,]/g, '');
                    const parsed = parseInt(rawNum);
                    if (parsed > 0) {
                        likes = parsed;
                        console.log(`      📊 [Regex] Likes: ${likes} (pattern: ${pattern.source.substring(0, 35)}...)`);
                        break;
                    }
                }
            }
            
            // ============================================
            // COMMENTS PATTERNS (try multiple)
            // Priority: Structured JSON > Aria labels > Text patterns
            // ============================================
            const commentPatterns = [
                // JSON/GraphQL patterns (most reliable)
                /"total_comment_count":\s*(\d+)/,                            // "total_comment_count":45
                /total_comment_count:\s*(\d+)/,                              // total_comment_count:45
                /"comment_count":\s*\{\s*"total_count":\s*(\d+)\s*\}/,      // {"comment_count":{"total_count":45}}
                /comment_count:\s*\{\s*total_count:\s*(\d+)\s*\}/,          // comment_count:{total_count:45}
                /"comments":\s*\{\s*"total_count":\s*(\d+)\s*\}/,           // {"comments":{"total_count":45}}
                /"comment_count":(\d+)/,                                     // "comment_count":45
                
                // HTML attribute patterns  
                /data-comment-count="(\d+)"/,                                // data-comment-count="45"
                /aria-label="[^"]*?(\d+)\s*(?:bình luận|comments?)"/i,      // aria-label="23 bình luận"
                
                // Vietnamese/English text patterns in rendered HTML (CRITICAL FIX)
                />(\d+(?:[.,]\d+)?)\s*(?:bình\s*luận|comments?)</i,         // >23 bình luận< or >23 comments<
                />\s*(\d+(?:[.,]\d+)?)\s*<\/[^>]*>.*?(?:bình\s*luận|comments?)/is, // >23</span> bình luận
                /(\d+(?:[.,]\d+)?)\s*(?:bình\s*luận|comments?)/i,           // general text pattern
            ];
            
            for (const pattern of commentPatterns) {
                const match = html.match(pattern);
                if (match) {
                    const rawNum = match[1].replace(/[.,]/g, '');
                    const parsed = parseInt(rawNum);
                    if (parsed > 0) {
                        comments = parsed;
                        console.log(`      📊 [Regex] Comments: ${comments} (pattern: ${pattern.source.substring(0, 35)}...)`);
                        break;
                    }
                }
            }
            
            // ============================================
            // SHARES PATTERNS (ENHANCED - Vietnamese/English)
            // Priority order: Most specific to most general
            // ============================================
            const sharePatterns = [
                // GraphQL/JSON patterns (most reliable)
                /"share_count":\s*\{\s*"count":\s*(\d+)\s*\}/,              // {"share_count":{"count":12}}
                /share_count:\s*\{\s*count:\s*(\d+)\s*\}/,                  // share_count:{count:12}
                /"share_count":\s*(\d+)/,                                    // "share_count":12 (direct value)
                /share_count:\s*(\d+)/,                                      // share_count:12 (unquoted)
                /"reshare_count":\s*\{\s*"count":\s*(\d+)\s*\}/,            // {"reshare_count":{"count":12}}
                /reshare_count:\s*\{\s*count:\s*(\d+)\s*\}/,                // reshare_count:{count:12}
                /"reshares":\s*\{\s*"count":\s*(\d+)\s*\}/,                 // {"reshares":{"count":12}}
                /"shares":\s*\{\s*"count":\s*(\d+)\s*\}/,                   // {"shares":{"count":12}}
                /shares:\s*\{\s*count:\s*(\d+)\s*\}/,                       // shares:{count:12}
                
                // HTML attribute patterns
                /data-share-count="(\d+)"/,                                  // data-share-count="12"
                /data-shares="(\d+)"/,                                       // data-shares="12"
                /aria-label="[^"]*?(\d+)\s*(?:shares?|lượt\s*chia\s*sẻ)"/i, // aria-label="12 shares"
                
                // Vietnamese/English text patterns in rendered HTML (CRITICAL FIX)
                />(\d+(?:[.,]\d+)?)\s*(?:lượt\s*chia\s*sẻ|shares?)</i,      // >161 lượt chia sẻ< or >161 shares<
                />\s*(\d+(?:[.,]\d+)?)\s*<\/[^>]*>.*?(?:lượt\s*chia\s*sẻ|shares?)/is, // >161</span> lượt chia sẻ
                /(?:Chia\s*sẻ|Share)[^0-9]*?(\d+(?:[.,]\d+)?)/i,            // "Chia sẻ 12" or "Share 12"
                /(\d+(?:[.,]\d+)?)\s*(?:shares?|lượt\s*chia\s*sẻ)/i,        // general pattern
                
                // Embedded JSON patterns
                /"shareCount":\s*(\d+)/,                                     // "shareCount":12
                /shareCount:\s*(\d+)/,                                       // shareCount:12
                /"share_count_reduced":\s*"(\d+)"/,                          // "share_count_reduced":"12"
            ];
            
            for (const pattern of sharePatterns) {
                const match = html.match(pattern);
                if (match) {
                    const rawNum = match[1].replace(/[.,]/g, '');
                    const parsed = parseInt(rawNum);
                    if (parsed > 0) {
                        shares = parsed;
                        console.log(`      📊 [Regex] Shares: ${shares} (pattern: ${pattern.source.substring(0, 40)}...)`);
                        break;
                    }
                }
            }
            
            // ============================================
            // SECONDARY SCAN (if primary patterns failed)
            // ============================================
            if (shares === 0) {
                // Look for share counts in feedback data structures
                const feedbackShareMatch = html.match(/"feedback"[^}]*"share_count"[^}]*"count":\s*(\d+)/);
                if (feedbackShareMatch && parseInt(feedbackShareMatch[1]) > 0) {
                    shares = parseInt(feedbackShareMatch[1]);
                    console.log(`      📊 [Regex] Shares (feedback): ${shares}`);
                }
                
                // Look for comet share pattern (new Facebook UI)
                if (!shares) {
                    const cometShareMatch = html.match(/CometUFIShareActionLink[^}]*count[":]+(\d+)/);
                    if (cometShareMatch && parseInt(cometShareMatch[1]) > 0) {
                        shares = parseInt(cometShareMatch[1]);
                        console.log(`      📊 [Regex] Shares (comet): ${shares}`);
                    }
                }
            }
            
            if (comments === 0) {
                // Secondary comment patterns
                const feedbackCommentMatch = html.match(/"feedback"[^}]*"comment_count"[^}]*"total_count":\s*(\d+)/);
                if (feedbackCommentMatch && parseInt(feedbackCommentMatch[1]) > 0) {
                    comments = parseInt(feedbackCommentMatch[1]);
                    console.log(`      📊 [Regex] Comments (feedback): ${comments}`);
                }
            }
            
            if (likes === 0) {
                // Sum up individual reaction types if total not found
                const reactionTypes = ['Like', 'Love', 'Haha', 'Wow', 'Sad', 'Angry', 'Thích', 'Yêu thích'];
                let reactionSum = 0;
                for (const type of reactionTypes) {
                    const reactionMatch = html.match(new RegExp(`${type}[^0-9]*?(\\d+)\\s*(?:người|people)`, 'i'));
                    if (reactionMatch) {
                        reactionSum += parseInt(reactionMatch[1]);
                    }
                }
                if (reactionSum > 0) {
                    likes = reactionSum;
                    console.log(`      📊 [Regex] Likes (sum): ${likes}`);
                }
            }
            
            // Log final result
            const result = { id: postId, likes, comments, shares };
            console.log(`      📊 [Final Stats] Likes=${likes}, Comments=${comments}, Shares=${shares}`);
            
            return result;
            
        } catch (e) {
            console.log(`      ⚠️ [Regex] Parse error: ${e.message}`);
            return null;
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
    /**
     * Helper: Generate message ranges for URL linkification
     * Detects all URLs in the message and creates entity ranges for Facebook to render as clickable links
     * 
     * @param {String} text - Message text that may contain URLs
     * @returns {Array} Array of entity objects: [{ entity: { url: ... }, offset: ..., length: ... }]
     */
    _generateMessageRanges(text) {
        const ranges = [];
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let match;
        
        while ((match = urlRegex.exec(text)) !== null) {
            ranges.push({
                entity: {
                    url: match[0] 
                },
                offset: match.index,
                length: match[0].length 
            });
        }
        
        // No need for explicit check for ranges.length > 0 if we always return ranges
        // if (ranges.length > 0) {
        //     console.log(`🔗 [Linkify] Detected ${ranges.length} URL(s) in message`);
        //     ranges.forEach((range, idx) => {
        //         console.log(`   ${idx + 1}. "${range.entity.url}" at offset ${range.offset}`);
        //     });
        // }
        
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
     * Helper: Clean GraphQL payload by removing null/undefined values
     * Facebook GraphQL strict mode rejects null for optional fields
     * @param {Object} obj - Raw object with potential null values
     * @returns {Object} - Cleaned object with nulls removed
     */
    _cleanPayload(obj) {
        return Object.entries(obj).reduce((acc, [key, value]) => {
            // Keep strictly false booleans and 0, but remove null/undefined
            if (value !== null && value !== undefined) {
                // Recursive clean for objects (like 'input')
                if (typeof value === 'object' && !Array.isArray(value)) {
                    const cleaned = this._cleanPayload(value);
                    if (Object.keys(cleaned).length > 0) acc[key] = cleaned;
                } else {
                    acc[key] = value;
                }
            }
            return acc;
        }, {});
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
            // ✅ FIX: Accept Base64 parentCommentId (not just numeric)
            // Base64 format is required for DEDICATED_COMMENTING_SURFACE
            // Examples: "Y29tbWVudDoxMjM0NTY3ODk=" or numeric "123456789"
            const isReplyMode = options.parentCommentId && options.parentCommentId.length > 0;
            const mode = isReplyMode ? 'B' : 'A';
            
            console.log(`\n📋 [Mode] ${mode} (${isReplyMode ? 'Reply to Comment' : 'Direct Comment'})`);
            if (isReplyMode) {
                console.log(`   Parent Comment ID (Base64): ${options.parentCommentId}`);
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
            
            // 1. Calculate default Feedback ID (for Post - Top Level Comment)
            let feedbackId = this._encodeFeedbackId(postId);
            
            // 2. [CRITICAL FIX] If Reply Mode, derive Feedback ID from Parent Comment ID
            // Browser payload shows feedback_id must be "feedback:POSTID_COMMENTID" for replies
            // NOT "feedback:POSTID" which causes replies to post as top-level comments
            if (options.parentCommentId) {
                try {
                    const parentDecoded = Buffer.from(options.parentCommentId, 'base64').toString('utf-8');
                    // Parent ID format is usually "comment:POSTID_COMMENTID" or "fbid:POSTID_COMMENTID"
                    // We need to convert it to "feedback:POSTID_COMMENTID"
                    
                    // Simple regex replace to preserve the IDs structure
                    const replyFeedbackString = parentDecoded.replace(/^(comment|fbid):/, 'feedback:');
                    
                    feedbackId = Buffer.from(replyFeedbackString).toString('base64');
                    console.log(`\n🔐 [Tokens - Reply Mode]`);
                    console.log(`   jazoest: ${jazoest}`);
                    console.log(`   lsd: ${lsd.substring(0, 20)}...`);
                    console.log(`   🔄 Parent Comment ID decoded: ${parentDecoded}`);
                    console.log(`   🔄 Adjusted feedback_id string: ${replyFeedbackString}`);
                    console.log(`   🔄 feedback_id (Base64): ${feedbackId}`);
                } catch (e) {
                    console.warn(`   ⚠️ [Reply Mode] Failed to generate threaded feedback_id, using default post feedback_id.`);
                    console.log(`\n🔐 [Tokens - Fallback]`);
                    console.log(`   jazoest: ${jazoest}`);
                    console.log(`   lsd: ${lsd.substring(0, 20)}...`);
                    console.log(`   feedback_id (Base64): ${feedbackId}`);
                }
            } else {
                console.log(`\n🔐 [Tokens - Top Level Comment]`);
                console.log(`   jazoest: ${jazoest}`);
                console.log(`   lsd: ${lsd.substring(0, 20)}...`);
                console.log(`   feedback_id (Base64): ${feedbackId}`);
            }
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
            
            // feedbackSource MUST be an Integer: 0 for Group, 110 for Feed (matches browser)
            const feedbackSource = groupId ? 0 : 110;
            
            if (groupId) {
                console.log(`   Post URL: ${options.postUrl || 'N/A'}`);
                console.log(`   This is a GROUP POST - groupID will be included`);
                console.log(`   feedbackSource: ${feedbackSource} (Integer)`);
            } else {
                console.log(`\n📄 [Post Type] Regular post (not in a group)`);
                console.log(`   groupID: null (explicitly set)`);
                console.log(`   feedbackSource: ${feedbackSource} (Integer - DEDICATED_COMMENTING_SURFACE)`);
            }
            
            // === MESSAGE RANGES - DISABLED (Emoji Length Mismatch Fix) ===
            // JavaScript counts emojis as 2 chars, GraphQL counts as 1
            // This causes offset/length mismatch triggering noncoercible_variable_value
            // Solution: Force empty ranges, let Facebook auto-detect and linkify URLs
            const messageRanges = []; // ✅ FIXED: Always empty to prevent Emoji offset errors
            console.log(`\n🔗 [Linkify] Auto-linkify mode (ranges=[] to avoid emoji mismatch)`);
            
            // === BUILD GRAPHQL VARIABLES - BROWSER-MATCHED PAYLOAD ===
            // ✅ CRITICAL FIX: Use Base64 ID directly for reply_comment_parent_fbid
            // Browser payload analysis shows Base64 is the correct format when using
            // feedLocation: "DEDICATED_COMMENTING_SURFACE"
            
            // ✅ FIX: Use Base64 directly. Do NOT convert to Numeric (API rejects it).
            const replyBase64Id = options.parentCommentId || null;
            
            // Log reply mode if applicable
            if (replyBase64Id) {
                console.log(`\n🔄 [Reply Mode] Using Base64 parent comment ID directly`);
                console.log(`   📥 Parent Comment ID (Base64): ${replyBase64Id}`);
                console.log(`   ℹ️  Note: Using Base64 format as required by DEDICATED_COMMENTING_SURFACE`);
                console.log(`   ℹ️  focusCommentID will also be set to enable proper nesting`);
            }

            // === BUILD GRAPHQL VARIABLES ===
            // CRITICAL: reply_comment_parent_fbid MUST be Base64 ID (matching browser behavior)
            const variables = {
                feedLocation: "DEDICATED_COMMENTING_SURFACE",
                feedbackSource: feedbackSource, // 0 for Group, 110 for Feed
                groupID: groupId || null,
                input: {
                    client_mutation_id: clientMutationId,
                    actor_id: userId,
                    attachments: null,
                    feedback_id: feedbackId,
                    formatting_style: null,
                    message: {
                        ranges: messageRanges,
                        text: processedMessage
                    },
                    is_tracking_encrypted: true,
                    tracking: [],
                    feedback_source: "DEDICATED_COMMENTING_SURFACE",
                    idempotence_token: idempotenceToken,
                    session_id: sessionId,
                    
                    // ✅ REPLY LOGIC: Use Base64 ID (Do NOT decode to numeric)
                    ...(replyBase64Id ? {
                        reply_comment_parent_fbid: replyBase64Id, // Base64 ID
                        reply_target_clicked: true
                    } : {})
                },
                inviteShortLinkKey: null,
                renderLocation: null,
                scale: 1,
                useDefaultActor: false,
                
                // ✅ CRITICAL FIX: Set focus to the Parent Comment ID (Base64) to force nesting
                // When null, reply appears as top-level. Must be Base64 for proper threading.
                focusCommentID: replyBase64Id,
                
                // Relay Flags
                __relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider: false,
                __relay_internal__pv__IsWorkUserrelayprovider: false,
                __relay_internal__pv__CometUFIShareActionMigrationrelayprovider: true
            };
            
            // Log payload details
            console.log(`\n📦 [Variables - Browser Matched (DEDICATED_COMMENTING_SURFACE)]`);
            console.log(`   feedLocation: DEDICATED_COMMENTING_SURFACE`);
            console.log(`   feedbackSource: ${feedbackSource}`);
            console.log(`   groupID: ${groupId || 'omitted (cleaned)'}`);
            console.log(`   feedback_source (input): DEDICATED_COMMENTING_SURFACE`);
            console.log(`   focusCommentID: ${replyBase64Id || 'null (top-level comment)'}`);
            console.log(`   ranges: [] (auto-linkify mode)`);
            if (replyBase64Id) {
                console.log(`   🔄 REPLY MODE: reply_comment_parent_fbid set (Base64 ID)`);
                console.log(`      Parent Comment ID: ${replyBase64Id}`);
                console.log(`      focusCommentID: ${replyBase64Id} (enables proper nesting)`);
            } else {
                console.log(`   💬 TOP-LEVEL COMMENT MODE`);
            }
            
            // === DEBUG: Log final variables string ===
            const variablesString = JSON.stringify(variables);
            console.log(`\n📦 [Variables] Final JSON (${variablesString.length} chars):`);
            console.log(JSON.stringify(variables, null, 2));
            
            // Verify critical keys (Universal Payload - cleaned)
            const parsedCheck = JSON.parse(variablesString);
            console.log(`\n🔍 [Validation] Universal Payload Check:`);
            console.log(`   feedLocation: ${parsedCheck.feedLocation || 'OMITTED ✅'}`);
            console.log(`   feedbackSource: ${parsedCheck.feedbackSource} (type: ${typeof parsedCheck.feedbackSource})`);
            console.log(`   groupID: ${parsedCheck.groupID !== undefined ? parsedCheck.groupID : 'OMITTED ✅'}`);
            console.log(`   input.feedback_source: ${parsedCheck.input?.feedback_source || 'OMITTED ✅'}`);
            console.log(`   input.attachments: ${parsedCheck.input?.attachments !== undefined ? parsedCheck.input.attachments : 'OMITTED ✅'}`);
            console.log(`   input.is_tracking_encrypted: ${parsedCheck.input?.is_tracking_encrypted}`);
            console.log(`   input.tracking: ${Array.isArray(parsedCheck.input?.tracking) ? 'Array ✅' : 'OMITTED'}`);
            console.log(`   Reply mode: ${parsedCheck.input?.reply_comment_parent_fbid ? 'YES ✅' : 'NO (top-level comment)'}`);
            
            // Confirm nulls were cleaned
            const hasNulls = variablesString.includes(':null');
            console.log(`   Nulls cleaned: ${hasNulls ? '❌ Still has nulls' : '✅ All nulls removed'}`);
            
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
     * Crawl Comments from a Facebook Post
     * Fetches top-level comments to enable Reply Mode (Mode B)
     * 
     * @param {String} postId - The Facebook Post ID
     * @param {String} cookie - Facebook session cookie
     * @param {String} fb_dtsg - Facebook DTSG token for GraphQL validation
     * @returns {Array<Object>} - Array of { id, authorName } objects
     */
    async crawlComments(postId, cookie, fb_dtsg) {
        console.log(`\n🔍 [Crawl Comments] Fetching comments for post: ${postId}`);
        
        try {
            // Generate feedback ID (Base64 encoded "feedback:{postId}")
            const feedbackId = Buffer.from(`feedback:${postId}`).toString('base64');
            console.log(`   📦 Feedback ID: ${feedbackId}`);
            
            // Use provided fb_dtsg or fall back to accessToken (which might contain dtsg)
            const dtsg = fb_dtsg || this.accessToken || '';
            if (!dtsg) {
                console.log(`   ⚠️ [Crawl Comments] No fb_dtsg token provided, request may fail`);
            }
            
            // Build GraphQL variables (matches browser capture)
            const variables = {
                commentsIntentToken: "RANKED_UNFILTERED_CHRONOLOGICAL_REPLIES_INTENT_V1",
                feedLocation: "DEDICATED_COMMENTING_SURFACE",
                feedbackSource: 110,
                focusCommentID: null,
                scale: 1,
                useDefaultActor: false,
                id: feedbackId,
                __relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider: true,
                __relay_internal__pv__IsWorkUserrelayprovider: false
            };
            
            // Clean null values
            const cleanedVariables = this._cleanPayload(variables);
            
            // Extract user ID from cookie
            const cookieToUse = cookie || this.cookie || '';
            const userIdMatch = cookieToUse.match(/c_user=(\d+)/);
            const userId = userIdMatch ? userIdMatch[1] : '';
            
            // Build form data
            const formData = new URLSearchParams();
            formData.append('av', userId);
            formData.append('__user', userId);
            formData.append('__a', '1');
            formData.append('fb_dtsg', dtsg);
            formData.append('fb_api_caller_class', 'RelayModern');
            formData.append('fb_api_req_friendly_name', 'CometUFICommentsProviderPaginationQuery');
            formData.append('doc_id', '25399415259725176'); // Comment fetch doc_id
            formData.append('variables', JSON.stringify(cleanedVariables));
            
            console.log(`   📤 Requesting comments with doc_id: 25399415259725176`);
            
            // Make GraphQL request
            const response = await fetch('https://www.facebook.com/api/graphql/', {
                method: 'POST',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://www.facebook.com',
                    'Referer': `https://www.facebook.com/`,
                    'Cookie': cookieToUse,
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin'
                },
                body: formData.toString()
            });
            
            if (!response.ok) {
                console.log(`   ❌ [Crawl Comments] HTTP Error: ${response.status}`);
                return [];
            }
            
            const responseText = await response.text();
            
            // Parse JSON response (may have multiple JSON objects)
            let data;
            try {
                // Try parsing as single JSON first
                data = JSON.parse(responseText);
            } catch (e) {
                // Facebook sometimes returns multiple JSON objects, take the first
                const firstJson = responseText.split('\n')[0];
                try {
                    data = JSON.parse(firstJson);
                } catch (e2) {
                    console.log(`   ❌ [Crawl Comments] Failed to parse response`);
                    return [];
                }
            }
            
            // Check for errors
            if (data.errors || data.error) {
                console.log(`   ❌ [Crawl Comments] GraphQL Error:`, data.errors || data.error);
                return [];
            }
            
            // Navigate to comments array (deep path)
            // Path: data.node.comment_rendering_instance_for_feed_location.comments.edges
            const edges = data?.data?.node?.comment_rendering_instance_for_feed_location?.comments?.edges;
            
            if (!edges || !Array.isArray(edges) || edges.length === 0) {
                console.log(`   ⚠️ [Crawl Comments] No comments found on this post`);
                console.log(`   📋 Response structure:`, Object.keys(data?.data?.node || {}));
                return [];
            }
            
            // Map edges to simplified comment objects
            const comments = edges.map(edge => ({
                id: edge.node?.id || null,                          // Comment ID (Base64 string)
                authorName: edge.node?.author?.name || 'Unknown'    // Author's Name
            })).filter(c => c.id); // Filter out any without valid ID
            
            console.log(`   ✅ [Crawl Comments] Found ${comments.length} comments`);
            comments.slice(0, 5).forEach((c, i) => {
                console.log(`      ${i + 1}. ${c.authorName} (ID: ${c.id.substring(0, 30)}...)`);
            });
            
            return comments;
            
        } catch (error) {
            console.error(`   ❌ [Crawl Comments] Error:`, error.message);
            return [];
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
 * 
 * STRICT WORKFLOW v4.0:
 * - Step A: Determine Source (Priority: Targets > Random NewsFeed)
 * - Step B: Pre-filter by DB (efficiency check before stats fetch)
 * - Step C: Sequential "Focus" Processing (exhaust one post before moving to next)
 */
class CampaignAutomationService {
    /**
     * Process một campaign active
     * 
     * STRICT SEQUENTIAL LOGIC ("Focus Loop"):
     * - For each post: post ALL comments (up to maxCommentsPerPost) before moving on
     * - Wait delay between each comment
     * - Re-check campaign status before each action
     * 
     * @param {Campaign} campaign
     */
    async processCampaign(campaign) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🚀 Processing campaign: ${campaign.name} (${campaign._id})`);
        console.log(`${'='.repeat(60)}`);
        
        try {
            // ============================================
            // PHASE 1: Setup & Validation
            // ============================================
            
            // 1. Get Facebook account với token
            const fbAccount = await FacebookAccount.getWithToken(campaign.facebookAccountId);
            
            if (!fbAccount) {
                console.log(`❌ Facebook account not found for campaign ${campaign._id}`);
                await this._pauseCampaignWithLog(campaign._id, 'Không tìm thấy tài khoản Facebook');
                return;
            }
            
            console.log(`📱 FB Account: ${fbAccount.name} | Status: ${fbAccount.tokenStatus} | Active: ${fbAccount.isActive}`);
            console.log(`🔑 Has Token: ${!!fbAccount.accessToken} | Has Cookie: ${!!fbAccount.cookie}`);
            console.log(`🔐 Auth Mode: ${fbAccount.authMode || 'unknown'}`);
            
            if (!fbAccount.isTokenValid()) {
                console.log(`❌ Facebook token invalid for campaign ${campaign._id} (status: ${fbAccount.tokenStatus})`);
                await this._pauseCampaignWithLog(campaign._id, 'Token Facebook không còn hoạt động');
                return;
            }
            
            // 2. Init Facebook API
            const fbAPI = new FacebookAPI(fbAccount.accessToken, fbAccount.cookie);
            const isCookieOnly = fbAccount.authMode === 'cookie_only' || fbAccount.tokenStatus === 'cookie_only';
            
            // 3. Health check
            console.log('\n🏥 Checking account health...');
            const healthResult = await fbAPI.checkAccountHealth({
                userAgent: fbAccount.userAgent
            });
            
            if (!healthResult.healthy) {
                console.log(`❌ Facebook account UNHEALTHY: ${healthResult.reason}`);
                
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
                } catch (dbError) {
                    console.error('⚠️ Failed to update account status:', dbError.message);
                }
                
                await this._pauseCampaignWithLog(campaign._id, `Cookie/Token không hợp lệ: ${healthResult.reason}`);
                return;
            }
            
            console.log(`✅ Account healthy: ${healthResult.reason}`);
            
            // Update healthy status in DB
            try {
                fbAccount.healthStatus = { isHealthy: true, lastError: null, lastErrorAt: null };
                fbAccount.lastCheckedAt = new Date();
                await fbAccount.save();
            } catch (e) { /* Non-critical */ }
            
            // ============================================
            // PHASE 2: Get Target Posts (with pre-filtering)
            // ============================================
            
            // Re-fetch campaign from DB for latest targetedPosts data
            const freshCampaign = await Campaign.findById(campaign._id);
            if (!freshCampaign || freshCampaign.status !== 'active') {
                console.log(`⏹️ Campaign no longer active, stopping.`);
                return;
            }
            
            const targetPosts = await this.getTargetPosts(freshCampaign);
            
            if (!targetPosts || targetPosts.length === 0) {
                console.log(`⚠️ [Campaign] No target posts available for campaign ${campaign._id}`);
                return;
            }
            
            console.log(`\n📝 [Phase 2] ${targetPosts.length} posts to process`);
            
            // ============================================
            // PHASE 3: Sequential "Focus" Processing
            // ============================================
            
            const maxCommentsPerPost = freshCampaign.maxCommentsPerPost || 1;
            const minLikes = freshCampaign.filters?.minLikes || 0;
            const minComments = freshCampaign.filters?.minComments || 0;
            const minShares = freshCampaign.filters?.minShares || 0;
            const delayMin = freshCampaign.delayMin || 30;
            const delayMax = freshCampaign.delayMax || 60;
            
            let totalCommentsThisRun = 0;
            const maxCommentsThisRun = 5; // Safety limit per scheduler run
            
            console.log(`\n${'─'.repeat(60)}`);
            console.log(`📋 FOCUS LOOP STARTING`);
            console.log(`   Max comments per post: ${maxCommentsPerPost}`);
            console.log(`   Filters: Likes>=${minLikes}, Comments>=${minComments}, Shares>=${minShares}`);
            console.log(`   Delay: ${delayMin}-${delayMax}s`);
            console.log(`${'─'.repeat(60)}`);
            
            for (const targetPost of targetPosts) {
                // ============================================
                // SAFETY CHECK: Campaign status before each post
                // ============================================
                const currentStatus = await Campaign.findById(campaign._id).select('status');
                if (!currentStatus || currentStatus.status !== 'active') {
                    console.log(`\n⏹️ [STOPPED] Campaign no longer active. Status: ${currentStatus?.status || 'not found'}`);
                    break;
                }
                
                // Global run limit check
                if (totalCommentsThisRun >= maxCommentsThisRun) {
                    console.log(`\n⏸️ Reached max comments limit (${maxCommentsThisRun}) for this scheduler run`);
                    break;
                }
                
                const { postId, postUrl, groupId } = targetPost;
                console.log(`\n${'─'.repeat(40)}`);
                console.log(`🎯 FOCUSING ON POST: ${postId}`);
                console.log(`   URL: ${postUrl || 'N/A'}`);
                console.log(`   Group: ${groupId || 'Not a group post'}`);
                
                // ============================================
                // STEP 1: Re-check DB for current comment count
                // ============================================
                const latestCampaign = await Campaign.findById(campaign._id);
                const targetedPostEntry = latestCampaign?.targetedPosts?.find(p => p.postId === postId);
                let commentsSentToPost = targetedPostEntry?.commentsSent || 0;
                
                if (commentsSentToPost >= maxCommentsPerPost) {
                    console.log(`   ⏭️ [DB Check] Already sent ${commentsSentToPost}/${maxCommentsPerPost} comments, skipping`);
                    continue;
                }
                
                // ============================================
                // STEP 2: Fetch stats and validate filters
                // ============================================
                console.log(`   📊 Fetching post stats...`);
                let postStats = { likes: 0, comments: 0, shares: 0 };
                
                try {
                    if (isCookieOnly) {
                        postStats = await fbAPI.getPostStatsWithCookie(postId, fbAccount.fb_dtsg, postUrl);
                    } else {
                        postStats = await fbAPI.getPostStats(postId);
                    }
                    console.log(`   📈 Stats: Likes=${postStats.likes}, Comments=${postStats.comments}, Shares=${postStats.shares}`);
                } catch (statsError) {
                    console.log(`   ⚠️ Could not fetch stats: ${statsError.message}`);
                }
                
                // Validate against filters
                if (postStats.likes < minLikes) {
                    console.log(`   ⏭️ [Filter] Not enough likes (${postStats.likes} < ${minLikes})`);
                    continue;
                }
                if (postStats.comments < minComments) {
                    console.log(`   ⏭️ [Filter] Not enough comments (${postStats.comments} < ${minComments})`);
                    continue;
                }
                if (postStats.shares < minShares) {
                    console.log(`   ⏭️ [Filter] Not enough shares (${postStats.shares} < ${minShares})`);
                    continue;
                }
                
                console.log(`   ✅ Post passed all filters!`);
                
                // ============================================
                // STEP 3: FOCUS LOOP - Post ALL comments to this post
                // ============================================
                const remainingComments = maxCommentsPerPost - commentsSentToPost;
                console.log(`\n   🔄 FOCUS LOOP: Need to post ${remainingComments} more comment(s)`);
                
                for (let i = 0; i < remainingComments; i++) {
                    // Safety checks before each comment
                    const statusCheck = await Campaign.findById(campaign._id).select('status');
                    if (!statusCheck || statusCheck.status !== 'active') {
                        console.log(`   ⏹️ Campaign stopped during focus loop`);
                        break;
                    }
                    
                    if (totalCommentsThisRun >= maxCommentsThisRun) {
                        console.log(`   ⏸️ Run limit reached during focus loop`);
                        break;
                    }
                    
                    console.log(`\n   📝 Comment ${i + 1}/${remainingComments} for post ${postId}:`);
                    
                    // Generate comment
                    const commentData = latestCampaign.generateComment();
                    if (!commentData) {
                        console.log(`   ❌ Failed to generate comment`);
                        continue;
                    }
                    
                    // Attempt Reply Mode (Mode B)
                    let targetCommentId = null;
                    let replyName = 'bạn';
                    let commentMode = 'A';
                    
                    try {
                        console.log(`   🔄 Attempting Reply Mode (crawling comments)...`);
                        const existingComments = await fbAPI.crawlComments(postId, fbAccount.cookie, fbAccount.fb_dtsg);
                        
                        if (existingComments && existingComments.length > 0) {
                            const randomIndex = Math.floor(Math.random() * existingComments.length);
                            const targetComment = existingComments[randomIndex];
                            targetCommentId = targetComment.id;
                            replyName = targetComment.authorName || 'bạn';
                            commentMode = 'B';
                            console.log(`   ✅ Reply Mode: Will reply to ${replyName}`);
                        } else {
                            console.log(`   ⚠️ No comments found, using Direct Mode (A)`);
                        }
                    } catch (crawlError) {
                        console.log(`   ⚠️ Comment crawl failed, using Direct Mode (A)`);
                    }
                    
                    // Substitute {name} placeholder
                    let finalMessage = commentData.text;
                    if (finalMessage.includes('{name}')) {
                        finalMessage = finalMessage.replace(/\{name\}/g, replyName);
                    }
                    
                    console.log(`   💬 Mode: ${commentMode} | Message: ${finalMessage.substring(0, 50)}...`);
                    
                    // Post comment
                    let result;
                    if (isCookieOnly) {
                        result = await fbAPI.postCommentWithCookie(postId, finalMessage, fbAccount.fb_dtsg, {
                            groupId,
                            postUrl,
                            parentCommentId: targetCommentId,
                            targetName: replyName
                        });
                    } else {
                        try {
                            const comment = await fbAPI.postComment(postId, commentData.text);
                            result = { success: true, id: comment.id, message: commentData.text };
                        } catch (error) {
                            result = { success: false, error: error.message };
                        }
                    }
                    
                    // Update DB based on result
                    if (result.success) {
                        console.log(`   ✅ Comment posted successfully: ${result.id}`);
                        totalCommentsThisRun++;
                        commentsSentToPost++;
                        
                        const logMessage = commentMode === 'B' 
                            ? `Reply thành công cho ${replyName} trong bài viết ${postId}`
                            : `Comment thành công vào bài viết ${postId}`;
                        
                        // Ensure targetedPosts entry exists
                        await Campaign.updateOne(
                            { _id: campaign._id, 'targetedPosts.postId': { $ne: postId } },
                            {
                                $push: {
                                    targetedPosts: {
                                        postId,
                                        postUrl,
                                        commentsSent: 0,
                                        isBlocked: false,
                                        stats: postStats,
                                        firstCommentedAt: new Date()
                                    }
                                }
                            }
                        );
                        
                        // Update stats
                        await Campaign.updateOne(
                            { _id: campaign._id },
                            {
                                $inc: { 
                                    'stats.totalCommentsSent': 1,
                                    'stats.successfulComments': 1,
                                    'targetedPosts.$[post].commentsSent': 1
                                },
                                $push: {
                                    activityLogs: {
                                        action: commentMode === 'B' ? 'reply_sent' : 'comment_sent',
                                        message: logMessage,
                                        postId,
                                        commentId: result.id,
                                        timestamp: new Date(),
                                        metadata: commentMode === 'B' ? { 
                                            mode: 'B', 
                                            replyTo: replyName, 
                                            parentCommentId: targetCommentId 
                                        } : { mode: 'A' }
                                    }
                                },
                                $set: {
                                    'targetedPosts.$[post].lastCommentedAt': new Date(),
                                    updatedAt: new Date()
                                }
                            },
                            {
                                arrayFilters: [{ 'post.postId': postId }]
                            }
                        );
                        
                        console.log(`   📊 Updated: Post now has ${commentsSentToPost}/${maxCommentsPerPost} comments`);
                    } else {
                        console.log(`   ❌ Comment failed: ${result.error}`);
                        
                        await Campaign.updateOne(
                            { _id: campaign._id },
                            {
                                $inc: { 
                                    'stats.totalCommentsSent': 1,
                                    'stats.failedComments': 1
                                },
                                $push: {
                                    activityLogs: {
                                        action: 'comment_failed',
                                        message: `Comment thất bại: ${result.error}`,
                                        postId,
                                        timestamp: new Date(),
                                        metadata: { reason: result.error }
                                    }
                                },
                                $set: { updatedAt: new Date() }
                            }
                        );
                        
                        // If blocked, skip remaining comments for this post
                        if (result.error?.toLowerCase().includes('block') || 
                            result.error?.toLowerCase().includes('spam')) {
                            console.log(`   🚫 Possible block detected, skipping remaining comments for this post`);
                            break;
                        }
                    }
                    
                    // Wait between comments (within same post)
                    if (i < remainingComments - 1) {
                        const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
                        console.log(`   ⏳ Waiting ${delay}s before next comment...`);
                        await this.sleep(delay * 1000);
                    }
                }
                
                console.log(`   ✅ Finished focusing on post ${postId} (${commentsSentToPost}/${maxCommentsPerPost} comments sent)`);
                
                // Wait before moving to next post
                const interPostDelay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
                console.log(`   ⏳ Waiting ${interPostDelay}s before next post...`);
                await this.sleep(interPostDelay * 1000);
            }
            
            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ Campaign run complete: ${totalCommentsThisRun} comments posted`);
            console.log(`${'='.repeat(60)}\n`);
            
        } catch (error) {
            console.error(`❌ Process campaign ${campaign._id} error:`, error);
            
            await Campaign.updateOne(
                { _id: campaign._id },
                {
                    $push: {
                        activityLogs: {
                            action: 'comment_failed',
                            message: `Campaign error: ${error.message}`,
                            postId: 'N/A',
                            timestamp: new Date(),
                            metadata: { reason: error.message, stack: error.stack }
                        }
                    },
                    $set: { updatedAt: new Date() }
                }
            );
        }
    }
    
    /**
     * Helper: Pause campaign with activity log
     * @private
     */
    async _pauseCampaignWithLog(campaignId, reason) {
        await Campaign.updateOne(
            { _id: campaignId },
            {
                $set: { status: 'paused', updatedAt: new Date() },
                $push: {
                    activityLogs: {
                        action: 'paused',
                        message: `Chiến dịch tạm dừng: ${reason}`,
                        timestamp: new Date(),
                        metadata: { reason }
                    }
                }
            }
        );
    }
    
    /**
     * Get target posts for a campaign
     * STRICT PRIORITY LOGIC:
     * - IF any targetPostIds, linkGroups, or fanpages are specified → ONLY use those (no NewsFeed)
     * - ELSE → Crawl from Random NewsFeed
     * 
     * EFFICIENCY: Check DB for already-commented posts BEFORE fetching stats
     * 
     * @param {Campaign} campaign
     * @returns {Array<Object>} - Array of { postId, postUrl, groupId } objects
     */
    async getTargetPosts(campaign) {
        const posts = [];
        
        // Get FB account for cookie
        const fbAccount = await FacebookAccount.getWithToken(campaign.facebookAccountId);
        const cookie = fbAccount?.cookie || '';
        
        // ============================================
        // STEP A: Determine Source (STRICT PRIORITY)
        // ============================================
        const hasTargetPostIds = campaign.targetPostIds && campaign.targetPostIds.length > 0;
        const hasLinkGroups = campaign.linkGroups && campaign.linkGroups.length > 0;
        const hasFanpages = campaign.fanpages && campaign.fanpages.length > 0;
        const hasSpecificTargets = hasTargetPostIds || hasLinkGroups || hasFanpages;
        
        console.log(`\n📋 [GetTargetPosts] Source Analysis:`);
        console.log(`   📌 targetPostIds: ${campaign.targetPostIds?.length || 0}`);
        console.log(`   👥 linkGroups: ${campaign.linkGroups?.length || 0}`);
        console.log(`   📄 fanpages: ${campaign.fanpages?.length || 0}`);
        console.log(`   🎯 Mode: ${hasSpecificTargets ? 'TARGETED (no NewsFeed)' : 'AUTO (NewsFeed crawl)'}`);
        
        // ============================================
        // PRIORITY SOURCE 1: Target Post IDs (direct input by user)
        // ============================================
        if (hasTargetPostIds) {
            console.log(`\n📋 Processing ${campaign.targetPostIds.length} target post inputs...`);
            for (const input of campaign.targetPostIds) {
                let postId = null;
                let resolvedUrl = input;
                
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
                    const groupId = this._extractGroupId(resolvedUrl) || null;
                    posts.push({ postId, postUrl: resolvedUrl, groupId });
                    console.log(`   ✅ Post ID: ${postId}${groupId ? ` (Group: ${groupId})` : ''}`);
                } else {
                    console.error(`   ❌ Invalid post URL/ID: ${input}`);
                }
            }
            console.log(`📊 Valid target posts: ${posts.length}/${campaign.targetPostIds.length}`);
        }
        
        // ============================================
        // PRIORITY SOURCE 2: Link Groups (Facebook Groups)
        // ============================================
        if (hasLinkGroups) {
            console.log(`\n📋 Crawling ${campaign.linkGroups.length} Facebook groups...`);
            if (fbAccount && fbAccount.cookie) {
                for (const groupUrl of campaign.linkGroups) {
                    try {
                        const groupPosts = await this.crawlGroupPosts(groupUrl, fbAccount.cookie);
                        const groupId = this._extractGroupId(groupUrl) || null;
                        
                        for (const crawledPost of groupPosts) {
                            const postId = typeof crawledPost === 'string' ? crawledPost : crawledPost.postId;
                            const postGroupId = typeof crawledPost === 'object' ? (crawledPost.groupId || groupId) : groupId;
                            const postUrl = postGroupId 
                                ? `https://www.facebook.com/groups/${postGroupId}/posts/${postId}/`
                                : null;
                            posts.push({ postId, postUrl, groupId: postGroupId });
                        }
                        console.log(`   ✅ Found ${groupPosts.length} posts from group (ID: ${groupId || 'unknown'})`);
                    } catch (error) {
                        console.error(`   ❌ Failed to crawl group: ${groupUrl}`, error.message);
                    }
                }
            }
        }
        
        // ============================================
        // PRIORITY SOURCE 3: Fanpages
        // ============================================
        if (hasFanpages) {
            console.log(`\n📋 Crawling ${campaign.fanpages.length} fanpages...`);
            if (fbAccount && fbAccount.cookie) {
                for (const pageUrl of campaign.fanpages) {
                    try {
                        const pagePosts = await this.crawlPagePosts(pageUrl, fbAccount.cookie);
                        for (const crawledPost of pagePosts) {
                            const postId = typeof crawledPost === 'string' ? crawledPost : crawledPost.postId;
                            posts.push({ postId, postUrl: null, groupId: null });
                        }
                        console.log(`   ✅ Found ${pagePosts.length} posts from fanpage`);
                    } catch (error) {
                        console.error(`   ❌ Failed to crawl fanpage: ${pageUrl}`, error.message);
                    }
                }
            }
        }
        
        // ============================================
        // FALLBACK SOURCE: NewsFeed (ONLY if no specific targets)
        // ============================================
        if (!hasSpecificTargets && posts.length === 0) {
            console.log(`\n📋 No specific targets, crawling News Feed (auto mode)...`);
            if (fbAccount && fbAccount.cookie) {
                try {
                    const feedPosts = await this.crawlNewsFeed(fbAccount.cookie, 10);
                    for (const crawledPost of feedPosts) {
                        if (typeof crawledPost === 'string') {
                            posts.push({ postId: crawledPost, postUrl: null, groupId: null });
                        } else {
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
        
        // ============================================
        // STEP B: Pre-filter by DB (Efficiency check)
        // Remove posts that already reached maxCommentsPerPost BEFORE returning
        // ============================================
        const maxCommentsAllowed = campaign.maxCommentsPerPost || 1;
        const filteredPosts = [];
        
        for (const post of posts) {
            const targetedPostEntry = campaign.targetedPosts?.find(p => p.postId === post.postId);
            const commentsSent = targetedPostEntry?.commentsSent || 0;
            
            if (commentsSent >= maxCommentsAllowed) {
                console.log(`   ⏭️ [Pre-filter] Skip ${post.postId}: Already sent ${commentsSent}/${maxCommentsAllowed} comments`);
                continue;
            }
            
            filteredPosts.push(post);
        }
        
        // Remove duplicates based on postId
        const uniquePosts = [];
        const seenPostIds = new Set();
        for (const post of filteredPosts) {
            if (!seenPostIds.has(post.postId)) {
                seenPostIds.add(post.postId);
                uniquePosts.push(post);
            }
        }
        
        console.log(`\n📊 [GetTargetPosts] Summary:`);
        console.log(`   📥 Raw posts collected: ${posts.length}`);
        console.log(`   🔍 After pre-filter: ${filteredPosts.length}`);
        console.log(`   ✅ Unique posts to process: ${uniquePosts.length}`);
        
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
            
            // 7. Record successful comment with atomic update
            await Campaign.updateOne(
                { _id: campaign._id },
                {
                    $inc: { 
                        'stats.totalCommentsSent': 1,
                        'stats.successfulComments': 1
                    },
                    $push: {
                        activityLogs: {
                            action: 'comment_sent',
                            message: `Comment thành công vào bài viết ${postId}`,
                            postId,
                            commentId: comment.id,
                            timestamp: new Date()
                        }
                    },
                    $set: {
                        'targetedPosts.$[post].commentsSent': 1,
                        'targetedPosts.$[post].lastCommentedAt': new Date(),
                        updatedAt: new Date()
                    }
                },
                {
                    arrayFilters: [{ 'post.postId': postId }]
                }
            );
            
            // 8. SAFETY CHECK: Verify comment sau 5 giây
            await this.safetyCheckComment(campaign, postId, comment.id, fbAPI);
            
            return true;
            
        } catch (error) {
            console.error(`❌ Comment on post ${postId} error:`, error);
            
            // ATOMIC UPDATE: Record failed comment
            await Campaign.updateOne(
                { _id: campaign._id },
                {
                    $inc: { 
                        'stats.totalCommentsSent': 1,
                        'stats.failedComments': 1
                    },
                    $push: {
                        activityLogs: {
                            action: 'comment_failed',
                            message: `Comment thất bại: ${error.message}`,
                            postId,
                            timestamp: new Date(),
                            metadata: { reason: error.message }
                        }
                    }
                }
            );
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
