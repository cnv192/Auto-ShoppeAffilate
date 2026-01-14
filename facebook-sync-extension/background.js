/**
 * Background Service Worker - Shoppe Facebook Sync
 * Lấy Cookie, Access Token, fb_dtsg giống FewFeeD
 */

console.log('[Shoppe Extension] Background worker loaded');

const CONFIG = {
    API_BASE_URL: 'http://localhost:3001',
    // URL để lấy token - các trang thật chứa fb_dtsg và token
    FB_TOKEN_URLS: [
        'https://mbasic.facebook.com/',                    // Trang chủ mbasic - có fb_dtsg
        'https://www.facebook.com/',                       // Trang chủ - có DTSGInitialData
        'https://mbasic.facebook.com/settings/apps/tabbed', // Settings page
        'https://www.facebook.com/ads/manager/',           // Ads manager - có EAAG token
        'https://business.facebook.com/content_management/' // Business suite
    ],
    STORAGE_KEYS: {
        USER_ID: 'shoppe_user_id',
        USER_NAME: 'shoppe_user_name',
        TEMP_TOKEN: 'shoppe_temp_token',
        AUTHENTICATED: 'shoppe_authenticated'
    }
};

// ==============================================
// MODERN HEADERS CONFIGURATION (v2.0)
// Để tránh bị Facebook detect là WAP/ancient device
// ==============================================

const MODERN_HEADERS = {
    // Desktop Chrome - cho www.facebook.com
    desktop: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
    },
    
    // Mobile Chrome - cho mbasic.facebook.com (server-side HTML)
    mbasic: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': '"Android"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
    },
    
    // iPhone Safari - alternative
    ios: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
    }
};

/**
 * Get headers for a specific profile
 * @param {String} profile - 'desktop', 'mbasic', 'ios'
 * @returns {Object}
 */
function getModernHeaders(profile = 'desktop') {
    return MODERN_HEADERS[profile] || MODERN_HEADERS.desktop;
}

// ==============================================
// COOKIE FUNCTIONS
// ==============================================

/**
 * Get all Facebook cookies và chuyển thành cookie string
 */
async function getFacebookCookies() {
    try {
        const cookies = await chrome.cookies.getAll({ 
            domain: '.facebook.com' 
        });
        
        // Convert to cookie string format: name1=value1; name2=value2
        const cookieString = cookies
            .map(c => `${c.name}=${c.value}`)
            .join('; ');
        
        // Extract UID from c_user
        const cUserCookie = cookies.find(c => c.name === 'c_user');
        const uid = cUserCookie ? cUserCookie.value : null;
        
        // Extract xs (session)
        const xsCookie = cookies.find(c => c.name === 'xs');
        const xs = xsCookie ? xsCookie.value : null;
        
        return {
            uid,
            xs,
            cookieString,
            cookies,
            loggedIn: !!uid && !!xs
        };
    } catch (error) {
        console.error('[Background] Error getting cookies:', error);
        return {
            uid: null,
            xs: null,
            cookieString: '',
            cookies: [],
            loggedIn: false
        };
    }
}

// ==============================================
// GET ACCESS TOKEN VIA DOM INJECTION (Vũ khí hạng nặng)
// ==============================================

/**
 * Function này sẽ chạy TRỰC TIẾP trong tab Facebook
 * Lấy token từ biến toàn cục mà Facebook expose
 */
