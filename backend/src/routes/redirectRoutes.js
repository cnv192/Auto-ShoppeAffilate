/**
 * Redirect Routes
 * 
 * Xử lý redirect cho người dùng và bot preview
 */

const express = require('express');
const router = express.Router();
const linkService = require('../services/linkService');
const { smartRoutingMiddleware } = require('../middleware/smartRouting');

/**
 * GET /:slug
 * Route chính để xử lý redirect
 * 
 * Workflow:
 * 1. Middleware kiểm tra User-Agent
 * 2. Nếu là bot → Render trang preview (chỉ có meta tags)
 * 3. Nếu là người dùng → Render trang redirect (có deep link logic)
 */
router.get('/:slug', smartRoutingMiddleware, async (req, res) => {
    const { slug } = req.params;
    
    try {
        // Lấy thông tin link từ database
        const link = await linkService.getLinkBySlug(slug);
        
        // Nếu không tìm thấy link
        if (!link) {
            return res.status(404).render('error', {
                title: 'Không tìm thấy link',
                message: 'Link này không tồn tại hoặc đã bị xóa'
            });
        }
        
        // Kiểm tra link còn active không
        if (!link.isActive) {
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
            
            // Render trang preview nhẹ (chỉ có meta tags)
            return res.render('preview', {
                title: link.title,
                description: `Xem ngay deal hot trên Shopee với giá ưu đãi đặc biệt! ${link.title}`,
                imageUrl: link.imageUrl,
                currentUrl,
                targetUrl: link.targetUrl
            });
        }
        
        // === XỬ LÝ NGƯỜI DÙNG THỰC ===
        console.log(`👤 Serving redirect page for user: ${req.clientIP}`);
        
        // Render trang redirect với Deep Link logic
        res.render('redirect', {
            title: link.title,
            imageUrl: link.imageUrl,
            targetUrl: link.targetUrl,
            currentUrl,
            slug
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
