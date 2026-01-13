/**
 * Main Server Entry Point
 * 
 * Shoppe Link Management System
 * - Smart Routing Middleware
 * - Deep Link Redirect
 * - Admin API
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

const { connectRedis } = require('./config/redis');
const linkRoutes = require('./routes/linkRoutes');
const redirectRoutes = require('./routes/redirectRoutes');
const { createSampleData } = require('./services/linkService');
const { ipFilterMiddleware, getDatabaseStatus } = require('./middleware/ipFilter');

const app = express();
const PORT = process.env.PORT || 3001;

// =================================================================
// MIDDLEWARE SETUP
// =================================================================

// CORS - Cho phép Frontend truy cập API
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parser - Parse JSON và URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// Static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// =================================================================
// ROUTES
// =================================================================

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        ipFilter: getDatabaseStatus()
    });
});

// API Routes - Quản lý links
app.use('/api/links', linkRoutes);

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
        // Kết nối Redis
        await connectRedis();
        
        // Tạo dữ liệu mẫu
        await createSampleData();
        
        // Start server
        app.listen(PORT, () => {
            console.log('');
            console.log('🚀 ====================================');
            console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
            console.log('🚀 ====================================');
            console.log('');
            console.log('📋 Endpoints:');
            console.log(`   - Health Check: http://localhost:${PORT}/health`);
            console.log(`   - API Links:    http://localhost:${PORT}/api/links`);
            console.log(`   - Redirect:     http://localhost:${PORT}/:slug`);
            console.log('');
            console.log('📦 Sample Links:');
            console.log(`   - http://localhost:${PORT}/flash50`);
            console.log(`   - http://localhost:${PORT}/iphone15`);
            console.log(`   - http://localhost:${PORT}/fashion70`);
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