function stealTokenFromDOM() {
    try {
        let token = null;
        
        // 1. Thử lấy từ Business Manager (Xịn nhất)
        if (typeof window.__accessToken !== 'undefined') {
            token = window.__accessToken;
        } 
        // 2. Thử lấy từ biến môi trường Ads
        else if (typeof window.AdHandle !== 'undefined' && window.AdHandle.getAccessToken) {
            token = window.AdHandle.getAccessToken();
        }
        // 3. Thử lấy từ require module (Cách của dân tut)
        else {
            try {
                // Token EAAA thường nằm ở đây
                const D = require("DTSGInitialData");
                token = D.token || D.accessToken;
            } catch(e) {}
            
            if (!token) {
                try {
                    // Token EAAB thường nằm ở đây  
                    token = require("BusinessUserAccessToken").getAccessToken();
                } catch(e) {}
            }
            
            if (!token) {
                try {
                    // Token từ AccessToken module
                    token = require("AccessToken").getAccessToken?.();
                } catch(e) {}
            }
        }

        // Lấy fb_dtsg (Luôn cần thiết)
        let dtsg = document.querySelector('input[name="fb_dtsg"]')?.value;
        if (!dtsg) {
            try { dtsg = require("DTSGInitialData").token; } catch(e) {}
        }
        
        // Lấy thêm các tokens khác
        let jazoest = document.querySelector('input[name="jazoest"]')?.value;
        let lsd = document.querySelector('input[name="lsd"]')?.value;
        if (!lsd) {
            try { lsd = require("LSD").token; } catch(e) {}
        }

        return { 
            success: true,
            token, 
            dtsg,
            jazoest,
            lsd,
            source: token ? 'DOM injection' : 'not found'
        };
    } catch (e) {
        return { 
            success: false,
            error: e.toString() 
        };
    }
}

/**
 * Inject script vào Facebook tab để lấy token
 */
async function getAccessTokenViaInjection() {
    try {
        console.log('[Background] 💉 Starting DOM injection...');
        
        // Tìm tab Facebook đang mở (ưu tiên tab active)
        let [tab] = await chrome.tabs.query({ 
            url: "*://*.facebook.com/*", 
            active: true 
        });
        
        // Nếu không có tab active, tìm tab bất kỳ
        if (!tab) {
            let tabs = await chrome.tabs.query({ url: "*://*.facebook.com/*" });
            if (tabs.length > 0) {
                tab = tabs[0];
                console.log('[Background] Found inactive Facebook tab:', tab.id);
            }
        }

        if (!tab) {
            console.error('[Background] ❌ Không tìm thấy tab Facebook nào!');
            return { success: false, error: 'No Facebook tab found' };
        }

        console.log(`[Background] 💉 Injecting into Tab ID: ${tab.id}`);
        
        // Thực thi hàm stealTokenFromDOM ngay trong tab đó
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: stealTokenFromDOM,
            world: "MAIN" // Quan trọng: Truy cập được biến window của Facebook
        });

        const data = result[0].result;
        
        if (data && data.token) {
            console.log('[Background] 🔥🔥🔥 BINGO! Lấy được token từ DOM 🔥🔥🔥');
            console.log('[Background] Token:', data.token.substring(0, 30) + '...');
            console.log('[Background] DTSG:', data.dtsg ? '✅' : '❌');
            return data;
        } else {
            console.log('[Background] ⚠️ Không tìm thấy token trong DOM');
            console.log('[Background] Hint: Thử mở trang Facebook Ads Manager hoặc Business Suite');
            return data || { success: false, error: 'Token not found in DOM' };
        }
        
    } catch (error) {
        console.error('[Background] ❌ Injection error:', error);
        return { success: false, error: error.message };
    }
}

// ==============================================
// GET ACCESS TOKEN (EAAG) - Từ các nguồn khác
// ==============================================

/**
 * Lấy Access Token EAAG từ các nguồn khác nhau
 * Access Token chỉ có trong Ads Manager, Graph Explorer, Business Suite
 * NOW USES: Modern headers to avoid WAP detection
 */
