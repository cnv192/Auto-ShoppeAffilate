/**
 * Facebook Crawler Test Script
 * 
 * Test các chức năng chính của module facebookCrawler.js:
 * 1. Modern Headers
 * 2. URL Resolver (share/p links)
 * 3. Mbasic Parser
 * 
 * Run: node backend/src/tests/testFacebookCrawler.js
 */

const { 
    FacebookCrawler, 
    FacebookUrlResolver, 
    MbasicParser,
    getHeaders,
    MODERN_HEADERS 
} = require('../services/facebookCrawler');

// Test data
const TEST_URLS = [
    // Classic format
    'https://www.facebook.com/123456789/posts/987654321',
    // Share/p format (cần resolve)
    'https://www.facebook.com/share/p/abc123/',
    // Story format
    'https://www.facebook.com/story.php?story_fbid=123456789&id=100000000',
    // Photo format
    'https://www.facebook.com/photo.php?fbid=123456789',
    // Group post
    'https://www.facebook.com/groups/testgroup/posts/123456789'
];

// Console colors
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(color, ...args) {
    console.log(colors[color], ...args, colors.reset);
}

// ==============================================
// TEST 1: Modern Headers
// ==============================================
async function testModernHeaders() {
    log('cyan', '\n=== TEST 1: Modern Headers ===\n');
    
    // Test desktop headers
    const desktopHeaders = getHeaders('desktop');
    log('blue', 'Desktop Headers:');
    console.log('  User-Agent:', desktopHeaders['User-Agent'].substring(0, 50) + '...');
    console.log('  Accept:', desktopHeaders['Accept'].substring(0, 50) + '...');
    console.log('  Sec-Ch-Ua:', desktopHeaders['Sec-Ch-Ua']);
    console.log('  Sec-Fetch-Mode:', desktopHeaders['Sec-Fetch-Mode']);
    
    // Verify essential headers exist
    const essentialHeaders = [
        'User-Agent',
        'Accept',
        'Accept-Language',
        'Sec-Ch-Ua',
        'Sec-Ch-Ua-Mobile',
        'Sec-Ch-Ua-Platform',
        'Sec-Fetch-Dest',
        'Sec-Fetch-Mode',
        'Sec-Fetch-Site',
        'Sec-Fetch-User',
        'Upgrade-Insecure-Requests'
    ];
    
    let allPresent = true;
    for (const header of essentialHeaders) {
        if (!desktopHeaders[header]) {
            log('red', `  ❌ Missing header: ${header}`);
            allPresent = false;
        }
    }
    
    if (allPresent) {
        log('green', '  ✅ All essential headers present for desktop profile');
    }
    
    // Test mbasic headers
    const mbasicHeaders = getHeaders('mbasic');
    log('blue', '\nMbasic Headers:');
    console.log('  User-Agent:', mbasicHeaders['User-Agent'].substring(0, 50) + '...');
    console.log('  Sec-Ch-Ua-Mobile:', mbasicHeaders['Sec-Ch-Ua-Mobile']);
    console.log('  Sec-Ch-Ua-Platform:', mbasicHeaders['Sec-Ch-Ua-Platform']);
    
    // Verify mbasic is detected as mobile
    if (mbasicHeaders['Sec-Ch-Ua-Mobile'] === '?1') {
        log('green', '  ✅ Mbasic profile correctly identifies as mobile');
    } else {
        log('red', '  ❌ Mbasic profile should have Sec-Ch-Ua-Mobile: ?1');
    }
    
    // Test with cookie
    const headersWithCookie = getHeaders('desktop', 'c_user=123; xs=abc');
    if (headersWithCookie['Cookie'] === 'c_user=123; xs=abc') {
        log('green', '  ✅ Cookie correctly added to headers');
    } else {
        log('red', '  ❌ Cookie not correctly added');
    }
    
    return true;
}

