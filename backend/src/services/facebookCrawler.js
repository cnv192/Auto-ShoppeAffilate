const axios = require('axios');

// Giả lập Headers Mobile để vào mbasic
const getHeaders = (cookie) => ({
    'authority': 'mbasic.facebook.com',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
    'cache-control': 'max-age=0',
    'cookie': cookie,
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?1',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
});

/**
 * Cào danh sách Page từ mbasic.facebook.com
 */
async function fetchPagesViaCookie(cookie) {
    console.log('🔍 [Crawler] Bắt đầu quét Fanpage từ Cookie...');
    
    try {
        // 1. Gọi vào trang danh sách Page của mbasic
        const response = await axios.get('https://mbasic.facebook.com/pages/?owned', {
            headers: getHeaders(cookie),
            maxRedirects: 5
        });

        const html = response.data;
        
        // Debug: Kiểm tra xem có bị đá về Login không
        if (html.includes('login_form') || html.includes('Đăng nhập')) {
            console.error('❌ [Crawler] Cookie chết hoặc bị redirect về trang login!');
            return [];
        }

        console.log(`📄 [Crawler] Đã tải HTML (${html.length} bytes). Đang phân tích...`);

        const pages = [];
        const uniqueIds = new Set();

        // --- CÁCH 1: Tìm qua link "page_id=" (Thường thấy ở nút Insights/Edit) ---
        // Pattern: /pages/insights/?page_id=123456789
        const regexId = /[?&]page_id=(\d+)/g;
        let match;
        
        // Chúng ta sẽ quét qua từng dòng HTML chứa link để chính xác hơn
        const links = html.match(/<a[^>]+href="[^"]+"[^>]*>.*?<\/a>/g) || [];
        
        console.log(`🔎 [Crawler] Tìm thấy ${links.length} thẻ <a> trong HTML`);

        for (const linkHtml of links) {
            // Thử tìm ID trong link
            const idMatch = linkHtml.match(/[?&]page_id=(\d+)/);
            
            if (idMatch) {
                const pageId = idMatch[1];
                
                // Bỏ qua nếu đã lấy rồi
                if (uniqueIds.has(pageId)) continue;

                // Cố gắng trích xuất tên Page từ text bên trong thẻ a (hoặc thẻ a ngay trước đó)
                // Đây là heuristic: Link chứa page_id thường là nút phụ, tên page nằm ở link chính
                // Tuy nhiên, để đơn giản, ta cứ lưu ID trước.
                
                // Mẹo: Trên mbasic, cấu trúc thường là:
                // <img src="..."> <span>Tên Page</span> ... <a href="...page_id=...">Insights</a>
                
                pages.push({
                    pageId: pageId,
                    name: `Page ${pageId}`, // Tên tạm, sẽ update sau nếu tìm thấy
                    category: 'Fanpage',
                    picture: `https://graph.facebook.com/${pageId}/picture?type=square`
                });
                uniqueIds.add(pageId);
            }
        }

        // --- CÁCH 2: Regex vét cạn (Backup) ---
        // Tìm các link dạng /Name-Page-123456789?refid=...
        const regexV2 = /href="\/([^\/"]+)-(\d+)\?refid=17"/g;
        let matchV2;
        while ((matchV2 = regexV2.exec(html)) !== null) {
            const pageId = matchV2[2];
            const rawName = matchV2[1];
            
            if (!uniqueIds.has(pageId)) {
                // Decode tên page (VD: Shop-Quan-Ao -> Shop Quan Ao)
                const name = rawName.replace(/-/g, ' ');
                
                pages.push({
                    pageId: pageId,
                    name: name,
                    category: 'Fanpage',
                    picture: `https://graph.facebook.com/${pageId}/picture?type=square`
                });
                uniqueIds.add(pageId);
            }
        }

        console.log(`✅ [Crawler] Kết quả: Tìm thấy ${pages.length} Fanpage.`);
        if (pages.length > 0) {
            console.log('📋 Danh sách ID:', pages.map(p => p.pageId).join(', '));
        } else {
            console.log('⚠️ [Crawler] Không tìm thấy page nào. Có thể do Regex lỗi hoặc User không có Page.');
            // Uncomment dòng dưới để debug HTML nếu cần
            // console.log(html); 
        }

        return pages;

    } catch (error) {
        console.error('❌ [Crawler] Lỗi request:', error.message);
        return [];
    }
}

module.exports = { fetchPagesViaCookie };

/**
 * Advanced Facebook URL Resolver
 * Handles nested redirects, meta-refresh, and JavaScript redirects
 */