async function getAccessToken() {
    console.log('[Background] 🔍 Searching for Access Token...');
    
    // Các URL có thể chứa Access Token EAAG với modern headers
    const tokenUrls = [
        // Graph API Explorer - nguồn chính
        {
            url: 'https://developers.facebook.com/tools/explorer/',
            headers: getModernHeaders('desktop')
        },
        // Ads Manager 
        {
            url: 'https://www.facebook.com/adsmanager/manage/campaigns',
            headers: getModernHeaders('desktop')
        },
        // Business Suite
        {
            url: 'https://business.facebook.com/',
            headers: getModernHeaders('desktop')
        },
        // Mobile mbasic với giả lập mobile mới nhất
        {
            url: 'https://mbasic.facebook.com/settings/apps/',
            headers: getModernHeaders('mbasic')
        }
    ];
    
    for (const { url, headers } of tokenUrls) {
        try {
            console.log('[Background] Fetching token from:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers
            });
            
            if (!response.ok) {
                console.log('[Background] HTTP', response.status, 'from', url);
                continue;
            }
            
            const html = await response.text();
            
            // === WAP PAGE DETECTION ===
            if (html.includes('WAPFORUM') || html.includes('<!DOCTYPE wml')) {
                console.error('[Background] ❌ WAP page detected from:', url);
                console.error('[Background] Headers may need update or Facebook detected bot behavior');
                continue;
            }
            
            console.log('[Background] Response length:', html.length, 'has EAAG:', html.includes('EAAG'));
            
            if (!html.includes('EAAG')) continue;
            
            // Các pattern để tìm EAAG token
            const patterns = [
                /accessToken["\s:]+["']?(EAAG[A-Za-z0-9]+)["']?/,
                /"access_token"["\s:]+["']?(EAAG[A-Za-z0-9]+)["']?/,
                /access_token=(EAAG[A-Za-z0-9]+)/,
                /"(EAAG[A-Za-z0-9]{100,})"/,
                /EAAG[A-Za-z0-9]{100,}/
            ];
            
            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    const token = match[1] || match[0];
                    if (token && token.startsWith('EAAG') && token.length > 50) {
                        console.log('[Background] ✅ Found Access Token from:', url);
                        return token;
                    }
                }
            }
            
        } catch (error) {
            console.log('[Background] Error fetching', url, ':', error.message);
        }
    }
    
    console.log('[Background] ❌ Access Token not found in any source');
    return null;
}

// ==============================================
// GET FACEBOOK TOKEN & FB_DTSG (Giống FewFeeD)
// ==============================================

/**
 * Fetch Facebook Token và fb_dtsg từ mbasic.facebook.com
 * QUAN TRỌNG: Phải dùng credentials: 'include' để browser tự gửi cookies
 * NOW USES: Modern headers with Sec-Fetch-* to avoid WAP detection
 */
