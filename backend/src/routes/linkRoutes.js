/**
 * Link Routes
 * 
 * API endpoints cho việc quản lý links với MongoDB
 * - Admin: Xem tất cả links với thông tin user sở hữu
 * - User: Chỉ xem links của mình
 */

const express = require('express');
const router = express.Router();
const linkService = require('../services/linkServiceMongo');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const Link = require('../models/Link');
const UploadService = require('../services/uploadService');

/**
 * Helper: Nếu imageUrl là base64 data URL, upload lên Cloudinary và trả về URL thật
 */
async function resolveImageUrl(imageUrl) {
    if (imageUrl && imageUrl.startsWith('data:')) {
        try {
            console.log('🔄 [LinkRoutes] Converting base64 image to Cloudinary URL...');
            const result = await UploadService.uploadBase64(imageUrl, 'articles/covers');
            console.log('✅ [LinkRoutes] Cloudinary URL:', result.secureUrl);
            return result.secureUrl;
        } catch (error) {
            console.error('❌ [LinkRoutes] Failed to upload base64 to Cloudinary:', error.message);
            return imageUrl; // Fallback: giữ nguyên base64 nếu upload thất bại
        }
    }
    return imageUrl;
}

/**
 * GET /api/links/public
 * Lấy danh sách tất cả links cho public (không cần đăng nhập)
 * Dùng cho trang chủ hiển thị bài viết
 */
router.get('/public', async (req, res) => {
    try {
        const links = await Link.find({ isActive: true })
            .sort({ publishedAt: -1, createdAt: -1 })
            .select('slug title description imageUrl category author publishedAt createdAt validClicks totalClicks')
            .limit(100);
        
        const formattedLinks = links.map(link => ({
            id: link._id,
            slug: link.slug,
            title: link.title,
            description: link.description,
            imageUrl: link.imageUrl,
            category: link.category,
            author: link.author,
            publishedAt: link.publishedAt,
            createdAt: link.createdAt,
            clicks: link.validClicks || 0,
            clickCount: link.totalClicks || 0
        }));
        
        res.json({
            success: true,
            data: formattedLinks
        });
    } catch (error) {
        console.error('Error getting public links:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể tải bài viết'
        });
    }
});

/**
 * GET /api/links
 * Lấy danh sách tất cả links
 * - Admin: Xem tất cả + populate userId
 * - User: Chỉ xem của mình
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const user = req.user;
        const query = { isActive: true };

        // If the user is not an admin, only show their own links.
        if (user.role !== 'admin') {
            query.userId = user._id;
        }

        const linksQuery = Link.find(query)
            .sort({ createdAt: -1 })
            .select('-clickLogs -clickedIPs');

        // For admins, populate the user information
        if (user.role === 'admin') {
            linksQuery.populate('userId', 'username fullName');
        }

        const links = await linksQuery;
        
        const formattedLinks = links.map(link => ({
            id: link._id,
            slug: link.slug,
            title: link.title,
            targetUrl: link.targetUrl,
            imageUrl: link.imageUrl,
            description: link.description || '',
            content: link.content || '',
            category: link.category || '',
            author: link.author || '',
            publishedAt: link.publishedAt,
            clicks: link.validClicks || 0,
            totalClicks: link.totalClicks || 0,
            uniqueIPs: link.uniqueIPs || 0,
            isActive: link.isActive,
            createdAt: link.createdAt,
            updatedAt: link.updatedAt,
            userId: link.userId ? {
                _id: link.userId._id,
                username: link.userId.username,
                fullName: link.userId.fullName
            } : null
        }));
        
        res.json({
            success: true,
            data: formattedLinks,
            total: formattedLinks.length
        });
    } catch (error) {
        console.error('Error getting links:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể lấy danh sách links'
        });
    }
});
/**
 * GET /api/links/:slug
 * Lấy thông tin chi tiết một link (public - bao gồm content)
 */
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const link = await linkService.getLinkBySlug(slug);
        
        if (!link) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy link'
            });
        }
        
        res.json({
            success: true,
            data: {
                id: link._id,
                slug: link.slug,
                title: link.title,
                description: link.description,
                content: link.content,
                targetUrl: link.targetUrl,
                imageUrl: link.imageUrl,
                category: link.category,
                author: link.author,
                publishedAt: link.publishedAt,
                clicks: link.validClicks,
                totalClicks: link.totalClicks,
                invalidClicks: link.invalidClicks,
                uniqueIPs: link.uniqueIPs,
                isActive: link.isActive,
                createdAt: link.createdAt
            }
        });
    } catch (error) {
        console.error('Error getting link:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể lấy thông tin link'
        });
    }
});

/**
 * POST /api/links/:slug/track
 * Track click cho một link (public - gọi từ frontend)
 */
router.post('/:slug/track', async (req, res) => {
    try {
        const { slug } = req.params;
        const { ip, userAgent, referer, device } = req.body;
        
        const clickResult = await linkService.recordClick(slug, {
            ip: ip || req.ip,
            userAgent: userAgent || req.headers['user-agent'],
            referer: referer || req.headers.referer,
            device: device || 'desktop',
            isValid: true // Frontend calls are considered valid
        });
        
        res.json({
            success: true,
            data: clickResult
        });
    } catch (error) {
        console.error('Error tracking click:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể tracking click'
        });
    }
});

