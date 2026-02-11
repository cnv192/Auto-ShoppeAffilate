/**
 * INJECT.JS - Runs in page context (facebook.com)
 * 
 * Chức năng:
 * - Capture XHR and Fetch requests to /api/graphql/
 * - Extract doc_id, fb_api_req_friendly_name, và payload
 * - Send dữ liệu về content.js thông qua window.postMessage
 * 
 * Xử lý các kiểu data: JSON, FormData, URLSearchParams
 */

console.log('[Inject] Script injected into page context');

/**
 * Helper: Extract payload từ request body
 * Xử lý các kiểu dữ liệu khác nhau
 * 
 * @param {*} body - Có thể là string, FormData, URLSearchParams, hoặc Blob
 * @returns {Object} - { doc_id, fb_api_req_friendly_name, payload }
 */
function extractPayload(body) {
    if (!body) {
        return { doc_id: null, fb_api_req_friendly_name: null, payload: null };
    }

    let doc_id = null;
    let fb_api_req_friendly_name = null;
    let payload = null;

    try {
        // TYPE 1: String (JSON or URLSearchParams)
        if (typeof body === 'string') {
            // Try JSON first
            try {
                const parsed = JSON.parse(body);
                payload = parsed;
                doc_id = parsed.doc_id || parsed.docId || null;
                fb_api_req_friendly_name = parsed.fb_api_req_friendly_name || null;
                return { doc_id, fb_api_req_friendly_name, payload };
            } catch (e) {
                // Not JSON, try URLSearchParams
                try {
                    const params = new URLSearchParams(body);
                    doc_id = params.get('doc_id') || params.get('docId');
                    fb_api_req_friendly_name = params.get('fb_api_req_friendly_name');
                    payload = {
                        doc_id: doc_id,
                        fb_api_req_friendly_name: fb_api_req_friendly_name
                    };
                    // Try to parse variables if it exists
                    const variables = params.get('variables');
                    if (variables) {
                        try {
                            payload.variables = JSON.parse(variables);
                        } catch (e) {
                            payload.variables = variables;
                        }
                    }
                    return { doc_id, fb_api_req_friendly_name, payload };
                } catch (e) {
                    // Not URLSearchParams either, return raw string
                    return {
                        doc_id: null,
                        fb_api_req_friendly_name: null,
                        payload: { raw: body.substring(0, 100) }
                    };
                }
            }
        }

        // TYPE 2: FormData
        if (body instanceof FormData) {
            doc_id = body.get('doc_id') || body.get('docId');
            fb_api_req_friendly_name = body.get('fb_api_req_friendly_name');
            
            // Extract all form fields
            payload = {};
            for (const [key, value] of body.entries()) {
                if (key === 'variables' || key === 'extensions') {
                    try {
                        payload[key] = JSON.parse(value);
                    } catch (e) {
                        payload[key] = value;
                    }
                } else {
                    payload[key] = value;
                }
            }
            
            return { doc_id, fb_api_req_friendly_name, payload };
        }

        // TYPE 3: URLSearchParams
        if (body instanceof URLSearchParams) {
            doc_id = body.get('doc_id') || body.get('docId');
            fb_api_req_friendly_name = body.get('fb_api_req_friendly_name');
            
            payload = {};
            for (const [key, value] of body.entries()) {
                if (key === 'variables' || key === 'extensions') {
                    try {
                        payload[key] = JSON.parse(value);
                    } catch (e) {
                        payload[key] = value;
                    }
                } else {
                    payload[key] = value;
                }
            }
            
            return { doc_id, fb_api_req_friendly_name, payload };
        }

        // TYPE 4: Blob
        if (body instanceof Blob) {
            console.log('[Inject] Body is Blob, attempting to read...');
            // Blobs can't be synchronously converted, return indication
            return {
                doc_id: null,
                fb_api_req_friendly_name: null,
                payload: { note: 'Body is Blob, async read needed' }
            };
        }

        // TYPE 5: Object (already parsed)
        if (typeof body === 'object') {
            payload = body;
            doc_id = body.doc_id || body.docId || null;
            fb_api_req_friendly_name = body.fb_api_req_friendly_name || null;
            return { doc_id, fb_api_req_friendly_name, payload };
        }

        // Unknown type
        return {
            doc_id: null,
            fb_api_req_friendly_name: null,
            payload: { note: `Unknown body type: ${typeof body}` }
        };

    } catch (error) {
        console.error('[Inject] Error extracting payload:', error);
        return {
            doc_id: null,
            fb_api_req_friendly_name: null,
            payload: { error: error.toString() }
        };
    }
}

/**
 * Override window.fetch
 * Intercept ALL GraphQL API calls (no whitelist)
 * Send every request to content.js, let backend handle deduplication
 */
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const [resource, config] = args;
    const url = typeof resource === 'string' ? resource : resource.url;

    // Intercept ALL POST requests to /api/graphql/ (no operation filtering)
    if (
        url &&
        url.includes('/api/graphql/') &&
        config &&
        (config.method === 'POST' || config.method === undefined)
    ) {
        const body = config.body;
        const extracted = extractPayload(body);

        // Capture ALL operations, even if only one field is present
        // (backend will handle validation and deduplication)
        if (extracted.doc_id || extracted.fb_api_req_friendly_name) {
            console.log('[Inject] 📡 Captured Fetch Request (ALL):', {
                url: url.substring(0, 100),
                doc_id: extracted.doc_id,
                fb_api_req_friendly_name: extracted.fb_api_req_friendly_name
            });

            // Send to content.js via postMessage
            window.postMessage({
                type: 'FACEBOOK_OPERATION_CAPTURED',
                data: {
                    method: 'fetch',
                    url: url,
                    doc_id: extracted.doc_id,
                    fb_api_req_friendly_name: extracted.fb_api_req_friendly_name,
                    payload: extracted.payload,
                    timestamp: new Date().toISOString()
                }
            }, '*');
        }
    }

    // Call original fetch
    return originalFetch.apply(this, args);
};

/**
 * Override XMLHttpRequest
 * Intercept ALL GraphQL API calls via XHR (no whitelist)
 * Send every request to content.js, let backend handle deduplication
 */
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._xhrUrl = url;
    this._xhrMethod = method;
    return originalOpen.apply(this, [method, url, ...rest]);
};

XMLHttpRequest.prototype.send = function(body) {
    const url = this._xhrUrl;
    const method = this._xhrMethod;

    // Intercept ALL POST requests to /api/graphql/ (no operation filtering)
    if (
        url &&
        url.includes('/api/graphql/') &&
        method === 'POST'
    ) {
        const extracted = extractPayload(body);

        // Capture ALL operations, even if only one field is present
        if (extracted.doc_id || extracted.fb_api_req_friendly_name) {
            console.log('[Inject] 📡 Captured XHR Request (ALL):', {
                url: url.substring(0, 100),
                doc_id: extracted.doc_id,
                fb_api_req_friendly_name: extracted.fb_api_req_friendly_name
            });

            // Send to content.js via postMessage
            window.postMessage({
                type: 'FACEBOOK_OPERATION_CAPTURED',
                data: {
                    method: 'xhr',
                    url: url,
                    doc_id: extracted.doc_id,
                    fb_api_req_friendly_name: extracted.fb_api_req_friendly_name,
                    payload: extracted.payload,
                    timestamp: new Date().toISOString()
                }
            }, '*');
        }
    }

    // Call original send
    return originalSend.apply(this, [body]);
};

console.log('[Inject] 🔓 Fetch and XHR interception active (NO WHITELIST - CAPTURING ALL REQUESTS)');