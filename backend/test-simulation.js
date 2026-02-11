/**
 * Test Simulation with Behavioral Operations
 * 
 * Mô phỏng hành vi người dùng thực tế bằng cách:
 * 1. Lấy 9 bước chính từ automationService
 * 2. Load danh sách Behavioral Operations từ DB (các doc_id capture được từ extension)
 * 3. Xen kẽ các behavioral operations ngẫu nhiên vào giữa 9 bước để đánh lừa AI Facebook
 * 
 * Behavioral Operations: Comment, Like, Scroll, Typing, etc (priority: high/medium)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const FacebookOperation = require('./src/models/FacebookOperation');

// ================= CẤU HÌNH TEST =================
const TEST_CONFIG = {
    facebookId: '100092563005307',
    cookie: 'c_user=100092563005307; xs=30:_uvCeMo8W9gHhA:2:1768452860:-1:-1::AcxAw3EBmchVAEphhSfP7cuH8a0KhH7-2523V0GdmLA; wd=1920x1080;',
    fb_dtsg: 'NAfu4WYNuAdaRljyT_GuwDuYOA94wjknLGkxO1VN7_ATTtZb2FYZoOA:30:1768452860',
    targetPostId: 'pfbid02ohEj2bz2VeUSjAwT6v8ukbo7Kghobk9qguDQ8rFqz43TuTK69uxaYH7MdwSteMe8l',
    message: 'Test comment auto with behavioral operations - ' + new Date().toLocaleTimeString()
};

// ================= KẾT NỐI DATABASE =================
async function connectDB() {
    try {
        const dbUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/shopee_affiliate_db';
        await mongoose.connect(dbUrl);
        console.log('✅ Đã kết nối MongoDB');
    } catch (err) {
        console.error('❌ Lỗi kết nối DB:', err.message);
        process.exit(1);
    }
}

// ================= LOAD BEHAVIORAL OPERATIONS =================
/**
 * Load tất cả high/medium priority operations từ DB
 * Các operations này sẽ được xen kẽ vào giữa 9 bước chính
 */
async function loadBehavioralOperations() {
    try {
        const operations = await FacebookOperation.find({
            status: 'active',
            priority: { $in: ['high', 'medium'] }
        }).select('friendlyName docId priority');

        console.log(`\n📚 Loaded ${operations.length} behavioral operations (HIGH/MEDIUM):`);
        operations.forEach((op) => {
            console.log(`   - ${op.friendlyName} (${op.priority}) = ${op.docId.substring(0, 10)}...`);
        });

        return operations;
    } catch (error) {
        console.error('❌ Lỗi load behavioral operations:', error.message);
        return [];
    }
}

/**
 * Load tất cả low priority operations từ DB
 * Ví dụ: RefetchQuery, Logger, Analytics
 * Các operations này sẽ được inject xen kẽ để tạo traffic giống người dùng lướt Facebook lung tung
 */
async function loadLowPriorityOperations() {
    try {
        const operations = await FacebookOperation.find({
            status: 'active',
            priority: 'low'
        }).select('friendlyName docId priority');

        console.log(`\n📋 Loaded ${operations.length} low-priority operations (casual browsing):`);
        if (operations.length > 0) {
            operations.slice(0, 5).forEach((op) => {
                console.log(`   - ${op.friendlyName} = ${op.docId.substring(0, 10)}...`);
            });
            if (operations.length > 5) {
                console.log(`   ... và ${operations.length - 5} operations khác`);
            }
        }

        return operations;
    } catch (error) {
        console.error('❌ Lỗi load low-priority operations:', error.message);
        return [];
    }
}

// ================= HÀM TẠO BẢO VỆ =================
/**
 * Tạo một "behavioral injection" - gửi request với behavioral operation
 * Này để đánh lừa Facebook rằng tài khoản đang hoạt động như người thật
 */