/**
 * GET /api/links/:slug/stats
 * Lấy thống kê của một link
 */
router.get('/:slug/stats', async (req, res) => {
    try {
        const { slug } = req.params;
        const stats = await linkService.getLinkStats(slug);
        
        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy link'
            });
        }
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting link stats:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể lấy thống kê'
        });
    }
});

/**
 * POST /api/links
 * Tạo link mới
 */
router.post('/', authenticate, async (req, res) => {
    try {
        const { 
            title, 
            targetUrl, 
            imageUrl, 
            customSlug,
            description,
            content,
            category,
            author,
            publishedAt
        } = req.body;
        const userId = req.user._id; // Get userId from authenticated user
        
        // Validate URL format if targetUrl is provided
        if (targetUrl) {
            try {
                new URL(targetUrl);
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    error: 'URL không hợp lệ'
                });
            }
        }
        
        // Convert base64 imageUrl to Cloudinary URL if needed
        const resolvedImageUrl = await resolveImageUrl(imageUrl);

        // Pass all fields to service
        const link = await linkService.createLink({
            title,
            targetUrl,
            imageUrl: resolvedImageUrl,
            customSlug,
            description,
            content,
            category,
            author,
            publishedAt,
            userId // Pass userId to the service
        });
        
        res.status(201).json({
            success: true,
            data: link,
            message: 'Tạo link thành công'
        });
    } catch (error) {
        console.error('Error creating link:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể tạo link'
        });
    }
});

/**
 * PUT /api/links/:slug
 * Cập nhật link
 */
router.put('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { 
            title, 
            targetUrl, 
            imageUrl, 
            isActive,
            description,
            content,
            category,
            author,
            publishedAt,
            customSlug
        } = req.body;
        
        // Validate URL if provided
        if (targetUrl) {
            try {
                new URL(targetUrl);
            } catch (e) {
                return res.status(400).json({
                    success: false,
                    error: 'URL không hợp lệ'
                });
            }
        }
        
        // If customSlug is provided and different from current, check for duplicates
        if (customSlug && customSlug.toLowerCase() !== slug.toLowerCase()) {
            const existingLink = await Link.findOne({ slug: customSlug.toLowerCase() });
            if (existingLink) {
                if (!existingLink.isActive) {
                    // Bài cũ đã bị soft-delete, xóa hẳn để nhường slug
                    await Link.findByIdAndDelete(existingLink._id);
                    console.log(`🔄 Xóa link inactive cũ để tái sử dụng slug: ${customSlug}`);
                } else {
                    return res.status(400).json({
                        success: false,
                        error: `Slug "${customSlug}" đã được sử dụng bởi bài viết khác`
                    });
                }
            }
        }
        
        // Convert base64 imageUrl to Cloudinary URL if needed
        const resolvedImageUrl = imageUrl !== undefined ? await resolveImageUrl(imageUrl) : undefined;

        // Xóa ảnh cũ trên Cloudinary nếu đang thay bằng ảnh mới
        if (resolvedImageUrl !== undefined) {
            try {
                const currentLink = await Link.findOne({ slug: slug.toLowerCase() });
                if (currentLink && currentLink.imageUrl && currentLink.imageUrl.includes('cloudinary.com') 
                    && currentLink.imageUrl !== resolvedImageUrl) {
                    const oldMatch = currentLink.imageUrl.match(/\/upload\/(?:v\d+\/)?(.*?)(?:\.\w+)?$/);
                    if (oldMatch && oldMatch[1]) {
                        await UploadService.deleteFile(oldMatch[1]).catch(err => {
                            console.warn(`⚠️  Không xóa được ảnh cũ: ${err.message}`);
                        });
                    }
                }
            } catch (cleanErr) {
                console.warn(`⚠️  Lỗi cleanup ảnh cũ: ${cleanErr.message}`);
            }
        }

        // Build update object - only include fields that are provided (not undefined)
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (customSlug !== undefined) updateData.slug = customSlug.toLowerCase();
        if (targetUrl !== undefined) updateData.targetUrl = targetUrl;
        if (resolvedImageUrl !== undefined) updateData.imageUrl = resolvedImageUrl;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (description !== undefined) updateData.description = description;
        if (content !== undefined) updateData.content = content;
        if (category !== undefined) updateData.category = category;
        if (author !== undefined) updateData.author = author;
        if (publishedAt !== undefined) updateData.publishedAt = publishedAt;
        
        const updatedLink = await linkService.updateLink(slug, updateData);
        
        if (!updatedLink) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy link'
            });
        }
        
        res.json({
            success: true,
            data: updatedLink,
            message: 'Cập nhật link thành công'
        });
    } catch (error) {
        console.error('Error updating link:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể cập nhật link'
        });
    }
});

/**
 * DELETE /api/links/:slug
 * Xóa link
 */
router.delete('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const deleted = await linkService.deleteLink(slug);
        
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Không tìm thấy link'
            });
        }
        
        res.json({
            success: true,
            message: 'Xóa link thành công'
        });
    } catch (error) {
        console.error('Error deleting link:', error);
        res.status(500).json({
            success: false,
            error: 'Không thể xóa link'
        });
    }
});

module.exports = router;
