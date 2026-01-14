/**
 * Redirect Routes
 * 
 * Xử lý redirect cho người dùng và bot preview
 * Tích hợp IP checking và MongoDB tracking
 */

const express = require('express');
const router = express.Router();
const linkServiceMongo = require('../services/linkServiceMongo');
const { smartRoutingMiddleware } = require('../middleware/smartRouting');

/**
 * GET /:slug
 * Route chính để xử lý redirect
 * 
 * Workflow:
 * 1. Middleware kiểm tra User-Agent và IP (IP2Location)
 * 2. Nếu là bot preview → Render trang preview
 * 3. Nếu là người dùng:
 *    - Ghi click vào MongoDB (valid/invalid dựa trên IP check)
 *    - Render trang redirect
 */
router.get('/:slug', smartRoutingMiddleware, async (req, res) => {
    const { slug } = req.params;
    
    try {
        // Lấy thông tin link từ MongoDB
        const link = await linkServiceMongo.getLinkBySlug(slug);
        
        // Nếu không tìm thấy link
        if (!link) {
            return res.status(404).render('error', {
                title: 'Không tìm thấy link',
                message: 'Link này không tồn tại hoặc đã bị xóa'
            });
        }
        
        // Kiểm tra link còn active không
        if (!link.isAvailable()) {
            return res.status(410).render('error', {
                title: 'Link đã ngưng hoạt động',
                message: 'Link này đã bị vô hiệu hóa'
            });
        }
        
        // Tạo URL hiện tại để dùng trong meta tags
        const currentUrl = `${req.protocol}://${req.get('host')}/${slug}`;
        
        // === XỬ LÝ BOT PREVIEW ===
        if (req.isPreviewBot) {
            console.log(`🤖 Serving preview page for bot: ${req.botType}`);
            
            return res.render('preview', {
                title: link.title,
                description: link.description || `Xem ngay deal hot trên Shopee!`,
                imageUrl: link.imageUrl,
                currentUrl,
                targetUrl: link.targetUrl
            });
        }
        
        // === XỬ LÝ NGƯỜI DÙNG - GHI CLICK VÀO MONGODB ===
        // req.isValidClick được set bởi smartRoutingMiddleware sau khi check IP2Location
        const clickResult = await linkServiceMongo.recordClick(slug, {
            ip: req.clientIP,
            userAgent: req.userAgent,
            referer: req.referer,
            device: req.deviceType,
            // isValidClick = true nếu IP từ VN và không phải datacenter
            isValid: req.isValidClick,
            invalidReason: req.isValidClick ? null : req.ipAnalysis?.reason
        });
        
        console.log(`� Article: /${slug} | IP: ${req.clientIP} | Valid: ${req.isValidClick} | Total: ${clickResult.totalClicks}`);
        
        // === RENDER TRANG BÀI VIẾT (ARTICLE PAGE) ===
        // Hiển thị bài viết với Cookie Injection techniques
        res.render('article', {
            title: link.title,
            description: link.description || 'Xem ngay deal hot trên Shopee!',
            imageUrl: link.imageUrl,
            targetUrl: link.targetUrl,
            content: link.content || '<p>Đang cập nhật nội dung...</p>',
            currentUrl,
            slug,
            publishedAt: link.publishedAt || new Date(),
            author: link.author || 'Shopee Deals VN',
            category: link.category || 'Khuyến mãi',
            tags: link.tags || []
        });
        
    } catch (error) {
        console.error('Error handling redirect:', error);
        res.status(500).render('error', {
            title: 'Lỗi hệ thống',
            message: 'Đã xảy ra lỗi, vui lòng thử lại sau'
        });
    }
});

module.exports = router;