async function simulateBehavioralOperation(account, operation, randomDelay = true) {
    const delay = randomDelay ? Math.random() * 3000 + 1000 : 1000; // 1-4 seconds
    
    console.log(`   🔹 ${delay.toFixed(0)}ms wait...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    console.log(`   🧬 Behavioral: ${operation.friendlyName} [${operation.priority}]`);
    
    // Simulate sending the behavioral operation
    // In reality, this would be part of the automation flow
    try {
        // Mock behavioral operation execution
        const mockResponse = {
            success: true,
            operation: operation.friendlyName,
            docId: operation.docId,
            timestamp: new Date().toISOString()
        };
        
        console.log(`      ✅ Simulated: ${operation.friendlyName}`);
        return mockResponse;
    } catch (error) {
        console.error(`      ❌ Failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Lấy ngẫu nhiên behavioral operations từ danh sách
 */
function getRandomBehavioralOperations(operations, count = 2) {
    const selected = [];
    for (let i = 0; i < count && operations.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * operations.length);
        selected.push(operations[randomIndex]);
        // Remove selected one to avoid duplicate
        operations.splice(randomIndex, 1);
    }
    return selected;
}

/**
 * Inject Random Low-Priority Operations
 * 
 * Lấy ngẫu nhiên 1-2 low-priority operations (RefetchQuery, Logger, Analytics, etc)
 * và giả lập người dùng đang lướt Facebook lung tung trước khi comment
 * 
 * Mục đích: Làm cho traffic từ bot trông giống hệt một người dùng thực
 */
async function injectRandomBehavior(account, lowPriorityOps) {
    if (lowPriorityOps.length === 0) {
        console.log(`      ⏭️  No low-priority operations available`);
        return { injected: 0 };
    }

    // Random: 30% chance to inject 1-2 random low-priority ops
    const shouldInject = Math.random() > 0.7;
    if (!shouldInject) {
        return { injected: 0 };
    }

    const injectCount = Math.random() > 0.6 ? 1 : 2;
    const opsToInject = [];
    
    // Copy array to avoid mutation
    const opsCopy = [...lowPriorityOps];
    for (let i = 0; i < injectCount && opsCopy.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * opsCopy.length);
        opsToInject.push(opsCopy[randomIndex]);
        opsCopy.splice(randomIndex, 1);
    }

    let injectedCount = 0;
    for (const op of opsToInject) {
        // Random delay between injections (500-2000ms)
        const delay = Math.random() * 1500 + 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log(`      🌀 Random casual: ${op.friendlyName} (low-priority)`);
        injectedCount++;
    }

    return { injected: injectedCount };
}

// ================= HÀM GIẢI LẬP 9 BƯỚC VỚI BEHAVIORAL INJECTIONS =================
/**
 * Giả lập 9 bước từ automationService với:
 * 1. Behavioral injections (high/medium priority) tại các điểm chính (steps 2,4,6,8)
 * 2. Random casual browsing (low-priority) giữa các bước 1-7 để tạo natural traffic
 * 
 * Flow:
 * - Step 1-7: Có thể inject low-priority ops bất kỳ lúc nào (30% chance per step)
 * - Step 2,4,6,8: Chắc chắn inject 1-2 high/medium priority ops
 * - Step 8-9: Hoàn tất process
 */
