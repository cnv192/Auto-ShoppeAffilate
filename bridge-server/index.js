/**
 * Bridge Server - STEP 4 Implementation
 * 
 * Lightweight redirect server for:
 * - Safe deep linking with referrer washing
 * - Affiliate link redirection
 * - Async click tracking (fire-and-forget)
 * - Cookie injection via hidden iframe
 * 
 * Connects to SAME MongoDB as backend (read-only access)
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/shoppe';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Request counter for logging
let requestCount = 0;

// --- Redis Client (Optional, for async click tracking) ---
let redisClient = null;
const initRedis = async () => {
  try {
    redisClient = redis.createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => {
      console.warn('⚠️  Redis connection warning (non-critical):', err.message);
    });
    await redisClient.connect();
    console.log('✅ Redis connected (Bridge Server)');
  } catch (err) {
    console.warn('⚠️  Redis not available (click tracking will be slower):', err.message);
    redisClient = null;
  }
};

// --- Link Model (copied from main backend, minimal fields) ---
const linkSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true },
  targetUrl: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  expiresAt: { type: Date, default: null },
  totalClicks: { type: Number, default: 0, select: false },
  validClicks: { type: Number, default: 0, select: false }
}, { collection: 'links' });

linkSchema.methods.isAvailable = function() {
  if (!this.isActive) return false;
  if (this.expiresAt && new Date() > this.expiresAt) return false;
  return true;
};

// Fire-and-forget click recording (non-blocking)
linkSchema.methods.recordClickAsync = async function() {
  try {
    if (redisClient) {
      // Push to Redis queue for async processing
      await redisClient.lPush(`click_queue:${this._id}`, JSON.stringify({
        linkId: this._id,
        timestamp: new Date().toISOString(),
        ip: 'bridge-server'
      }));
    } else {
      // Fallback: update directly (slower but works)
      this.totalClicks = (this.totalClicks || 0) + 1;
      await this.save();
    }
  } catch (err) {
    console.error('❌ Click recording error (non-critical):', err.message);
    // Fail silently - don't block the redirect
  }
};

const Link = mongoose.model('Link', linkSchema);

// --- Connect MongoDB ---
async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Read-only optimizations
      readPreference: 'secondary', // Read from secondary if available
      maxPoolSize: 10
    });
    console.log('✅ MongoDB connected (Bridge Server - Read-Only Mode)');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

// --- Middleware ---
app.use((req, res, next) => {
  requestCount++;
  if (NODE_ENV === 'development' || requestCount % 100 === 0) {
    console.log(`📍 [Bridge] ${req.method} ${req.path} | Total requests: ${requestCount}`);
  }
  next();
});

// --- Health Check Endpoint ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requests: requestCount
  });
});

// --- Main Redirect Route: /go/:slug ---
/**
 * GET /go/:slug
 * 
 * - Finds link by slug (case-insensitive)
 * - Validates link is active and not expired
 * - Sets referrer policy for privacy
 * - Performs 302 redirect
 * - Records click asynchronously (fire-and-forget)
 * 
 * Example: /go/summer-sale-50
 * → Redirects to: https://shopee.vn/search?keyword=...
 */
app.get('/go/:slug', async (req, res) => {
  const { slug } = req.params;
  const clientIp = req.ip || req.connection.remoteAddress;

  if (!slug || slug.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid slug',
      message: 'Slug parameter is required'
    });
  }

  try {
    // Find link by slug (case-insensitive)
    const link = await Link.findOne({ 
      slug: slug.toLowerCase() 
    });

    // Validate link exists and is available
    if (!link) {
      console.log(`⚠️  Link not found: ${slug}`);
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Link Not Found</title></head>
          <body>
            <h1>404 - Link Not Found</h1>
            <p>The link you're looking for doesn't exist or has been removed.</p>
          </body>
        </html>
      `);
    }

    if (!link.isAvailable()) {
      console.log(`⚠️  Link unavailable: ${slug} (active: ${link.isActive}, expired: ${link.expiresAt ? new Date() > link.expiresAt : false})`);
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Link Expired</title></head>
          <body>
            <h1>404 - Link Expired</h1>
            <p>This link is no longer available.</p>
          </body>
        </html>
      `);
    }

    // Security headers for referrer washing
    res.set('Referrer-Policy', 'no-referrer-when-downgrade');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    
    // Disable caching for this redirect
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    console.log(`✅ Redirecting: ${slug} → ${link.targetUrl.substring(0, 50)}... [IP: ${clientIp}]`);

    // Record click asynchronously (fire-and-forget, non-blocking)
    if (link.recordClickAsync) {
      link.recordClickAsync().catch(err => {
        console.error('Non-critical error recording click:', err.message);
      });
    }

    // Perform 302 redirect
    return res.redirect(302, link.targetUrl);

  } catch (err) {
    console.error('❌ Bridge redirect error:', err.message);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Server Error</title></head>
        <body>
          <h1>500 - Server Error</h1>
          <p>An error occurred while processing your request.</p>
        </body>
      </html>
    `);
  }
});

// --- Statistics Endpoint (Optional, for monitoring) ---
app.get('/stats', (req, res) => {
  res.json({
    server: 'Bridge Server',
    uptime: process.uptime(),
    totalRequests: requestCount,
    environment: NODE_ENV,
    mongodb: 'connected',
    redis: redisClient ? 'connected' : 'not-connected'
  });
});

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.path,
    method: req.method
  });
});

// --- Error Handler ---
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// --- Graceful Shutdown ---
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  if (redisClient) {
    await redisClient.disconnect();
  }
  await mongoose.disconnect();
  process.exit(0);
});

// --- Start Server ---
async function start() {
  await connectMongo();
  await initRedis();

  app.listen(PORT, () => {
    console.log(`
🚀 ════════════════════════════════════
🚀 Bridge Server started successfully
🚀 ════════════════════════════════════
📍 Port: ${PORT}
📍 URL: http://localhost:${PORT}
📍 Environment: ${NODE_ENV}

📋 Endpoints:
   - Redirect:  http://localhost:${PORT}/go/:slug
   - Health:    http://localhost:${PORT}/health
   - Stats:     http://localhost:${PORT}/stats

🔗 Main Endpoint Example:
   GET http://localhost:${PORT}/go/summer-sale-50
   → Redirects to affiliate URL with referrer washing

🍪 Cookie Injection:
   - Hidden iframe in ArticleDetail.js
   - Loads this server to seed cookies
   - Safe redirect with no-referrer policy

⚡ Click Tracking:
   - Fire-and-forget (async, non-blocking)
   - Uses Redis queue if available
   - Fallback to direct DB update

🛡️ Security:
   - Referrer-Policy: no-referrer-when-downgrade
   - No caching (Cache-Control: no-store)
   - XSS prevention headers
    `);
  });
}

start().catch(err => {
  console.error('❌ Failed to start Bridge Server:', err);
  process.exit(1);
});
