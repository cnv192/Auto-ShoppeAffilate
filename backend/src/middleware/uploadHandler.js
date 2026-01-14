/**
 * Upload Handler Middleware
 * 
 * Xử lý file upload với multer
 * - Validation file type (image only)
 * - Limit file size (5MB)
 * - Store in memory để pass cho sharp
 * - Error handling
 */

const multer = require('multer');
const path = require('path');

// ============================================================
// CONFIGURATION
// ============================================================

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ============================================================
// STORAGE SETUP - In Memory (để xử lý với sharp)
// ============================================================

const storage = multer.memoryStorage();

// ============================================================
// FILE FILTER
// ============================================================

/**
 * Kiểm tra loại file
 */
const fileFilter = (req, file, cb) => {
    // Kiểm tra MIME type
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
        return cb(
            new Error(`❌ Loại file không được phép. Chỉ chấp nhận: JPG, PNG, WebP, GIF`),
            false
        );
    }

    // Kiểm tra extension (double check)
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    if (!allowedExts.includes(ext)) {
        return cb(
            new Error(`❌ Extension file không hợp lệ: ${ext}`),
            false
        );
    }

    cb(null, true);
};

// ============================================================
// MULTER INSTANCE
// ============================================================

/**
 * Cấu hình multer cho upload hình ảnh
 */
const uploadMiddleware = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1 // Chỉ 1 file mỗi lần upload
    }
});

// ============================================================
// ERROR HANDLER
// ============================================================

/**
 * Wrapper để xử lý lỗi multer
 * Sử dụng: uploadMiddleware.single('image'), handleUploadError
 */
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                success: false,
                error: 'File quá lớn. Tối đa 5MB',
                code: 'FILE_TOO_LARGE'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Chỉ được upload 1 file',
                code: 'TOO_MANY_FILES'
            });
        }
        if (err.code === 'LIMIT_PART_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Request có quá nhiều parts',
                code: 'INVALID_REQUEST'
            });
        }
    }

    if (err) {
        return res.status(400).json({
            success: false,
            error: err.message || 'Lỗi upload file',
            code: 'UPLOAD_ERROR'
        });
    }

    next();
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    uploadMiddleware,
    handleUploadError,
    MAX_FILE_SIZE,
    ALLOWED_MIMETYPES
};