class FacebookUrlResolver {
    constructor(cookie = '') {
        this.cookie = cookie;
        this.maxRedirects = 10;
        this.timeout = 15000;
    }
    
    /**
     * Resolve any Facebook URL to its final destination with post ID
     * @param {String} url - Input URL (share/p/, short links, etc.)
     * @returns {Promise<Object>} - { success, finalUrl, postId, resolveChain }
     */
    async resolveFacebookUrl(url) {
        console.log(`🔗 [URL Resolver] Starting resolution for: ${url}`);
        
        const resolveChain = [];
        let currentUrl = url;
        let iteration = 0;
        
        try {
            while (iteration < this.maxRedirects) {
                iteration++;
                resolveChain.push({ step: iteration, url: currentUrl, type: 'start' });
                
                console.log(`   📍 Step ${iteration}: ${currentUrl}`);
                
                // Step A: Try HTTP redirect first
                const httpResult = await this._resolveHttpRedirect(currentUrl);
                
                if (httpResult.redirected && httpResult.finalUrl !== currentUrl) {
                    currentUrl = httpResult.finalUrl;
                    resolveChain.push({ step: iteration, url: currentUrl, type: 'http_redirect' });
                    console.log(`   ➡️  HTTP Redirect to: ${currentUrl}`);
                    
                    // Try extracting post ID from new URL
                    const postId = this._extractPostIdFromUrl(currentUrl);
                    if (postId) {
                        console.log(`   ✅ Found Post ID from HTTP redirect: ${postId}`);
                        return {
                            success: true,
                            finalUrl: currentUrl,
                            postId,
                            resolveChain,
                            method: 'http_redirect'
                        };
                    }
                    continue;
                }
                
                // Get HTML for deeper inspection
                const html = httpResult.html;
                
                // Step B: Check for Meta-Refresh tag
                const metaResult = this._extractMetaRefresh(html);
                if (metaResult.found) {
                    currentUrl = this._resolveRelativeUrl(currentUrl, metaResult.url);
                    resolveChain.push({ step: iteration, url: currentUrl, type: 'meta_refresh' });
                    console.log(`   ➡️  Meta-Refresh to: ${currentUrl}`);
                    continue;
                }
                
                // Step C: Check for JavaScript redirect (window.location)
                const jsResult = this._extractJsRedirect(html);
                if (jsResult.found) {
                    currentUrl = this._resolveRelativeUrl(currentUrl, jsResult.url);
                    resolveChain.push({ step: iteration, url: currentUrl, type: 'js_redirect' });
                    console.log(`   ➡️  JS Redirect to: ${currentUrl}`);
                    continue;
                }
                
                // Step D: Try extracting post ID from HTML content
                const postIdFromHtml = this._extractPostIdFromHtml(html);
                if (postIdFromHtml) {
                    console.log(`   ✅ Found Post ID from HTML: ${postIdFromHtml}`);
                    return {
                        success: true,
                        finalUrl: currentUrl,
                        postId: postIdFromHtml,
                        resolveChain,
                        method: 'html_extraction'
                    };
                }
                
                // Step E: Check for JSON data in page (React/Relay data)
                const jsonPostId = this._extractPostIdFromJson(html);
                if (jsonPostId) {
                    console.log(`   ✅ Found Post ID from JSON data: ${jsonPostId}`);
                    return {
                        success: true,
                        finalUrl: currentUrl,
                        postId: jsonPostId,
                        resolveChain,
                        method: 'json_extraction'
                    };
                }
                
                // No more redirects found, exit loop
                break;
            }
            
            // Final attempt: Try mbasic version
            console.log(`   🔄 Trying mbasic.facebook.com fallback...`);
            const mbasicResult = await this._tryMbasicFallback(url);
            if (mbasicResult.success) {
                return {
                    ...mbasicResult,
                    resolveChain,
                    method: 'mbasic_fallback'
                };
            }
            
            console.log(`   ❌ Could not resolve URL after ${iteration} iterations`);
            return {
                success: false,
                finalUrl: currentUrl,
                postId: null,
                resolveChain,
                error: 'Max redirects reached or no post ID found'
            };
            
        } catch (error) {
            console.error(`   ❌ [URL Resolver] Error:`, error.message);
            return {
                success: false,
                finalUrl: currentUrl,
                postId: null,
                resolveChain,
                error: error.message
            };
        }
    }
    