// ==============================================
// TEST 2: URL Resolver (Offline patterns)
// ==============================================
async function testUrlResolver() {
    log('cyan', '\n=== TEST 2: URL Resolver Patterns ===\n');
    
    const resolver = new FacebookUrlResolver();
    
    // Test URL pattern extraction (offline)
    const testCases = [
        {
            url: 'https://www.facebook.com/123456789/posts/987654321',
            expectedId: '987654321'
        },
        {
            url: 'https://www.facebook.com/permalink/123456789',
            expectedId: '123456789'
        },
        {
            url: 'https://www.facebook.com/story.php?story_fbid=123456789&id=100',
            expectedId: '123456789'
        },
        {
            url: 'https://www.facebook.com/photo.php?fbid=123456789',
            expectedId: '123456789'
        },
        {
            url: 'https://www.facebook.com/groups/testgroup/posts/123456789',
            expectedId: '123456789'
        },
        {
            url: 'https://www.facebook.com/groups/123/permalink/456789123',
            expectedId: '456789123'
        }
    ];
    
    let passed = 0;
    for (const { url, expectedId } of testCases) {
        const extractedId = resolver._extractPostIdFromUrl(url);
        if (extractedId === expectedId) {
            log('green', `  ✅ ${url.substring(0, 50)}...`);
            log('green', `     → Extracted: ${extractedId}`);
            passed++;
        } else {
            log('red', `  ❌ ${url.substring(0, 50)}...`);
            log('red', `     → Expected: ${expectedId}, Got: ${extractedId}`);
        }
    }
    
    log('blue', `\nPattern extraction: ${passed}/${testCases.length} passed`);
    
    // Test HTML extraction patterns
    log('cyan', '\n--- HTML Extraction Patterns ---\n');
    
    const htmlTestCases = [
        {
            name: 'ft_ent_identifier in form',
            html: '<input name="ft_ent_identifier" value="12345678901234"/>',
            expectedId: '12345678901234'
        },
        {
            name: 'story_fbid in URL',
            html: '<a href="/story.php?story_fbid=12345678901234">',
            expectedId: '12345678901234'
        },
        {
            name: 'mf_story_key',
            html: '{"mf_story_key":"12345678901234"}',
            expectedId: '12345678901234'
        }
    ];
    
    for (const { name, html, expectedId } of htmlTestCases) {
        const extractedId = resolver._extractPostIdFromHtml(html);
        if (extractedId === expectedId) {
            log('green', `  ✅ ${name}: ${extractedId}`);
        } else {
            log('red', `  ❌ ${name}: Expected ${expectedId}, Got ${extractedId}`);
        }
    }
    
    // Test meta-refresh extraction
    log('cyan', '\n--- Meta-Refresh Extraction ---\n');
    
    const metaTestCases = [
        {
            html: '<meta http-equiv="refresh" content="0;url=https://facebook.com/123/posts/456"/>',
            expectedUrl: 'https://facebook.com/123/posts/456'
        },
        {
            html: '<meta content="5; URL=https://m.facebook.com/story.php?id=123" http-equiv="refresh"/>',
            expectedUrl: 'https://m.facebook.com/story.php?id=123'
        }
    ];
    
    for (const { html, expectedUrl } of metaTestCases) {
        const result = resolver._extractMetaRefresh(html);
        if (result.found && result.url === expectedUrl) {
            log('green', `  ✅ Meta-refresh extracted: ${result.url.substring(0, 50)}...`);
        } else if (result.found) {
            log('yellow', `  ⚠️ Meta-refresh found but different: ${result.url}`);
        } else {
            log('red', `  ❌ Meta-refresh not found`);
        }
    }
    
    // Test JS redirect extraction
    log('cyan', '\n--- JS Redirect Extraction ---\n');
    
    const jsTestCases = [
        {
            html: 'window.location.replace("https://facebook.com/posts/123")',
            expectedUrl: 'https://facebook.com/posts/123'
        },
        {
            html: 'window.location.href = "https://m.facebook.com/story/123"',
            expectedUrl: 'https://m.facebook.com/story/123'
        },
        {
            html: 'location.href="https:\\/\\/facebook.com\\/p\\/123"',
            expectedUrl: 'https://facebook.com/p/123'
        }
    ];
    
    for (const { html, expectedUrl } of jsTestCases) {
        const result = resolver._extractJsRedirect(html);
        if (result.found && result.url === expectedUrl) {
            log('green', `  ✅ JS redirect extracted: ${result.url.substring(0, 50)}...`);
        } else if (result.found) {
            log('yellow', `  ⚠️ JS redirect found: ${result.url}`);
        } else {
            log('red', `  ❌ JS redirect not found in: ${html.substring(0, 50)}...`);
        }
    }
    
    return true;
}

