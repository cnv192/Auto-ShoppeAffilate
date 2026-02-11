/**
 * CONTENT.JS - Bridge between inject.js (page context) and background.js
 * 
 * Chức năng:
 * - Lắng nghe messages từ inject.js (page context)
 * - Relay messages về background.js thông qua chrome.runtime.sendMessage
 * - Xử lý errors một cách tường minh
 * - CRITICAL: Handle "Extension context invalidated" gracefully
 */

console.log('[Content.js] Content script loaded');

/**
 * Validate extension context is still valid
 * Returns true if chrome.runtime is accessible
 */
function isExtensionContextValid() {
    try {
        // Try to access chrome.runtime - if it's invalid, this will throw
        void chrome.runtime;
        return true;
    } catch (e) {
        console.error('[Content.js] Extension context invalidated:', e.message);
        return false;
    }
}

/**
 * Listen to messages từ inject.js (page context)
 * Forward them to background.js with proper error handling
 */
window.addEventListener('message', function(event) {
    // Chỉ nhận từ same origin
    if (event.source !== window) return;

    // Relay messages về background script
    if (event.data && event.data.type === 'FACEBOOK_OPERATION_CAPTURED') {
        console.log('[Content.js] Captured operation from inject.js:', {
            type: event.data.type,
            docId: event.data.data?.doc_id,
            friendlyName: event.data.data?.fb_api_req_friendly_name,
            timestamp: event.data.data?.timestamp
        });

        // CRITICAL: Check if extension context is still valid before sending
        if (!isExtensionContextValid()) {
            console.error('[Content.js] Cannot relay - extension context invalidated');
            return;
        }

        try {
            // Send to background script with error handling
            chrome.runtime.sendMessage(
                {
                    type: 'FACEBOOK_OPERATION_CAPTURED',
                    data: event.data.data
                },
                (response) => {
                    // CRITICAL: Check if extension context is still valid in callback
                    if (!isExtensionContextValid()) {
                        console.error('[Content.js] Callback - extension context invalidated');
                        return;
                    }

                    // Check for errors EXPLICITLY
                    if (chrome.runtime.lastError) {
                        // Log the actual error message, not the object
                        console.error(
                            '[Content.js] Runtime error:',
                            chrome.runtime.lastError.message
                        );
                    } else {
                        if (response && response.success) {
                            console.log('[Content.js] Message relayed successfully to background:', {
                                message: response.message,
                                docId: response.docId
                            });
                        } else {
                            console.warn('[Content.js] Background returned:', response);
                        }
                    }
                }
            );
        } catch (error) {
            // Catch synchronous errors (e.g., "Extension context invalidated")
            console.error('[Content.js] SendMessage error:', error.message);
        }
    }
}, false);

console.log('[Content.js] Ready to relay messages from inject.js to background.js');
