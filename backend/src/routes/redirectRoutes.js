/**
 * Redirect Routes
 * 
 * CSR Architecture with Server-Side Meta Injection
 * 
 * Workflow:
 * 1. Middleware checks User-Agent and IP (IP2Location)
 * 2. For ALL requests → renderController handles:
 *    - Meta injection into React build HTML
 *    - Click tracking (for real users)
 *    - Fallback if React build not available
 * 3. React takes over on client-side for SPA experience
 */

const express = require('express');
const router = express.Router();
const { smartRoutingMiddleware } = require('../middleware/smartRouting');
const { renderArticle, renderPreview } = require('../controllers/renderController');

/**
 * GET /:slug
 * Main route for article pages
 * 
 * Uses renderController for:
 * - Server-Side Meta Injection (SEO/Social Bots)
 * - Click Tracking
 * - React CSR serving
 */
router.get('/:slug', smartRoutingMiddleware, renderArticle);

/**
 * GET /preview/:slug
 * Preview-only endpoint (minimal HTML with meta tags)
 * Used by debugging tools and bot simulators
 */
router.get('/preview/:slug', renderPreview);

module.exports = router;
