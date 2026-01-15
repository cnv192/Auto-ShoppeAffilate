/**
 * Render Controller
 * 
 * Server-Side Meta Injection for SEO/Social Bots
 * 
 * Architecture:
 * - Reads React build index.html
 * - Replaces meta placeholders with actual Link data
 * - Returns modified HTML to client
 * 
 * This allows:
 * - Facebook/Zalo bots to see correct OG tags
 * - React CSR to work normally for users
 * - Single codebase for both use cases
 */

const fs = require('fs');
const path = require('path');
const linkServiceMongo = require('../services/linkServiceMongo');

// Cache the React build HTML template
let cachedTemplate = null;
let templateLastModified = null;

/**
 * Get React build index.html with caching
 * @returns {string} HTML template content
 */
const getReactTemplate = () => {
    const templatePath = path.join(__dirname, '../../../frontend/build/index.html');
    
    try {
        const stats = fs.statSync(templatePath);
        
        // Refresh cache if file was modified
        if (!cachedTemplate || stats.mtimeMs !== templateLastModified) {
            cachedTemplate = fs.readFileSync(templatePath, 'utf8');
            templateLastModified = stats.mtimeMs;
            console.log('📄 [RenderController] React template loaded/refreshed');
        }
        
        return cachedTemplate;
    } catch (error) {
        console.error('❌ [RenderController] Cannot read React build:', error.message);
        return null;
    }
};

/**
 * Inject meta tags into HTML template
 * @param {string} html - Original HTML
 * @param {Object} meta - Meta data to inject
 * @returns {string} Modified HTML
 */
const injectMetaTags = (html, meta) => {
    const {
        title = 'Hot News - Tin tức nóng hổi',
        description = 'Cập nhật tin tức mới nhất, deal hot, khuyến mãi hấp dẫn mỗi ngày.',
        imageUrl = 'https://via.placeholder.com/1200x630',
        url = '',
        siteName = 'Hot News',
        type = 'article',
        author = 'Hot News',
        publishedTime = new Date().toISOString()
    } = meta;

    return html
        // Replace placeholders
        .replace(/__META_TITLE__/g, escapeHtml(title))
        .replace(/__META_DESCRIPTION__/g, escapeHtml(description))
        .replace(/__META_IMAGE__/g, escapeHtml(imageUrl))
        .replace(/__META_URL__/g, escapeHtml(url))
        .replace(/__META_SITE_NAME__/g, escapeHtml(siteName))
        .replace(/__META_TYPE__/g, escapeHtml(type))
        .replace(/__META_AUTHOR__/g, escapeHtml(author))
        .replace(/__META_PUBLISHED_TIME__/g, publishedTime);
};

/**
 * Escape HTML entities to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Render Article Page with Meta Injection
 * Main handler for /:slug route
 */