async function runSimulationWith9Steps(account, postData, message, behavioralOps, lowPriorityOps) {
    console.log('\n🎬 BẮT ĐẦU GIẢI LẬP 9 BƯỚC VỚI BEHAVIORAL INJECTIONS:');
    console.log('='.repeat(60));

    const steps = [
        { name: 'Step 1: Initialize', delay: 1000 },
        { name: 'Step 2: Load page DOM', delay: 1500 },
        { name: 'Step 3: Fetch post context', delay: 1200 },
        { name: 'Step 4: Generate mutation ID', delay: 800 },
        { name: 'Step 5: Build request payload', delay: 1000 },
        { name: 'Step 6: Execute GraphQL mutation', delay: 2000 },
        { name: 'Step 7: Validate response', delay: 1000 },
        { name: 'Step 8: Process success', delay: 500 },
        { name: 'Step 9: Cleanup', delay: 800 }
    ];

    let completedSteps = 0;
    let totalLowPriorityInjected = 0;
    let totalHighPriorityInjected = 0;

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`\n${step.name}`);
        await new Promise(resolve => setTimeout(resolve, step.delay));
        completedSteps++;

        // Steps 1-7: Inject random low-priority operations (casual browsing)
        if (i < 7) {
            const lowPriorityResult = await injectRandomBehavior(account, lowPriorityOps);
            totalLowPriorityInjected += lowPriorityResult.injected;
        }

        // Steps 2, 4, 6, 8: Inject 1-2 high/medium priority behavioral operations
        if ([2, 4, 6, 8].includes(i + 1) && behavioralOps.length > 0) {
            const injectCount = Math.random() > 0.5 ? 1 : 2;
            const selectedOps = getRandomBehavioralOperations(behavioralOps, injectCount);
            
            for (const op of selectedOps) {
                await simulateBehavioralOperation(account, op);
                totalHighPriorityInjected++;
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Hoàn thành tất cả ${completedSteps} bước`);
    console.log(`   ├─ High/Medium priority injections: ${totalHighPriorityInjected}`);
    console.log(`   └─ Low-priority casual browsing: ${totalLowPriorityInjected}`);
    
    return {
        success: true,
        completedSteps: completedSteps,
        highPriorityInjections: totalHighPriorityInjected,
        lowPriorityInjections: totalLowPriorityInjected,
        totalOperations: completedSteps + totalHighPriorityInjected + totalLowPriorityInjected
    };
}

// ================= HÀM CHẠY TEST =================
async function runTest() {
    await connectDB();

    console.log('\n🚀 TEST SYSTEM SIMULATION WITH BEHAVIORAL OPERATIONS');
    console.log('='.repeat(70));

    // Tài khoản test
    const account = {
        facebookId: TEST_CONFIG.facebookId,
        cookie: TEST_CONFIG.cookie,
        fb_dtsg: TEST_CONFIG.fb_dtsg,
        browserFingerprint: {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            secChUaPlatform: '"Windows"',
            platform: 'Windows',
            mobile: false
        }
    };

    // Dữ liệu bài viết
    const feedbackString = `feedback:${TEST_CONFIG.targetPostId}`;
    const feedbackIdBase64 = Buffer.from(feedbackString).toString('base64');
    const postData = {
        postId: TEST_CONFIG.targetPostId,
        storyId: TEST_CONFIG.targetPostId,
        feedbackId: feedbackIdBase64
    };

    try {
        // BƯỚC 1: Load behavioral operations từ DB (high/medium priority)
        let behavioralOps = await loadBehavioralOperations();
        
        // BƯỚC 2: Load low-priority operations từ DB (casual browsing)
        let lowPriorityOps = await loadLowPriorityOperations();
        
        if (behavioralOps.length === 0 && lowPriorityOps.length === 0) {
            console.log('\n⚠️  CẢNH BÁO: Chưa có operations trong DB');
            console.log('👉 Hãy chạy extension trên Facebook để capture doc_ids trước');
            console.log('   Hoặc sử dụng sample data để test\n');
            
            // Create some sample operations for testing
            const sampleOps = [
                { friendlyName: 'CometUFICreateCommentMutation', priority: 'high' },
                { friendlyName: 'CometUFILiveTypingBroadcastMutation_StartMutation', priority: 'high' },
                { friendlyName: 'CometUFILiveTypingBroadcastMutation_StopMutation', priority: 'high' },
                { friendlyName: 'CometNewsFeedPaginationQuery', priority: 'medium' },
                { friendlyName: 'StoriesTrayRectangularQuery', priority: 'medium' }
            ];
            
            const sampleLowOps = [
                { friendlyName: 'ViewerFeedRefetchQuery', priority: 'low' },
                { friendlyName: 'FBClientAnalyticsLogger', priority: 'low' },
                { friendlyName: 'GraphQLSubscription_Refetch', priority: 'low' },
                { friendlyName: 'FeedDebugInfoQuery', priority: 'low' },
                { friendlyName: 'LiveVideoPollingQuery', priority: 'low' }
            ];
            
            console.log('Using sample operations for simulation...\n');
            behavioralOps = sampleOps.map(op => ({
                ...op,
                docId: Math.random().toString().substring(2, 20)
            }));
            lowPriorityOps = sampleLowOps.map(op => ({
                ...op,
                docId: Math.random().toString().substring(2, 20)
            }));
        }

        // BƯỚC 3: Chạy 9 bước giải lập với behavioral injections
        const result = await runSimulationWith9Steps(
            account,
            postData,
            TEST_CONFIG.message,
            [...behavioralOps],      // Copy array to avoid mutation
            [...lowPriorityOps]       // Copy array for casual browsing injections
        );

        // BƯỚC 4: Hiển thị kết quả chi tiết
        console.log('\n📊 KẾT QUẢ CHI TIẾT:');
        console.log('-'.repeat(70));
        console.log(`✅ Main steps completed: ${result.completedSteps}`);
        console.log(`🧬 High/Medium priority behavioral: ${result.highPriorityInjections}`);
        console.log(`🌀 Low-priority casual browsing: ${result.lowPriorityInjections}`);
        console.log(`📚 TOTAL operations executed: ${result.totalOperations}`);
        console.log('-'.repeat(70));
        
        console.log('\n💡 PHÂN TÍCH TRAFFIC:');
        console.log('1. ✅ 9 bước chính (main actions)');
        console.log(`2. ✅ ${result.highPriorityInjections} behavioral operations (high/medium priority)`);
        console.log(`3. ✅ ${result.lowPriorityInjections} casual browsing operations (low-priority)`);
        console.log(`4. 🎯 Tổng cộng: ${result.totalOperations} operations`);
        console.log(`\n📈 Traffic Pattern: ${((result.lowPriorityInjections / result.totalOperations) * 100).toFixed(1)}% casual browsing`);
        console.log('   → Giống hệt một người dùng thực lướt Facebook lung tung trước khi comment!\n');

    } catch (error) {
        console.error('❌ LỖI:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Chạy
runTest();