    /**
     * Resolve HTTP redirects (301/302)
     * @private
     */
    async _resolveHttpRedirect(url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: getHeaders('desktop', this.cookie, {
                    'Referer': 'https://www.facebook.com/'
                }),
                redirect: 'follow',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const html = await response.text();
            
            return {
                redirected: response.redirected,
                finalUrl: response.url,
                status: response.status,
                html
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }
    
    /**
     * Extract URL from meta-refresh tag
     * @private
     */
    _extractMetaRefresh(html) {
        // Pattern 1: <meta http-equiv="refresh" content="0;url=...">
        const patterns = [
            /<meta[^>]*http-equiv=["']?refresh["']?[^>]*content=["']?\d*;?\s*url=([^"'>]+)/i,
            /<meta[^>]*content=["']?\d*;?\s*url=([^"'>]+)[^>]*http-equiv=["']?refresh["']?/i,
            /http-equiv="refresh"[^>]*URL=([^"]+)/i,
            /URL=([^"'>\s]+)[^>]*http-equiv="refresh"/i
        ];
        
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                // Decode HTML entities
                let url = match[1]
                    .replace(/&amp;/g, '&')
                    .replace(/&#38;/g, '&')
                    .replace(/&quot;/g, '"');
                    
                return { found: true, url };
            }
        }
        
        return { found: false };
    }
    
    /**
     * Extract URL from JavaScript redirect
     * @private
     */
    _extractJsRedirect(html) {
        const patterns = [
            // window.location.replace("...")
            /window\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
            // window.location.href = "..."
            /window\.location\.href\s*=\s*["']([^"']+)["']/i,
            // window.location = "..."
            /window\.location\s*=\s*["']([^"']+)["']/i,
            // location.replace("...")
            /location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i,
            // location.href = "..."
            /location\.href\s*=\s*["']([^"']+)["']/i,
            // document.location = "..."
            /document\.location\s*=\s*["']([^"']+)["']/i,
            // top.location.replace("...")
            /top\.location\.replace\s*\(\s*["']([^"']+)["']\s*\)/i
        ];
        
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                // Decode escaped characters
                let url = match[1]
                    .replace(/\\u002F/g, '/')
                    .replace(/\\u003A/g, ':')
                    .replace(/\\u0026/g, '&')
                    .replace(/\\\//g, '/')
                    .replace(/\\x2F/g, '/')
                    .replace(/\\x3A/g, ':');
                    
                return { found: true, url };
            }
        }
        
        return { found: false };
    }
    
    /**
     * Extract Post ID directly from URL
     * @private
     */
    _extractPostIdFromUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const params = urlObj.searchParams;
            
            // Pattern: /posts/123456
            let match = pathname.match(/\/posts\/(\d+)/);
            if (match) return match[1];
            
            // Pattern: /permalink/123456
            match = pathname.match(/\/permalink\/(\d+)/);
            if (match) return match[1];
            
            // Pattern: ?story_fbid=123456
            const storyFbid = params.get('story_fbid');
            if (storyFbid && /^\d+$/.test(storyFbid)) return storyFbid;
            
            // Pattern: ?fbid=123456
            const fbid = params.get('fbid');
            if (fbid && /^\d+$/.test(fbid)) return fbid;
            
            // Pattern: /photo?fbid=123456
            match = pathname.match(/\/photo\.php.*fbid=(\d+)/);
            if (match) return match[1];
            
            // Pattern: /{user}/posts/{post_id}
            match = pathname.match(/\/[^\/]+\/posts\/(\d+)/);
            if (match) return match[1];
            
            // Pattern: /groups/{group}/posts/{post_id}
            match = pathname.match(/\/groups\/[^\/]+\/posts\/(\d+)/);
            if (match) return match[1];
            
            // Pattern: /groups/{group}/permalink/{post_id}
            match = pathname.match(/\/groups\/[^\/]+\/permalink\/(\d+)/);
            if (match) return match[1];
            
            return null;
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Extract Post ID from HTML content
     * @private
     */
    _extractPostIdFromHtml(html) {
        const patterns = [
            // story_fbid in various formats
            /story_fbid[=:](\d+)/,
            /story_fbid["':=]+(\d+)/,
            
            // ft_ent_identifier (mbasic common)
            /ft_ent_identifier["':=]+(\d+)/,
            /name="ft_ent_identifier"[^>]*value="(\d+)"/,
            
            // og:url meta tag
            /og:url"[^>]*content="[^"]*\/(\d+)/,
            
            // mf_story_key
            /mf_story_key["':\.]+(\d+)/,
            
            // top_level_post_id
            /top_level_post_id["':]+(\d+)/,
            
            // feedback_target
            /feedback_target["':].*?id["':]+(\d+)/
        ];
        
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1] && match[1].length > 10) {
                return match[1];
            }
        }
        
        return null;
    }
    
    /**
     * Extract Post ID from JSON data embedded in page
     * @private
     */
    _extractPostIdFromJson(html) {
        // Look for RelayPrefetchedStreamCache data
        const relayPatterns = [
            /"post_id"\s*:\s*"(\d+)"/,
            /"story_id"\s*:\s*"(\d+)"/,
            /"id"\s*:\s*"(\d{15,})"/,  // Facebook IDs are typically 15+ digits
            /"feedback_id"\s*:\s*"feedback:(\d+)"/,
            /RelayPrefetchedStreamCache.*?(\d{15,})/
        ];
        
        for (const pattern of relayPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        // Try to find ServerJS require data
        const serverJsMatch = html.match(/require\("ServerJS"\)\.handle\((.*?)\);/s);
        if (serverJsMatch) {
            try {
                const storyMatch = serverJsMatch[1].match(/"story_fbid"\s*:\s*"?(\d+)"?/);
                if (storyMatch) return storyMatch[1];
            } catch (e) {}
        }
        
        return null;
    }
    
    /**
     * Try mbasic.facebook.com as fallback
     * @private
     */
    async _tryMbasicFallback(originalUrl) {
        try {
            // Convert share URL to mbasic format
            let mbasicUrl = originalUrl;
            
            // If it's a share/p URL, try accessing directly via mbasic
            if (originalUrl.includes('/share/p/')) {
                mbasicUrl = originalUrl.replace('www.facebook.com', 'mbasic.facebook.com')
                                       .replace('m.facebook.com', 'mbasic.facebook.com');
            }
            
            console.log(`   🔄 Trying mbasic URL: ${mbasicUrl}`);
            
            const response = await fetch(mbasicUrl, {
                method: 'GET',
                headers: getHeaders('mbasic', this.cookie),
                redirect: 'follow'
            });
            
            const html = await response.text();
            
            // Check for login page
            if (html.includes('login_form') || html.includes('/login/')) {
                return { success: false, error: 'Redirected to login' };
            }
            
            // Try all extraction methods
            const postId = this._extractPostIdFromHtml(html) || 
                          this._extractPostIdFromUrl(response.url) ||
                          this._extractPostIdFromJson(html);
            
            if (postId) {
                return {
                    success: true,
                    finalUrl: response.url,
                    postId
                };
            }
            
            return { success: false, error: 'No post ID found in mbasic' };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Resolve relative URL to absolute
     * @private
     */
    _resolveRelativeUrl(baseUrl, relativeUrl) {
        try {
            if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
                return relativeUrl;
            }
            return new URL(relativeUrl, baseUrl).href;
        } catch (e) {
            return relativeUrl;
        }
    }
}

// ==============================================
// SECTION 3: ENHANCED MBASIC PARSER
// ==============================================

/**
 * Enhanced mbasic.facebook.com HTML Parser
 * More reliable than www.facebook.com because it serves SSR HTML
 * 
 * IMPORTANT: User-Agent Sync
 * - If cookie was extracted from Desktop browser, using Mobile UA on mbasic may trigger logout
 * - Use setUserAgent() to match the UA with the cookie's origin browser
 * - Default: Mobile Chrome UA (works for most cases)
 */
class MbasicParser {
    /**
     * @param {String} cookie - Facebook cookie string
     * @param {Object} options - Configuration options
     * @param {String} options.userAgent - Custom User-Agent to use (synced with cookie origin)
     * @param {String} options.headerProfile - 'mbasic', 'desktop', 'ios' (default: auto-detect)
     */
    constructor(cookie = '', options = {}) {
        this.cookie = cookie;
        this.customUserAgent = options.userAgent || null;
        this.headerProfile = options.headerProfile || this._detectHeaderProfile(options.userAgent);
        
        console.log(`📡 [Mbasic Parser] Initialized with profile: ${this.headerProfile}`);
        if (this.customUserAgent) {
            console.log(`📡 [Mbasic Parser] Custom User-Agent: ${this.customUserAgent.substring(0, 50)}...`);
        }
    }
    
    /**
     * Set custom User-Agent (call before fetching)
     * @param {String} userAgent - User-Agent string
     */
    setUserAgent(userAgent) {
        this.customUserAgent = userAgent;
        this.headerProfile = this._detectHeaderProfile(userAgent);
        console.log(`📡 [Mbasic Parser] User-Agent updated, profile: ${this.headerProfile}`);
    }
    
    /**
     * Auto-detect best header profile based on User-Agent
     * @private
     */
    _detectHeaderProfile(userAgent) {
        if (!userAgent) return 'mbasic'; // Default
        
        const ua = userAgent.toLowerCase();
        
        // Desktop User-Agents should use 'desktop' profile
        if (ua.includes('windows nt') || ua.includes('macintosh') || ua.includes('x11')) {
            // Desktop cookie - using mbasic might cause issues
            console.log(`⚠️ [Mbasic Parser] Desktop User-Agent detected - recommend using www instead of mbasic`);
            return 'desktop';
        }
        
        // Mobile User-Agents
        if (ua.includes('android') || ua.includes('iphone') || ua.includes('mobile')) {
            return 'mbasic';
        }
        
        return 'mbasic'; // Default fallback
    }
    
    /**
     * Build headers with proper User-Agent sync
     * @private
     */
    _buildHeaders() {
        const headers = getHeaders(this.headerProfile, this.cookie);
        
        // Override User-Agent if custom one is set
        if (this.customUserAgent) {
            headers['User-Agent'] = this.customUserAgent;
        }
        
        return headers;
    }
    
    /**
     * Fetch and parse posts from mbasic.facebook.com
     * @param {String} targetUrl - Group URL, Page URL, or Feed URL
     * @param {Number} limit - Max posts to fetch
     * @returns {Promise<Array>} - Array of post objects
     */
    async fetchPosts(targetUrl, limit = 10) {
        console.log(`📡 [Mbasic Parser] Fetching from: ${targetUrl}`);
        console.log(`📡 [Mbasic Parser] Using header profile: ${this.headerProfile}`);
        
        try {
            // Convert to mbasic URL (unless using desktop profile on www)
            let fetchUrl;
            if (this.headerProfile === 'desktop') {
                // For Desktop cookies, consider using www instead of mbasic
                fetchUrl = this._convertToWwwUrl(targetUrl);
                console.log(`📡 [Mbasic Parser] Desktop mode - using www: ${fetchUrl}`);
            } else {
                fetchUrl = this._convertToMbasicUrl(targetUrl);
            }
            
            const headers = this._buildHeaders();
            
            const response = await fetch(fetchUrl, {
                method: 'GET',
                headers: headers,
                redirect: 'follow'
            });
            
            // Check for login redirect in URL
            if (response.url.includes('/login')) {
                console.error(`   ❌ Login redirect detected! Cookie is DEAD.`);
                console.error(`   📍 Final URL: ${response.url}`);
                return { error: 'COOKIE_DEAD', posts: [], reason: 'Redirected to login page' };
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const html = await response.text();
            
            // Detect WAP/Error page
            if (this._isWapPage(html)) {
                console.error(`   ❌ WAP page detected! Headers may need update.`);
                console.log(`   📋 First 200 chars: ${html.substring(0, 200)}`);
                return [];
            }
            
            // Detect login redirect
            if (this._isLoginPage(html)) {
                console.error(`   ❌ Login page detected! Cookie may be invalid.`);
                return [];
            }
            
            // Parse posts
            const posts = this._parsePostsFromHtml(html, limit);
            
            console.log(`   ✅ Parsed ${posts.length} posts`);
            return posts;
            
        } catch (error) {
            console.error(`   ❌ Fetch error: ${error.message}`);
            return [];
        }
    }
    
    /**
     * Parse post IDs and metadata from mbasic HTML
     * @private
     */
    _parsePostsFromHtml(html, limit) {
        const posts = [];
        
        // Pattern groups for different post ID locations
        const patternGroups = [
            // Comment form patterns (most reliable)
            {
                pattern: /action="\/a\/comment\.php[^"]*"[^>]*>[\s\S]*?name="ft_ent_identifier"\s*value="(\d+)"/g,
                type: 'comment_form'
            },
            
            // ft_ent_identifier patterns
            {
                pattern: /ft_ent_identifier[=:"']+(\d+)/g,
                type: 'ft_ent'
            },
            
            // Story patterns
            {
                pattern: /story\.php\?story_fbid=(\d+)/g,
                type: 'story_link'
            },
            
            // Posts URL pattern
            {
                pattern: /\/[^\/]+\/posts\/(\d+)/g,
                type: 'posts_url'
            },
            
            // Permalink pattern  
            {
                pattern: /\/permalink\/(\d+)/g,
                type: 'permalink'
            },
            
            // Photo pattern
            {
                pattern: /photo\.php\?fbid=(\d+)/g,
                type: 'photo'
            },
            
            // Like action pattern
            {
                pattern: /\/a\/like\.php[^"]*?ft_ent_identifier=(\d+)/g,
                type: 'like_action'
            },
            
            // Reaction picker pattern
            {
                pattern: /\/ufi\/reaction[^"]*?ft_ent_identifier=(\d+)/g,
                type: 'reaction'
            },
            
            // mf_story_key pattern
            {
                pattern: /mf_story_key[\.":]+(\d+)/g,
                type: 'mf_story'
            },
            
            // Comment token pattern
            {
                pattern: /ctoken=(\d+)_/g,
                type: 'ctoken'
            }
        ];
        
        const foundIds = new Set();
        
        for (const { pattern, type } of patternGroups) {
            let match;
            while ((match = pattern.exec(html)) !== null && posts.length < limit) {
                const postId = match[1];
                
                // Validate post ID (should be numeric and reasonable length)
                if (postId && 
                    /^\d{10,}$/.test(postId) && 
                    !foundIds.has(postId)) {
                    
                    foundIds.add(postId);
                    posts.push({
                        postId,
                        source: type,
                        url: `https://facebook.com/${postId}`
                    });
                    
                    console.log(`   📝 Found: ${postId} (via ${type})`);
                }
            }
            
            if (posts.length >= limit) break;
        }
        
        return posts;
    }
    
    /**
     * Convert URL to mbasic.facebook.com format
     * @private
     */
    _convertToMbasicUrl(url) {
        try {
            const urlObj = new URL(url);
            urlObj.hostname = 'mbasic.facebook.com';
            return urlObj.href;
        } catch (e) {
            // If not a valid URL, assume it's a path
            if (url.startsWith('/')) {
                return `https://mbasic.facebook.com${url}`;
            }
            return `https://mbasic.facebook.com/${url}`;
        }
    }
    
    /**
     * Convert URL to www.facebook.com format (for Desktop cookies)
     * @private
     */
    _convertToWwwUrl(url) {
        try {
            const urlObj = new URL(url);
            urlObj.hostname = 'www.facebook.com';
            return urlObj.href;
        } catch (e) {
            // If not a valid URL, assume it's a path
            if (url.startsWith('/')) {
                return `https://www.facebook.com${url}`;
            }
            return `https://www.facebook.com/${url}`;
        }
    }
    
    /**
     * Detect if response is WAP/WAPFORUM page
     * @private
     */
    _isWapPage(html) {
        const wapIndicators = [
            'WAPFORUM',
            'wml',
            'WML',
            '<!DOCTYPE wml',
            'application/vnd.wap'
        ];
        
        const htmlStart = html.substring(0, 500).toLowerCase();
        return wapIndicators.some(indicator => htmlStart.includes(indicator.toLowerCase()));
    }
    
    /**
     * Detect if response is login page (comprehensive check)
     * @private
     * @param {String} html - Page HTML content
     * @returns {Object} - { isLogin: Boolean, indicators: Array<String> }
     */
    _isLoginPage(html) {
        const loginIndicators = [
            // Form elements
            { pattern: 'login_form', name: 'login_form element' },
            { pattern: 'login_password', name: 'password field' },
            { pattern: 'id="loginbutton"', name: 'login button' },
            { pattern: 'name="email"', name: 'email field' },
            
            // URLs
            { pattern: '/login/', name: 'login URL' },
            { pattern: '/checkpoint/', name: 'checkpoint URL' },
            
            // English text
            { pattern: 'Log in to Facebook', name: 'login title (EN)' },
            { pattern: 'Log In', name: 'Log In button' },
            { pattern: 'Forgotten password', name: 'forgot password' },
            { pattern: 'Create new account', name: 'create account' },
            
            // Vietnamese text
            { pattern: 'Đăng nhập Facebook', name: 'login title (VI)' },
            { pattern: 'Đăng nhập', name: 'login button (VI)' },
            { pattern: 'Tạo tài khoản mới', name: 'create account (VI)' },
            { pattern: 'Quên mật khẩu', name: 'forgot password (VI)' },
            
            // Security/Block indicators
            { pattern: 'Your account has been disabled', name: 'account disabled' },
            { pattern: 'Tài khoản của bạn đã bị vô hiệu hóa', name: 'account disabled (VI)' },
            { pattern: 'confirm your identity', name: 'identity check' },
            { pattern: 'xác nhận danh tính', name: 'identity check (VI)' }
        ];
        
        const foundIndicators = [];
        
        for (const indicator of loginIndicators) {
            if (html.includes(indicator.pattern)) {
                foundIndicators.push(indicator.name);
            }
        }
        
        // Return true if 2+ indicators found (to avoid false positives)
        const isLogin = foundIndicators.length >= 2;
        
        if (isLogin) {
            console.log(`   ⚠️ [Login Detection] Found ${foundIndicators.length} indicators:`, foundIndicators.slice(0, 5));
        }
        
        return isLogin;
    }
    
    /**
     * Detailed login page check (returns full info)
     * @param {String} html - Page HTML
     * @returns {Object} - { isLogin, indicators, accountStatus }
     */
    _analyzeLoginState(html) {
        const result = {
            isLogin: false,
            indicators: [],
            accountStatus: 'unknown' // 'active', 'disabled', 'checkpoint', 'unknown'
        };
        
        // Check for disabled account
        if (html.includes('account has been disabled') || html.includes('đã bị vô hiệu hóa')) {
            result.accountStatus = 'disabled';
            result.isLogin = true;
            result.indicators.push('Account disabled');
            return result;
        }
        
        // Check for checkpoint/verification
        if (html.includes('/checkpoint/') || html.includes('confirm your identity')) {
            result.accountStatus = 'checkpoint';
            result.isLogin = true;
            result.indicators.push('Security checkpoint');
            return result;
        }
        
        // Standard login check
        result.isLogin = this._isLoginPage(html);
        
        if (!result.isLogin) {
            result.accountStatus = 'active';
        }
        
        return result;
    }
}

// ==============================================
// SECTION 4: UNIFIED CRAWLER CLASS
// ==============================================

/**
 * Main Facebook Crawler Class
 * Combines all components for easy usage
 */
class FacebookCrawler {
    constructor(cookie = '') {
        this.cookie = cookie;
        this.urlResolver = new FacebookUrlResolver(cookie);
        this.parser = new MbasicParser(cookie);
    }
    
    /**
     * Update cookie (e.g., after refresh)
     */
    setCookie(cookie) {
        this.cookie = cookie;
        this.urlResolver.cookie = cookie;
        this.parser.cookie = cookie;
    }
    
    /**
     * Resolve a Facebook URL to get post ID
     * @param {String} url - Any Facebook URL
     * @returns {Promise<String|null>} - Post ID or null
     */
    async resolvePostId(url) {
        const result = await this.urlResolver.resolveFacebookUrl(url);
        return result.success ? result.postId : null;
    }
    
    /**
     * Crawl posts from Facebook News Feed
     * @param {Number} limit - Max posts
     * @returns {Promise<Array>} - Array of post IDs
     */
    async crawlNewsFeed(limit = 10) {
        const posts = await this.parser.fetchPosts('https://mbasic.facebook.com/', limit);
        return posts.map(p => p.postId);
    }
    
    /**
     * Crawl posts from a Facebook Group
     * @param {String} groupUrl - Group URL or ID
     * @param {Number} limit - Max posts
     * @returns {Promise<Array>} - Array of post IDs
     */
    async crawlGroup(groupUrl, limit = 10) {
        // Extract group ID
        let groupId = groupUrl;
        try {
            const url = new URL(groupUrl);
            const match = url.pathname.match(/\/groups\/([^\/]+)/);
            if (match) groupId = match[1];
        } catch (e) {}
        
        const posts = await this.parser.fetchPosts(
            `https://mbasic.facebook.com/groups/${groupId}`,
            limit
        );
        return posts.map(p => p.postId);
    }
    
    /**
     * Crawl posts from a Facebook Page
     * @param {String} pageUrl - Page URL or username
     * @param {Number} limit - Max posts
     * @returns {Promise<Array>} - Array of post IDs
     */
    async crawlPage(pageUrl, limit = 10) {
        // Extract page ID/username
        let pageId = pageUrl;
        try {
            const url = new URL(pageUrl);
            pageId = url.pathname.replace(/^\//, '').split('/')[0];
        } catch (e) {}
        
        const posts = await this.parser.fetchPosts(
            `https://mbasic.facebook.com/${pageId}`,
            limit
        );
        return posts.map(p => p.postId);
    }
    
    /**
     * Process an array of URLs/IDs and return valid post IDs
     * @param {Array<String>} inputs - Array of URLs or IDs
     * @returns {Promise<Array<String>>} - Array of valid post IDs
     */
    async processInputs(inputs) {
        const results = [];
        
        for (const input of inputs) {
            // Skip empty inputs
            if (!input || typeof input !== 'string') continue;
            
            const trimmed = input.trim();
            
            // Already a numeric ID
            if (/^\d+$/.test(trimmed)) {
                results.push(trimmed);
                continue;
            }
            
            // Try to resolve URL
            const postId = await this.resolvePostId(trimmed);
            if (postId) {
                results.push(postId);
            }
        }
        
        // Remove duplicates
        return [...new Set(results)];
    }
    
    /**
     * Fetch managed Fanpages from mbasic.facebook.com/pages/?owned
     * Scrapes the owned pages list and extracts pageId and name
     * 
     * @returns {Promise<Array>} - Array of pages: [{ pageId, name }, ...]
     */
    async fetchPagesViaCookie() {
        try {
            console.log('📖 [FacebookCrawler] Fetching managed pages via cookie...');
            
            if (!this.cookie) {
                console.warn('⚠️  [FacebookCrawler] No cookie available');
                return [];
            }
            
            const url = 'https://mbasic.facebook.com/pages/?owned';
            const headers = getHeaders('mbasic', this.cookie);
            
            console.log(`📡 [FacebookCrawler] Requesting: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers,
                timeout: 15000
            });
            
            if (!response.ok) {
                console.error(`❌ [FacebookCrawler] HTTP ${response.status}: ${response.statusText}`);
                return [];
            }
            
            const html = await response.text();
            console.log(`✅ [FacebookCrawler] Received ${html.length} bytes of HTML`);
            
            // Parse pages from HTML
            const pages = [];
            
            // Pattern 1: Extract from page list links
            // Format: /[PAGE_NAME]/PAGE_ID/?...
            const pagePattern = /<a[^>]*href="\/([^"]+)\/(\d+)\/?"[^>]*>(.*?)<\/a>/gi;
            let match;
            
            while ((match = pagePattern.exec(html)) !== null) {
                try {
                    const pageSlug = match[1];
                    const pageId = match[2];
                    const nameText = match[3];
                    
                    // Extract clean name from text (remove HTML entities and tags)
                    const name = nameText
                        .replace(/<[^>]*>/g, '')
                        .replace(/&[^;]+;/g, '')
                        .trim();
                    
                    // Filter out non-page entries
                    if (pageId && name && !['home', 'messages', 'notifications'].includes(pageSlug.toLowerCase())) {
                        pages.push({
                            pageId,
                            name,
                            picture: null,
                            category: null
                        });
                        console.log(`   ✓ Found page: ${name} (${pageId})`);
                    }
                } catch (e) {
                    console.error(`   ⚠️  Error parsing page:`, e.message);
                }
            }
            
            // Pattern 2: Extract from direct page list divs/sections
            // Mbasic sometimes uses different HTML structures
            const pageTablePattern = /<a[^>]*href="\/pages\/[^"]*"[^>]*>.*?<\/a>/gi;
            const matches = html.match(pageTablePattern) || [];
            
            for (const pageLink of matches) {
                try {
                    // Extract page ID from href
                    const idMatch = pageLink.match(/\/(\d{8,20})/);
                    const nameMatch = pageLink.match(/>([^<]+)<\/a>/);
                    
                    if (idMatch && nameMatch) {
                        const pageId = idMatch[1];
                        const name = nameMatch[1].trim();
                        
                        // Check if not already added
                        if (!pages.find(p => p.pageId === pageId)) {
                            pages.push({
                                pageId,
                                name,
                                picture: null,
                                category: null
                            });
                            console.log(`   ✓ Found page (alt): ${name} (${pageId})`);
                        }
                    }
                } catch (e) {
                    console.error(`   ⚠️  Error parsing page (alt):`, e.message);
                }
            }
            
            console.log(`📊 [FacebookCrawler] Found ${pages.length} managed pages`);
            return pages;
            
        } catch (error) {
            console.error('❌ [FacebookCrawler] fetchPagesViaCookie error:', error);
            return [];
        }
    }

    /**
     * Make an authenticated request to Facebook
     * @param {String} url - Target URL
     * @param {Object} options - Fetch options
     * @returns {Promise<Response>}
     */
    async fetch(url, options = {}) {
        const profile = url.includes('mbasic.facebook.com') ? 'mbasic' : 'desktop';
        
        const defaultOptions = {
            method: 'GET',
            headers: getHeaders(profile, this.cookie)
        };
        
        return fetch(url, {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        });
    }
}

module.exports = { fetchPagesViaCookie };
