/**
 * Main Server Entry Point
 * 
 * Shoppe Link Management System
 * - Smart Routing Middleware
 * - Deep Link Redirect
 * - Admin API
 * - Image Upload & Optimization
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const { connectRedis } = require('./config/redis');
const { connectMongoDB, getConnectionStatus } = require('./config/mongodb');
const linkRoutes = require('./routes/linkRoutes');
const redirectRoutes = require('./routes/redirectRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const authRoutes = require('./routes/authRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const facebookAccountRoutes = require('./routes/facebookAccountRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const cloudinaryRoutes = require('./routes/cloudinaryRoutes');
const userRoutes = require('./routes/userRoutes');
const { createSampleData } = require('./services/linkServiceMongo');
const { ipFilterMiddleware, getDatabaseStatus } = require('./middleware/ipFilter');
const User = require('./models/User');
const campaignScheduler = require('./services/campaignScheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// =================================================================
// MIDDLEWARE SETUP
// =================================================================

// CORS - Cho phép Frontend và Extension truy cập API
app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:5173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:5173',
            process.env.FRONTEND_URL
        ].filter(Boolean);
        
        // Allow requests with no origin (mobile apps, extensions, curl)
        // Allow chrome-extension:// and moz-extension:// origins
        if (!origin || 
            allowedOrigins.includes(origin) || 
            origin.startsWith('chrome-extension://') ||
            origin.startsWith('moz-extension://')) {
            callback(null, true);
        } else {
            console.log(`[CORS] Blocked origin: ${origin}`);
            callback(null, true); // Still allow for development
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Extension-Token']
}));

// Body Parser - Parse JSON và URL-encoded data
// Cấu hình limit để tránh PayloadTooLargeError
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// IP Filter Middleware - Lọc bot/datacenter traffic
// Đặt sau bodyParser, trước các routes
app.use(ipFilterMiddleware({
    enabled: process.env.IP_FILTER_ENABLED !== 'false', // Mặc định bật
    logAll: process.env.NODE_ENV === 'development',     // Log tất cả trong dev
    pageType: 'news'                                     // Hiển thị trang tin tức cho bot
}));

// View Engine - EJS cho rendering HTML
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files - Serve uploaded images
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// =================================================================
// ROUTES
// =================================================================

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        ipFilter: getDatabaseStatus(),
        mongodb: getConnectionStatus()
    });
});

// API Routes - Quản lý links
app.use('/api/links', linkRoutes);

// Auth Routes - Authentication & User Management
app.use('/api/auth', authRoutes);

// User Routes - User profile & management
app.use('/api/users', userRoutes);

// Dashboard Routes - Thống kê dashboard
app.use('/api/dashboard', dashboardRoutes);

// Campaign Routes - Quản lý chiến dịch
app.use('/api/campaigns', campaignRoutes);

// Facebook Account Routes - Quản lý tài khoản Facebook
app.use('/api/facebook-accounts', facebookAccountRoutes);

// Account Sync Routes - Extension bg.js sync endpoint
const accountRoutes = require('./routes/accountRoutes');
app.use('/api/accounts', accountRoutes);

// Extension Routes - Browser Extension sync Facebook accounts
const extensionRoutes = require('./routes/extensionRoutes');
app.use('/api/extension', extensionRoutes);

// Upload Routes - Upload & optimize hình ảnh (local)
app.use('/api/upload/local', uploadRoutes);

// Cloudinary Upload Routes - Upload lên Cloudinary
app.use('/api/upload', cloudinaryRoutes);

// Debug Routes - Chỉ trong development
if (process.env.NODE_ENV === 'development') {
    const debugRoutes = require('./routes/debugRoutes');
    app.use('/api/debug', debugRoutes);
    console.log('🔧 Debug routes enabled at /api/debug');
}

// Redirect Routes - Xử lý redirect (đặt cuối cùng vì có wildcard)
app.use('/', redirectRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Không tìm thấy trang',
        message: 'Trang bạn tìm kiếm không tồn tại'
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).render('error', {
        title: 'Lỗi hệ thống',
        message: 'Đã xảy ra lỗi, vui lòng thử lại sau'
    });
});

// =================================================================
// START SERVER
// =================================================================

const startServer = async () => {
    try {
        // Kết nối MongoDB Atlas
        await connectMongoDB();
        
        // Kết nối Redis (optional - cho rate limiting)
        await connectRedis();
        
        // Tạo dữ liệu mẫu trong MongoDB
        await createSampleData();
        
        // Tạo Admin user mặc định
        console.log('👤 Initializing default admin user...');
        await User.createDefaultAdmin('admin', '123456');
        
        // Start campaign scheduler
        console.log('🕐 Starting campaign scheduler...');
        campaignScheduler.start();
        
        // Start server
        app.listen(PORT, () => {
            console.log('');
            console.log('🚀 ====================================');
            console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
            console.log('🚀 ====================================');
            console.log('');
            console.log('📋 Endpoints:');
            console.log(`   - Health Check:      http://localhost:${PORT}/health`);
            console.log(`   - API Links:         http://localhost:${PORT}/api/links`);
            console.log(`   - Auth/Login:        http://localhost:${PORT}/api/auth/login`);
            console.log(`   - Campaigns:         http://localhost:${PORT}/api/campaigns`);
            console.log(`   - Facebook Accounts: http://localhost:${PORT}/api/facebook-accounts`);
            console.log(`   - Redirect:          http://localhost:${PORT}/:slug`);
            console.log('');
            console.log('👤 Default Admin:');
            console.log('   - Username: admin');
            console.log('   - Password: @Cchuong1009');
            console.log('   - ⚠️  Vui lòng đổi password sau khi đăng nhập!');
            console.log('');
            console.log('📦 Sample Links:');
            console.log(`   - http://localhost:${PORT}/flash50`);
            console.log(`   - http://localhost:${PORT}/iphone15`);
            console.log(`   - http://localhost:${PORT}/fashion70`);
            console.log('');
            console.log('🔒 IP Filter: Kiểm tra IP từ sample.bin.db11');
            console.log('📊 MongoDB: Lưu trữ và tracking clicks');
            console.log('🤖 Campaign Scheduler: Active (runs every 5 minutes)');
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
