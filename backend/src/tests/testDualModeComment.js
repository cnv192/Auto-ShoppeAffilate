/**
 * Test Dual-Mode Comment Functionality - GRAPHQL VERSION
 * 
 * This file demonstrates the usage of the GraphQL API version of postCommentWithCookie
 * 
 * IMPLEMENTATION:
 * - Endpoint: /api/graphql/
 * - Mutation: useCometUFICreateCommentMutation
 * - Production payload structure
 * - Auto {name} handling for both modes
 * 
 * Run this file with:
 * node backend/src/tests/testDualModeComment.js
 */

const { FacebookAPI } = require('../services/facebookAutomationService');

/**
 * Test configuration
 * IMPORTANT: Replace these values with your actual credentials
 */
const TEST_CONFIG = {
    // Facebook cookie (from browser - must include c_user for User ID extraction)
    cookie: 'YOUR_FACEBOOK_COOKIE_HERE',
    
    // Facebook DTSG token (extracted from cookie or page source)
    fb_dtsg: 'YOUR_FB_DTSG_TOKEN_HERE',
    
    // Test post ID (numeric)
    postId: '123456789',
    
    // Post URL (for group detection - optional but recommended)
    // Examples:
    //   Regular post: 'https://www.facebook.com/user/posts/123456789'
    //   Group post: 'https://www.facebook.com/groups/987654321/posts/123456789'
    postUrl: 'https://www.facebook.com/user/posts/123456789',
    
    // Comment ID to reply to (for Mode B testing)
    commentId: '987654321',
    
    // User name for testing
    targetName: 'Nguyen Van A'
};

/**
 * Test Mode A: Direct Post Comment (GraphQL)
 * {name} will be auto-replaced with "bạn"
 */
async function testModeA() {
    console.log('');
    console.log('='.repeat(60));
    console.log('TEST MODE A: DIRECT POST COMMENT (GraphQL API)');
    console.log('='.repeat(60));
    console.log('');
    console.log('NOTE: Using GraphQL mutation: useCometUFICreateCommentMutation');
    console.log('NOTE: {name} placeholders will be replaced with "bạn"');
    console.log('');
    
    const fbAPI = new FacebookAPI(null, TEST_CONFIG.cookie);
    
    // Test with {name} placeholder - will be auto-replaced
    const result = await fbAPI.postCommentWithCookie(
        TEST_CONFIG.postId,
        'Xin chào {name}! Đây là test GraphQL Mode A 🚀',
        TEST_CONFIG.fb_dtsg,
        {
            postUrl: TEST_CONFIG.postUrl  // Pass URL for group detection
        }
    );
    
    console.log('');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('');
    console.log('Expected: {name} replaced with "bạn"');
    console.log('Expected: GraphQL response with comment ID');
    console.log('');
    
    return result;
}

/**
 * Test Mode B: Reply to Comment (Simple - GraphQL)
 */
async function testModeBSimple() {
    console.log('');
    console.log('='.repeat(60));
    console.log('TEST MODE B: REPLY TO COMMENT (Simple - GraphQL)');
    console.log('='.repeat(60));
    console.log('');
    
    const fbAPI = new FacebookAPI(null, TEST_CONFIG.cookie);
    
    const result = await fbAPI.postCommentWithCookie(
        TEST_CONFIG.postId,
        'Thank you for your comment!',
        TEST_CONFIG.fb_dtsg,
        {
            postUrl: TEST_CONFIG.postUrl,
            parentCommentId: TEST_CONFIG.commentId
        }
    );
    
    console.log('');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('Expected: Reply posted as nested comment via GraphQL');
    console.log('');
    
    return result;
}

/**
 * Test Mode B: Reply to Comment (with name substitution - GraphQL)
 */