async function getFacebookToken() {
    try {
        // Kiểm tra đăng nhập trước
        const cookieData = await getFacebookCookies();
        
        if (!cookieData.loggedIn) {
            return {
                success: false,
                error: 'Chưa đăng nhập Facebook'
            };
        }
        
        let accessToken = null;
        let fb_dtsg = null;
        let jazoest = null;
        let lsd = null;
        let html = '';
        
        // Thử từng URL cho đến khi lấy được token
        for (const url of CONFIG.FB_TOKEN_URLS) {
            console.log('[Background] Trying URL:', url);
            
            try {
                // Determine which headers to use based on URL
                const isMbasic = url.includes('mbasic.facebook.com');
                const headers = isMbasic ? getModernHeaders('mbasic') : getModernHeaders('desktop');
                
                // QUAN TRỌNG: Dùng credentials: 'include' để browser tự đính kèm cookies
                // KHÔNG thêm header Cookie thủ công - sẽ bị conflict
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'include',  // BẮT BUỘC - để browser tự gửi cookies
                    headers: {
                        ...headers,
                        // Override User-Agent with navigator for authenticity
                        'User-Agent': navigator.userAgent
                    }
                });
                
                console.log('[Background] Response status:', response.status);
                
                if (!response.ok) {
                    console.log('[Background] HTTP error, trying next URL...');
                    continue;
                }
                
                html = await response.text();
                console.log('[Background] HTML length:', html.length);
                
                // === WAP PAGE DETECTION ===
                if (html.includes('WAPFORUM') || html.includes('<!DOCTYPE wml')) {
                    console.error('[Background] ❌ WAP page detected! Headers need update.');
                    console.log('[Background] HTML preview:', html.substring(0, 300));
                    continue;
                }
                
                // Kiểm tra xem có bị redirect về login không
                const isLoginPage = html.includes('login_form') || html.includes('/login/');
                if (isLoginPage) {
                    console.log('[Background] ⚠️ Redirected to login page, trying next URL...');
                    continue;
                }
                
                // Debug: In preview để kiểm tra
                if (html.length < 1000) {
                    console.log('[Background] HTML content (short):', html);
                } else {
                    console.log('[Background] HTML has fb_dtsg:', html.includes('fb_dtsg'));
                    console.log('[Background] HTML has EAAG:', html.includes('EAAG'));
                }
                
                // ===== EXTRACT ACCESS TOKEN =====
                // Pattern 1: accessToken":"EAAG... (có escape)
                let tokenMatch = html.match(/accessToken\\?":\\?"(EAAG[^"\\]+)\\?"/);
                if (tokenMatch) {
                    accessToken = tokenMatch[1];
                }
                
                // Pattern 2: accessToken":"EAAG... (không escape)
                if (!accessToken) {
                    tokenMatch = html.match(/accessToken":"(EAAG[^"]+)"/);
                    if (tokenMatch) accessToken = tokenMatch[1];
                }
                
                // Pattern 3: Token trần "EAAG..."
                if (!accessToken) {
                    tokenMatch = html.match(/"(EAAG[A-Za-z0-9]+)"/);
                    if (tokenMatch) accessToken = tokenMatch[1];
                }
                
                // Pattern 4: Token không có dấu ngoặc kép (ít nhất 50 ký tự)
                if (!accessToken) {
                    tokenMatch = html.match(/EAAG[A-Za-z0-9]{50,}/);
                    if (tokenMatch) accessToken = tokenMatch[0];
                }
                
                // Pattern 5: access_token= trong URL params
                if (!accessToken) {
                    tokenMatch = html.match(/access_token=(EAAG[A-Za-z0-9]+)/);
                    if (tokenMatch) accessToken = tokenMatch[1];
                }
                
                // ===== EXTRACT fb_dtsg =====
                // Pattern 1: name="fb_dtsg" value="..." (mbasic)
                let dtsgMatch = html.match(/name="fb_dtsg"\s*value="([^"]+)"/);
                if (dtsgMatch) {
                    fb_dtsg = dtsgMatch[1];
                    console.log('[Background] fb_dtsg found via pattern 1');
                }
                
                // Pattern 2: value="..." name="fb_dtsg" (reversed order)
                if (!fb_dtsg) {
                    dtsgMatch = html.match(/value="([^"]+)"\s*name="fb_dtsg"/);
                    if (dtsgMatch) {
                        fb_dtsg = dtsgMatch[1];
                        console.log('[Background] fb_dtsg found via pattern 2');
                    }
                }
                
                // Pattern 3: DTSGInitialData trong script (www.facebook.com)
                if (!fb_dtsg) {
                    dtsgMatch = html.match(/"token"\s*:\s*"([^"]+)".*?DTSGInitialData|DTSGInitialData.*?"token"\s*:\s*"([^"]+)"/);
                    if (dtsgMatch) {
                        fb_dtsg = dtsgMatch[1] || dtsgMatch[2];
                        console.log('[Background] fb_dtsg found via pattern 3');
                    }
                }
                
                // Pattern 4: DTSG token trong JSON
                if (!fb_dtsg) {
                    dtsgMatch = html.match(/\{"token":"([^"]{20,})"/);
                    if (dtsgMatch) {
                        fb_dtsg = dtsgMatch[1];
                        console.log('[Background] fb_dtsg found via pattern 4');
                    }
                }
                
                // Pattern 5: fb_dtsg trong form action
                if (!fb_dtsg) {
                    dtsgMatch = html.match(/fb_dtsg=([^&"]+)/);
                    if (dtsgMatch) {
                        fb_dtsg = dtsgMatch[1];
                        console.log('[Background] fb_dtsg found via pattern 5');
                    }
                }
                
                // Pattern 6: DTSGInitData (newer format)
                if (!fb_dtsg) {
                    dtsgMatch = html.match(/"DTSGInitData"[^}]*"token"\s*:\s*"([^"]+)"/);
                    if (dtsgMatch) {
                        fb_dtsg = dtsgMatch[1];
                        console.log('[Background] fb_dtsg found via pattern 6');
                    }
                }
                
                // ===== EXTRACT jazoest & lsd =====
                let jazoestMatch = html.match(/name="jazoest"\s*value="(\d+)"/);
                if (!jazoestMatch) jazoestMatch = html.match(/value="(\d+)"\s*name="jazoest"/);
                if (!jazoestMatch) jazoestMatch = html.match(/jazoest=(\d+)/);
                if (jazoestMatch) jazoest = jazoestMatch[1];
                
                let lsdMatch = html.match(/name="lsd"\s*value="([^"]+)"/);
                if (!lsdMatch) lsdMatch = html.match(/value="([^"]+)"\s*name="lsd"/);
                if (!lsdMatch) lsdMatch = html.match(/"lsd"\s*:\s*"([^"]+)"/);
                if (!lsdMatch) lsdMatch = html.match(/LSD[^}]*"token"\s*:\s*"([^"]+)"/);
                if (lsdMatch) lsd = lsdMatch[1];
                
                // Nếu tìm được fb_dtsg, dừng lại (token sẽ lấy riêng)
                if (fb_dtsg) {
                    console.log('[Background] ✅ Found fb_dtsg from:', url);
                    break;
                }
                
            } catch (urlError) {
                console.log('[Background] Error with URL:', url, urlError.message);
                continue;
            }
        }
        
        // Nếu chưa có Access Token, thử inject vào DOM để lấy
        if (!accessToken) {
            console.log('[Background] Trying DOM injection for Access Token...');
            const injectionResult = await getAccessTokenViaInjection();
            if (injectionResult.success && injectionResult.token) {
                accessToken = injectionResult.token;
                // Nếu injection cũng lấy được dtsg/jazoest/lsd thì dùng luôn
                if (injectionResult.dtsg && !fb_dtsg) fb_dtsg = injectionResult.dtsg;
                if (injectionResult.jazoest && !jazoest) jazoest = injectionResult.jazoest;
                if (injectionResult.lsd && !lsd) lsd = injectionResult.lsd;
            }
        }
        
        // Log kết quả
        console.log('[Background] Final Results:');
        console.log('  - Access Token:', accessToken ? '✅ ' + accessToken.substring(0, 30) + '...' : '❌ Not found (use OAuth to get)');
        console.log('  - fb_dtsg:', fb_dtsg ? '✅ Found' : '❌ Not found');
        console.log('  - jazoest:', jazoest ? '✅ Found' : '❌ Not found');
        console.log('  - lsd:', lsd ? '✅ Found' : '❌ Not found');
        
        // Lưu ý: Không có Access Token vẫn có thể hoạt động với cookies + fb_dtsg
        // Access Token chỉ cần cho một số API calls đặc biệt
        
        return {
            success: true,
            accessToken,
            fb_dtsg,
            jazoest,
            lsd,
            uid: cookieData.uid,
            cookieString: cookieData.cookieString,
            userAgent: navigator.userAgent,
            htmlLength: html.length,
            // Flag để UI biết có thể yêu cầu OAuth
            needsOAuth: !accessToken
        };
        
    } catch (error) {
        console.error('[Background] ❌ Error fetching Facebook token:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get đầy đủ Facebook data (Cookie, Token, fb_dtsg, User-Agent)
 * Giống message GET_FB_DATA của FewFeeD
 */
async function getFullFacebookData() {
    try {
        // Lấy cookies
        const cookieData = await getFacebookCookies();
        
        if (!cookieData.loggedIn) {
            return {
                success: false,
                error: 'Chưa đăng nhập Facebook',
                loggedIn: false
            };
        }
        
        // Lấy token và fb_dtsg
        const tokenData = await getFacebookToken();
        
        return {
            success: true,
            loggedIn: true,
            uid: cookieData.uid,
            cookieString: cookieData.cookieString,
            accessToken: tokenData.accessToken || null,
            fb_dtsg: tokenData.fb_dtsg || null,
            jazoest: tokenData.jazoest || null,
            lsd: tokenData.lsd || null,
            userAgent: navigator.userAgent
        };
        
    } catch (error) {
        console.error('[Background] Error getting full FB data:', error);
        return {
            success: false,
            error: error.message,
            loggedIn: false
        };
    }
}

/**
 * Get stored auth data
 */
async function getAuthData() {
    return new Promise((resolve) => {
        chrome.storage.local.get([
            CONFIG.STORAGE_KEYS.USER_ID,
            CONFIG.STORAGE_KEYS.USER_NAME,
            CONFIG.STORAGE_KEYS.TEMP_TOKEN,
            CONFIG.STORAGE_KEYS.AUTHENTICATED
        ], (result) => {
            resolve({
                userId: result[CONFIG.STORAGE_KEYS.USER_ID],
                userName: result[CONFIG.STORAGE_KEYS.USER_NAME],
                tempToken: result[CONFIG.STORAGE_KEYS.TEMP_TOKEN],
                authenticated: result[CONFIG.STORAGE_KEYS.AUTHENTICATED] || false
            });
        });
    });
}

/**
 * Save auth data
 */
async function saveAuthData(data) {
    return chrome.storage.local.set({
        [CONFIG.STORAGE_KEYS.USER_ID]: data.userId,
        [CONFIG.STORAGE_KEYS.USER_NAME]: data.userName,
        [CONFIG.STORAGE_KEYS.TEMP_TOKEN]: data.tempToken,
        [CONFIG.STORAGE_KEYS.AUTHENTICATED]: true
    });
}

/**
 * Clear auth data
 */
async function clearAuthData() {
    return chrome.storage.local.remove([
        CONFIG.STORAGE_KEYS.USER_ID,
        CONFIG.STORAGE_KEYS.USER_NAME,
        CONFIG.STORAGE_KEYS.TEMP_TOKEN,
        CONFIG.STORAGE_KEYS.AUTHENTICATED
    ]);
}

// ==============================================
// API FUNCTIONS
// ==============================================

/**
 * Validate auth code và lưu user info
 */
async function validateAuthCode(code) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/extension/validate-auth-code`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Validation failed');
        }
        
        // Save auth data
        await saveAuthData({
            userId: data.userId,
            userName: data.userName,
            tempToken: data.tempToken
        });
        
        // Update badge
        chrome.action.setBadgeText({ text: '✓' });
        chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
        
        console.log('[Background] Auth validated for user:', data.userName);
        
        return {
            success: true,
            userName: data.userName
        };
        
    } catch (error) {
        console.error('[Background] Validation error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Sync Facebook account to backend
 */
async function syncAccount(accountData) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/extension/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uid: accountData.uid,
                name: accountData.name,
                cookies: accountData.cookieString,
                accessToken: accountData.accessToken || null,
                // Thêm tokens cho đăng bài
                fb_dtsg: accountData.fb_dtsg || null,
                jazoest: accountData.jazoest || null,
                lsd: accountData.lsd || null,
                extensionVersion: '1.0.2',
                userId: null
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Sync failed');
        }
        
        // Show success badge
        chrome.action.setBadgeText({ text: '✓' });
        chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
        setTimeout(() => {
            chrome.action.setBadgeText({ text: '' });
        }, 3000);
        
        console.log('[Background] Synced account:', accountData.uid);
        
        return {
            success: true,
            message: data.message
        };
        
    } catch (error) {
        console.error('[Background] Sync error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ==============================================
// MESSAGE HANDLERS
// ==============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Received message:', message.type);
    
    // GET_FB_DATA - Giống FewFeeD: trả về Cookie, Token, fb_dtsg, User-Agent
    if (message.type === 'GET_FB_DATA') {
        getFullFacebookData().then(sendResponse);
        return true;
    }
    
    if (message.type === 'GET_FB_COOKIES') {
        getFacebookCookies().then(sendResponse);
        return true;
    }
    
    if (message.type === 'GET_FB_TOKEN') {
        getFacebookToken().then(sendResponse);
        return true;
    }
    
    // DOM Injection để lấy Access Token
    if (message.type === 'GET_ACCESS_TOKEN_OAUTH') {
        getAccessTokenViaInjection().then(result => {
            sendResponse({ 
                success: result.success && !!result.token, 
                accessToken: result.token,
                fb_dtsg: result.dtsg,
                error: result.error
            });
        });
        return true;
    }
    
    if (message.type === 'VALIDATE_AUTH_CODE') {
        validateAuthCode(message.code).then(sendResponse);
        return true;
    }
    
    if (message.type === 'SYNC_ACCOUNT') {
        syncAccount(message.data).then(sendResponse);
        return true;
    }
    
    if (message.type === 'GET_AUTH_STATUS') {
        getAuthData().then(sendResponse);
        return true;
    }
    
    if (message.type === 'DISCONNECT') {
        clearAuthData().then(() => {
            chrome.action.setBadgeText({ text: '' });
            sendResponse({ success: true });
        });
        return true;
    }
    
    sendResponse({ error: 'Unknown message type' });
});

// ==============================================
// ICON CLICK HANDLER - Mở trang admin
// ==============================================

chrome.action.onClicked.addListener((tab) => {
    console.log('[Background] Icon clicked - opening admin page');
    chrome.tabs.create({
        url: 'http://localhost:3000/admin'
    });
});

// ==============================================
// TAB LISTENER - Phát hiện URL có towblock_connect
// ==============================================

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Chỉ xử lý khi tab đã load xong
    if (changeInfo.status !== 'complete') return;
    if (!tab.url) return;
    
    // Kiểm tra URL Facebook có chứa towblock_connect=1
    try {
        const url = new URL(tab.url);
        
        if (url.hostname.includes('facebook.com')) {
            const towblockConnect = url.searchParams.get('towblock_connect');
            const userId = url.searchParams.get('userId');
            
            if (towblockConnect === '1' && userId) {
                console.log('[Background] ======= DETECTED SYNC URL =======');
                console.log('[Background] Tab ID:', tabId);
                console.log('[Background] URL:', tab.url);
                console.log('[Background] userId:', userId);
                
                // Đánh dấu badge đang xử lý
                chrome.action.setBadgeText({ text: '⏳' });
                chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
            }
        }
    } catch (error) {
        // Ignore invalid URLs
    }
});

// ==============================================
// INSTALLATION
// ==============================================

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[Background] Extension installed');
        chrome.tabs.create({
            url: 'http://localhost:3000/admin'
        });
    }
});

// ==============================================
// COOKIE CHANGE LISTENER
// ==============================================

chrome.cookies.onChanged.addListener((changeInfo) => {
    const { cookie, removed } = changeInfo;
    
    if (cookie.domain.includes('facebook.com') && cookie.name === 'c_user') {
        if (removed) {
            console.log('[Background] Facebook logout detected');
            chrome.action.setBadgeText({ text: '!' });
            chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
        } else {
            console.log('[Background] Facebook login detected');
            chrome.action.setBadgeText({ text: '' });
        }
    }
});

console.log('[Background] Ready');