const renderArticle = async (req, res) => {
    const { slug } = req.params;
    const currentUrl = `${req.protocol}://${req.get('host')}/${slug}`;

    try {
        // Get link data from MongoDB
        const link = await linkServiceMongo.getLinkBySlug(slug);

        // If link not found, render with default meta (React will handle 404)
        if (!link) {
            console.log(`⚠️ [RenderController] Link not found: ${slug}`);
            return renderWithMeta(res, {
                title: 'Không tìm thấy bài viết - Hot News',
                description: 'Bài viết bạn tìm kiếm không tồn tại hoặc đã bị xóa.',
                url: currentUrl
            });
        }

        // Check if link is active
        if (!link.isAvailable || (typeof link.isAvailable === 'function' && !link.isAvailable())) {
            console.log(`⚠️ [RenderController] Link inactive: ${slug}`);
            return renderWithMeta(res, {
                title: 'Bài viết không khả dụng - Hot News',
                description: 'Bài viết này hiện không khả dụng.',
                url: currentUrl
            });
        }

        // === TRACK CLICK (for real users, not bots) ===
        if (!req.isPreviewBot) {
            try {
                await linkServiceMongo.recordClick(slug, {
                    ip: req.clientIP || req.ip,
                    userAgent: req.headers['user-agent'] || '',
                    referer: req.headers['referer'] || '',
                    device: req.deviceType || 'unknown',
                    isValid: req.isValidClick !== false,
                    invalidReason: req.isValidClick === false ? (req.ipAnalysis?.reason || 'Unknown') : null
                });
                console.log(`📊 [RenderController] Click tracked: ${slug}`);
            } catch (trackError) {
                console.error('⚠️ [RenderController] Track error:', trackError.message);
            }
        }

        // Render with link data
        console.log(`✅ [RenderController] Rendering article: ${slug} | Bot: ${req.isPreviewBot || false}`);
        
        return renderWithMeta(res, {
            title: link.title,
            description: link.description || `Xem ngay deal hot trên Shopee với giá ưu đãi đặc biệt!`,
            imageUrl: link.imageUrl,
            url: currentUrl,
            author: link.author || 'Hot News',
            publishedTime: link.publishedAt ? new Date(link.publishedAt).toISOString() : new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ [RenderController] Error:', error);
        return renderWithMeta(res, {
            title: 'Lỗi - Hot News',
            description: 'Đã xảy ra lỗi khi tải bài viết.',
            url: currentUrl
        });
    }
};

/**
 * Helper: Render HTML with meta tags
 * @param {Object} res - Express response
 * @param {Object} meta - Meta data
 */
const renderWithMeta = (res, meta) => {
    const template = getReactTemplate();

    if (!template) {
        // Fallback: Serve basic HTML with meta tags
        return res.send(generateFallbackHtml(meta));
    }

    const html = injectMetaTags(template, meta);
    res.set('Content-Type', 'text/html');
    return res.send(html);
};

/**
 * Generate fallback HTML if React build is not available
 * @param {Object} meta - Meta data
 * @returns {string} Fallback HTML
 */
const generateFallbackHtml = (meta) => {
    const { title, description, imageUrl, url } = meta;
    
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    
    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:site_name" content="Hot News">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
    
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }
        .container {
            text-align: center;
            padding: 40px;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #eee;
            border-top-color: #ee4d2d;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <p>Đang tải...</p>
    </div>
    <script>
        // Redirect to frontend if build not available
        window.location.href = '${process.env.FRONTEND_URL || 'http://localhost:3000'}${url ? new URL(url).pathname : '/'}';
    </script>
</body>
</html>`;
};

/**
 * Preview-only handler (for social media bots)
 * Returns minimal HTML with just meta tags
 */
const renderPreview = async (req, res) => {
    const { slug } = req.params;
    const currentUrl = `${req.protocol}://${req.get('host')}/${slug}`;

    try {
        const link = await linkServiceMongo.getLinkBySlug(slug);

        if (!link) {
            return res.status(404).send(generatePreviewHtml({
                title: 'Không tìm thấy',
                description: 'Bài viết không tồn tại',
                imageUrl: '',
                url: currentUrl
            }));
        }

        return res.send(generatePreviewHtml({
            title: link.title,
            description: link.description || 'Xem ngay deal hot!',
            imageUrl: link.imageUrl,
            url: currentUrl
        }));

    } catch (error) {
        console.error('❌ [RenderController] Preview error:', error);
        return res.status(500).send('Server Error');
    }
};

/**
 * Generate minimal preview HTML for bots
 * @param {Object} meta - Meta data
 * @returns {string} Preview HTML
 */
const generatePreviewHtml = (meta) => {
    const { title, description, imageUrl, url } = meta;
    
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    
    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:site_name" content="Hot News">
    <meta property="og:locale" content="vi_VN">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
</head>
<body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}">
</body>
</html>`;
};

module.exports = {
    renderArticle,
    renderPreview,
    injectMetaTags,
    getReactTemplate,
    escapeHtml
};