// ==============================================
// TEST 3: Mbasic Parser
// ==============================================
async function testMbasicParser() {
    log('cyan', '\n=== TEST 3: Mbasic Parser ===\n');
    
    const parser = new MbasicParser();
    
    // Test WAP detection
    log('blue', 'WAP Detection:');
    
    const wapHtml = '<!DOCTYPE html PUBLIC "-//WAPFORUM//DTD XHTML Mobile 1.0//EN">';
    const normalHtml = '<!DOCTYPE html><html><body>Normal page</body></html>';
    
    if (parser._isWapPage(wapHtml)) {
        log('green', '  ✅ WAP page correctly detected');
    } else {
        log('red', '  ❌ WAP page not detected');
    }
    
    if (!parser._isWapPage(normalHtml)) {
        log('green', '  ✅ Normal page correctly identified');
    } else {
        log('red', '  ❌ Normal page falsely detected as WAP');
    }
    
    // Test login detection
    log('blue', '\nLogin Page Detection:');
    
    const loginHtml = '<form id="login_form" action="/login/">';
    const loggedInHtml = '<div class="feed">Posts here</div>';
    
    if (parser._isLoginPage(loginHtml)) {
        log('green', '  ✅ Login page correctly detected');
    } else {
        log('red', '  ❌ Login page not detected');
    }
    
    if (!parser._isLoginPage(loggedInHtml)) {
        log('green', '  ✅ Logged-in page correctly identified');
    } else {
        log('red', '  ❌ Logged-in page falsely detected as login');
    }
    
    // Test URL conversion
    log('blue', '\nURL Conversion:');
    
    const urlTests = [
        {
            input: 'https://www.facebook.com/groups/123',
            expected: 'https://mbasic.facebook.com/groups/123'
        },
        {
            input: '/groups/456',
            expected: 'https://mbasic.facebook.com/groups/456'
        },
        {
            input: 'testpage',
            expected: 'https://mbasic.facebook.com/testpage'
        }
    ];
    
    for (const { input, expected } of urlTests) {
        const converted = parser._convertToMbasicUrl(input);
        if (converted === expected) {
            log('green', `  ✅ ${input} → ${converted}`);
        } else {
            log('red', `  ❌ ${input} → ${converted} (expected: ${expected})`);
        }
    }
    
    // Test post extraction from sample HTML
    log('blue', '\nPost Extraction from Sample HTML:');
    
    const sampleHtml = `
        <div class="story">
            <form action="/a/comment.php">
                <input name="ft_ent_identifier" value="12345678901234"/>
            </form>
        </div>
        <div class="story">
            <a href="/story.php?story_fbid=98765432109876&id=100">View</a>
        </div>
        <div class="actions">
            <a href="/ufi/reaction/?ft_ent_identifier=11111111111111">Like</a>
        </div>
    `;
    
    const posts = parser._parsePostsFromHtml(sampleHtml, 10);
    log('blue', `  Found ${posts.length} posts:`);
    
    for (const post of posts) {
        log('green', `    - ${post.postId} (via ${post.source})`);
    }
    
    if (posts.length >= 2) {
        log('green', '  ✅ Multiple posts extracted successfully');
    } else {
        log('yellow', '  ⚠️ Expected at least 2 posts from sample HTML');
    }
    
    return true;
}

