/**
 * Upload Routes
 * 
 * Endpoints cho upload hình ảnh
 * POST /api/upload/product/:productId - Upload hình ảnh sản phẩm
 */

const express = require('express');
const router = express.Router();
const { uploadMiddleware, handleUploadError } = require('../middleware/uploadHandler');
const { optimizeProductImage, cleanupImages } = require('../middleware/imageOptimizer');
const UploadService = require('../services/uploadService');

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /api/upload/image
 * 
 * Generic image upload to Cloudinary
 * 
 * Form data:
 * - image: File (required)
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     url: "https://...cloudinary..."
 *   }
 * }
 */
router.post(
    '/image',
    uploadMiddleware.single('image'),
    handleUploadError,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded.' });
            }

            const uploadResult = await UploadService.uploadFile(req.file.buffer, 'banners');

            res.json({
                success: true,
                data: {
                    url: uploadResult.secureUrl,
                }
            });
        } catch (err) {
            console.error('❌ Generic image upload error:', err);
            res.status(500).json({
                success: false,
                error: 'Lỗi upload hình ảnh',
                code: 'IMAGE_UPLOAD_ERROR'
            });
        }
    }
);


/**
 * POST /api/upload/product/:productId
 * 
 * Upload hình ảnh sản phẩm
 * 
 * Form data:
 * - image: File (required)
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     imageUrl: "/uploads/products/{productId}/main-1234567890-abc.webp",
 *     thumbnailUrl: "/uploads/products/{productId}/thumbnail-1234567890-abc.webp",
 *     main: {
 *       filename: "main-1234567890-abc.webp",
 *       url: "/uploads/products/{productId}/main-1234567890-abc.webp",
 *       size: "800x800",
 *       bytes: 45000
 *     },
 *     thumbnail: {
 *       filename: "thumbnail-1234567890-abc.webp",
 *       url: "/uploads/products/{productId}/thumbnail-1234567890-abc.webp",
 *       size: "300x300",
 *       bytes: 12000
 *     }
 *   }
 * }
 */
router.post(
    '/product/:productId',
    uploadMiddleware.single('image'),
    handleUploadError,
    optimizeProductImage,
    (req, res) => {
        try {
            const { uploadedImages } = req;

            res.json({
                success: true,
                data: {
                    imageUrl: uploadedImages.main.url,
                    thumbnailUrl: uploadedImages.thumbnail.url,
                    ...uploadedImages
                }
            });
        } catch (err) {
            console.error('❌ Upload route error:', err);
            res.status(500).json({
                success: false,
                error: 'Lỗi upload hình ảnh',
                code: 'UPLOAD_ROUTE_ERROR'
            });
        }
    }
);

/**
 * POST /api/upload/bulk
 * 
 * Upload nhiều hình ảnh (future feature)
 * 
 * Form data:
 * - images: File[] (multiple)
 * - productId: string (in form)
 * 
 * Return:
 * {
 *   success: true,
 *   data: [
 *     { imageUrl, thumbnailUrl },
 *     { imageUrl, thumbnailUrl }
 *   ]
 * }
 */
router.post(
    '/bulk',
    uploadMiddleware.single('image'),
    handleUploadError,
    optimizeProductImage,
    (req, res) => {
        try {
            const { uploadedImages } = req;

            res.json({
                success: true,
                data: {
                    imageUrl: uploadedImages.main.url,
                    thumbnailUrl: uploadedImages.thumbnail.url,
                    main: uploadedImages.main,
                    thumbnail: uploadedImages.thumbnail
                }
            });
        } catch (err) {
            console.error('❌ Bulk upload route error:', err);
            res.status(500).json({
                success: false,
                error: 'Lỗi upload hình ảnh',
                code: 'BULK_UPLOAD_ERROR'
            });
        }
    }
);

// ============================================================
// EXPORTS
// ============================================================

module.exports = router;
