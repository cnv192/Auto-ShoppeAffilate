/**
 * Cloudinary Upload Routes
 * 
 * Upload ảnh/video lên Cloudinary
 * POST /api/upload - Upload file lên Cloudinary
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { authenticate } = require('../middleware/auth');

// Configure Cloudinary
cloudinary.config({
    cloud_name: 'do169bkba',
    api_key: '138946517721673',
    api_secret: 'IBWgMzVI_l6JMFZ5U3Ta5Brs6zc'
});

// Configure Cloudinary Storage for Multer
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // Determine resource type
        let resourceType = 'image';
        let folder = 'hotnews/images';
        
        if (file.mimetype.startsWith('video/')) {
            resourceType = 'video';
            folder = 'hotnews/videos';
        }
        
        return {
            folder: folder,
            resource_type: resourceType,
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm'],
            transformation: resourceType === 'image' ? [
                { width: 1200, height: 1200, crop: 'limit' },
                { quality: 'auto', fetch_format: 'auto' }
            ] : undefined
        };
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('File type không được hỗ trợ. Chỉ chấp nhận: JPG, PNG, GIF, WEBP, MP4, MOV, AVI, WEBM'), false);
    }
};

// Multer upload middleware
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
    }
});

/**
 * POST /api/upload
 * Upload single file to Cloudinary
 * 
 * Requires authentication
 * Returns Cloudinary URL
 */
router.post('/', authenticate, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Không có file được upload'
            });
        }

        const file = req.file;
        const isVideo = file.mimetype.startsWith('video/');
        
        // Build optimized URL
        let optimizedUrl = file.path;
        
        // For images, add auto optimization params
        if (!isVideo && file.path.includes('cloudinary.com')) {
            // Insert transformation params for images
            optimizedUrl = file.path.replace(
                '/upload/',
                '/upload/f_auto,q_auto/'
            );
        }

        return res.json({
            success: true,
            data: {
                url: optimizedUrl,
                originalUrl: file.path,
                publicId: file.filename,
                type: isVideo ? 'video' : 'image',
                size: file.size,
                format: file.format || file.mimetype.split('/')[1]
            }
        });

    } catch (error) {
        console.error('❌ Cloudinary upload error:', error);
        return res.status(500).json({
            success: false,
            message: 'Upload thất bại',
            error: error.message
        });
    }
});

/**
 * POST /api/upload/multiple
 * Upload multiple files to Cloudinary
 */
router.post('/multiple', authenticate, upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không có file được upload'
            });
        }

        const uploadedFiles = req.files.map(file => {
            const isVideo = file.mimetype.startsWith('video/');
            let optimizedUrl = file.path;
            
            if (!isVideo && file.path.includes('cloudinary.com')) {
                optimizedUrl = file.path.replace('/upload/', '/upload/f_auto,q_auto/');
            }

            return {
                url: optimizedUrl,
                originalUrl: file.path,
                publicId: file.filename,
                type: isVideo ? 'video' : 'image',
                size: file.size
            };
        });

        return res.json({
            success: true,
            data: uploadedFiles
        });

    } catch (error) {
        console.error('❌ Multiple upload error:', error);
        return res.status(500).json({
            success: false,
            message: 'Upload thất bại',
            error: error.message
        });
    }
});

/**
 * DELETE /api/upload/:publicId
 * Delete file from Cloudinary
 */
router.delete('/:publicId', authenticate, async (req, res) => {
    try {
        const { publicId } = req.params;
        const { type } = req.query; // 'image' or 'video'
        
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: type || 'image'
        });

        if (result.result === 'ok') {
            return res.json({
                success: true,
                message: 'Xóa file thành công'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa file'
            });
        }

    } catch (error) {
        console.error('❌ Delete file error:', error);
        return res.status(500).json({
            success: false,
            message: 'Xóa file thất bại',
            error: error.message
        });
    }
});

// Error handler for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File quá lớn. Giới hạn 50MB'
            });
        }
    }
    return res.status(400).json({
        success: false,
        message: error.message
    });
});

module.exports = router;