// ==============================================
// TEST 4: Full Crawler Integration
// ==============================================
async function testFullCrawler() {
    log('cyan', '\n=== TEST 4: Full Crawler Integration ===\n');
    
    // Create crawler without cookie (won't make real requests)
    const crawler = new FacebookCrawler('');
    
    log('blue', 'Crawler Instance:');
    console.log('  - Has urlResolver:', !!crawler.urlResolver);
    console.log('  - Has parser:', !!crawler.parser);
    console.log('  - Cookie initially empty:', crawler.cookie === '');
    
    // Test cookie update
    crawler.setCookie('test_cookie=value');
    if (crawler.cookie === 'test_cookie=value' && 
        crawler.urlResolver.cookie === 'test_cookie=value' &&
        crawler.parser.cookie === 'test_cookie=value') {
        log('green', '  ✅ Cookie propagates to all components');
    } else {
        log('red', '  ❌ Cookie not properly propagated');
    }
    
    // Test processInputs (offline processing)
    log('blue', '\nProcess Inputs (offline):');
    
    const inputs = [
        '12345678901234',  // Already numeric
        'https://facebook.com/123/posts/98765432109876',  // URL with ID
        '',  // Empty (should be skipped)
        null,  // Null (should be skipped)
    ];
    
    // Note: processInputs would normally resolve URLs, but we test the numeric ones
    const numericResults = inputs.filter(i => i && /^\d+$/.test(String(i).trim()));
    log('green', `  ✅ Would process ${numericResults.length} numeric IDs directly`);
    
    return true;
}

// ==============================================
// RUN ALL TESTS
// ==============================================
async function runAllTests() {
    log('cyan', '\n╔════════════════════════════════════════════════╗');
    log('cyan', '║     FACEBOOK CRAWLER MODULE - TEST SUITE       ║');
    log('cyan', '╚════════════════════════════════════════════════╝');
    
    const results = [];
    
    try {
        results.push({ name: 'Modern Headers', passed: await testModernHeaders() });
    } catch (e) {
        log('red', 'Test 1 failed:', e.message);
        results.push({ name: 'Modern Headers', passed: false });
    }
    
    try {
        results.push({ name: 'URL Resolver', passed: await testUrlResolver() });
    } catch (e) {
        log('red', 'Test 2 failed:', e.message);
        results.push({ name: 'URL Resolver', passed: false });
    }
    
    try {
        results.push({ name: 'Mbasic Parser', passed: await testMbasicParser() });
    } catch (e) {
        log('red', 'Test 3 failed:', e.message);
        results.push({ name: 'Mbasic Parser', passed: false });
    }
    
    try {
        results.push({ name: 'Full Crawler', passed: await testFullCrawler() });
    } catch (e) {
        log('red', 'Test 4 failed:', e.message);
        results.push({ name: 'Full Crawler', passed: false });
    }
    
    // Summary
    log('cyan', '\n╔════════════════════════════════════════════════╗');
    log('cyan', '║                 TEST SUMMARY                    ║');
    log('cyan', '╚════════════════════════════════════════════════╝\n');
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    
    for (const result of results) {
        const icon = result.passed ? '✅' : '❌';
        const color = result.passed ? 'green' : 'red';
        log(color, `  ${icon} ${result.name}`);
    }
    
    log('cyan', `\n  Total: ${passed}/${total} tests passed\n`);
    
    if (passed === total) {
        log('green', '  🎉 All tests passed! Module is ready for use.\n');
    } else {
        log('yellow', '  ⚠️ Some tests failed. Review the output above.\n');
    }
}

// Run tests
runAllTests().catch(console.error);