async function testModeBWithName() {
    console.log('');
    console.log('='.repeat(60));
    console.log('TEST MODE B: REPLY TO COMMENT (With Name - GraphQL)');
    console.log('='.repeat(60));
    console.log('');
    
    const fbAPI = new FacebookAPI(null, TEST_CONFIG.cookie);
    
    const result = await fbAPI.postCommentWithCookie(
        TEST_CONFIG.postId,
        'Xin chào {name}! Cảm ơn bạn đã quan tâm đến sản phẩm. 😊',
        TEST_CONFIG.fb_dtsg,
        {
            postUrl: TEST_CONFIG.postUrl,
            parentCommentId: TEST_CONFIG.commentId,
            targetName: TEST_CONFIG.targetName
        }
    );
    
    console.log('');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('Expected: {name} replaced with "' + TEST_CONFIG.targetName + '"');
    console.log('');
    
    return result;
}

/**
 * Test Mode B: Multiple name placeholders (GraphQL)
 */
async function testModeBMultipleNames() {
    console.log('');
    console.log('='.repeat(60));
    console.log('TEST MODE B: MULTIPLE NAME PLACEHOLDERS (GraphQL)');
    console.log('='.repeat(60));
    console.log('');
    
    const fbAPI = new FacebookAPI(null, TEST_CONFIG.cookie);
    
    const result = await fbAPI.postCommentWithCookie(
        TEST_CONFIG.postId,
        'Chào {name}! Rất vui được gặp bạn {name}. Hy vọng {name} sẽ hài lòng! 🎉',
        TEST_CONFIG.fb_dtsg,
        {
            postUrl: TEST_CONFIG.postUrl,
            parentCommentId: TEST_CONFIG.commentId,
            targetName: TEST_CONFIG.targetName
        }
    );
    
    console.log('');
    console.log('Result:', JSON.stringify(result, null, 2));
    console.log('Expected: All {name} replaced with "' + TEST_CONFIG.targetName + '"');
    console.log('');
    
    return result;
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' '.repeat(5) + 'DUAL-MODE COMMENT TESTING SUITE (GraphQL API)' + ' '.repeat(7) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
    console.log('');
    console.log('Endpoint: https://www.facebook.com/api/graphql/');
    console.log('Mutation: useCometUFICreateCommentMutation');
    console.log('Doc ID: 33815332361398625');
    console.log('');
    
    // Validation
    if (TEST_CONFIG.cookie === 'YOUR_FACEBOOK_COOKIE_HERE') {
        console.error('');
        console.error('❌ ERROR: Please configure TEST_CONFIG with your actual credentials');
        console.error('   Edit this file and replace the placeholder values');
        console.error('   Required: cookie (with c_user), fb_dtsg, postId, commentId');
        console.error('');
        process.exit(1);
    }
    
    try {
        // Test Mode A
        const resultA = await testModeA();
        
        // Wait 3 seconds between tests
        console.log('⏳ Waiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test Mode B Simple
        const resultBSimple = await testModeBSimple();
        
        // Wait 3 seconds
        console.log('⏳ Waiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test Mode B with Name
        const resultBName = await testModeBWithName();
        
        // Wait 3 seconds
        console.log('⏳ Waiting 3 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test Mode B Multiple Names
        const resultBMultiple = await testModeBMultipleNames();
        
        // Summary
        console.log('');
        console.log('='.repeat(60));
        console.log('TEST SUMMARY');
        console.log('='.repeat(60));
        console.log('');
        console.log(`Mode A (Direct Comment):          ${resultA.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Mode B (Simple Reply):            ${resultBSimple.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Mode B (With Name):               ${resultBName.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Mode B (Multiple Names):          ${resultBMultiple.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log('');
        
        const allPassed = resultA.success && resultBSimple.success && resultBName.success && resultBMultiple.success;
        
        if (allPassed) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️  Some tests failed. Check the results above.');
        }
        
    } catch (error) {
        console.error('');
        console.error('❌ Test execution failed:');
        console.error(error);
        console.error('');
        process.exit(1);
    }
}

// Run tests if executed directly
if (require.main === module) {
    runAllTests();
}

module.exports = {
    testModeA,
    testModeBSimple,
    testModeBWithName,
    testModeBMultipleNames,
    runAllTests
};
