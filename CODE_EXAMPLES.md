# 📚 Code Examples - Server-Side Meta Injection

This document provides practical code examples showing how the refactored system works.

---

## Table of Contents
1. [Meta Injection Examples](#meta-injection-examples)
2. [Banner System Examples](#banner-system-examples)
3. [Frontend Integration](#frontend-integration)
4. [Testing Examples](#testing-examples)
5. [Debugging Examples](#debugging-examples)

---

## Meta Injection Examples

### Example 1: Basic Article Meta Injection

**Request:**
```bash
curl http://localhost:3001/flash50
```

**Input (from MongoDB):**
```javascript
{
  slug: "flash50",
  title: "Flash Sale 50% - Đồ điện tử",
  description: "Mua sắm điện tử với giảm giá lên đến 50% trên Shopee",
  imageUrl: "https://cdn.example.com/flash50.jpg",
  author: "Admin",
  publishedAt: "2026-01-15T10:00:00Z"
}
```

**React Build Template (fragment):**
```html
<head>
  <title>__META_TITLE__</title>
  <meta name="description" content="__META_DESCRIPTION__"/>
  <meta property="og:title" content="__META_TITLE__"/>
  <meta property="og:description" content="__META_DESCRIPTION__"/>
  <meta property="og:image" content="__META_IMAGE__"/>
  <meta property="og:url" content="__META_URL__"/>
  <meta property="article:author" content="__META_AUTHOR__"/>
  <meta property="article:published_time" content="__META_PUBLISHED_TIME__"/>
</head>
```

**After Injection:**
```html
<head>
  <title>Flash Sale 50% - Đồ điện tử</title>
  <meta name="description" content="Mua sắm điện tử với giảm giá lên đến 50% trên Shopee"/>
  <meta property="og:title" content="Flash Sale 50% - Đồ điện tử"/>
  <meta property="og:description" content="Mua sắm điện tử với giảm giá lên đến 50% trên Shopee"/>
  <meta property="og:image" content="https://cdn.example.com/flash50.jpg"/>
  <meta property="og:url" content="http://localhost:3001/flash50"/>
  <meta property="article:author" content="Admin"/>
  <meta property="article:published_time" content="2026-01-15T10:00:00Z"/>
</head>
```

### Example 2: Escape HTML to Prevent XSS

**Input (malicious):**
```javascript
{
  title: 'Deal Hot <script>alert("XSS")</script>',
  description: 'Click here: " onclick="alert(1)"'
}
```

**Escape Function:**
```javascript
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Result:
escapeHtml(title);
// Output: "Deal Hot &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;"
```

**Safe HTML Output:**
```html
<title>Deal Hot &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</title>
<!-- Browser renders as plain text -->
```

### Example 3: 404 Handling

**Request:**
```bash
curl http://localhost:3001/nonexistent
```

**Controller Logic:**
```javascript
const link = await linkServiceMongo.getLinkBySlug('nonexistent');

if (!link) {
  return renderWithMeta(res, {
    title: 'Không tìm thấy bài viết - Hot News',
    description: 'Bài viết bạn tìm kiếm không tồn tại hoặc đã bị xóa.',
    imageUrl: 'https://via.placeholder.com/1200x630',
    url: currentUrl
  });
}
```

**Response:**
```html
<title>Không tìm thấy bài viết - Hot News</title>
<!-- React will show 404 component on client-side -->
```

### Example 4: Template Caching

**First Request:**
```javascript
// File I/O happens
cachedTemplate = fs.readFileSync('frontend/build/index.html', 'utf8');
templateLastModified = stats.mtimeMs;
// ~5-10ms to read file

// String replacement
html = injectMetaTags(cachedTemplate, meta);
// ~1-2ms for regex replacement
```

**Subsequent Requests:**
```javascript
// Check file modification time (very fast)
if (cachedTemplate && stats.mtimeMs === templateLastModified) {
  // Use cached version
  html = injectMetaTags(cachedTemplate, meta);
  // ~1-2ms (no file I/O)
}
```

**Performance Impact:**
- First request: 5-10ms
- Subsequent requests: 1-2ms
- Build-time cache invalidation: Automatic

---

## Banner System Examples

### Example 1: Request Random Banner

**Frontend Code:**
```javascript
const fetchBanner = async () => {
  const device = isMobile ? 'mobile' : 'desktop';
  
  const response = await fetch(
    `${API_URL}/api/banners/random?` +
    `type=sticky_bottom&` +
    `device=${device}&` +
    `articleSlug=${slug}`
  );

  if (response.ok) {
    const data = await response.json();
    if (data.success) {
      setBanner(data.data); // Store banner in state
    }
  }
};
```

**Backend Route:**
```javascript
router.get('/random', bannerController.getRandom);
```

**Backend Handler:**
```javascript
const getRandom = async (req, res) => {
  const { type = 'sticky_bottom', device, articleSlug, category } = req.query;

  // Get random active banner with weighted selection
  const banner = await Banner.getRandomActive(type, {
    device,
    articleSlug,
    category
  });

  if (!banner) {
    return res.status(404).json({
      success: false,
      error: 'No active banner found'
    });
  }

  // Increment impression counter
  await banner.recordImpression();

  // Return safe response
  res.json({
    success: true,
    data: {
      id: banner._id,
      name: banner.name,
      imageUrl: banner.imageUrl,
      mobileImageUrl: banner.mobileImageUrl,
      targetSlug: banner.targetSlug,
      showDelay: banner.showDelay,
      autoHideAfter: banner.autoHideAfter,
      dismissible: banner.dismissible
    }
  });
};
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "iPhone 15 50%",
    "imageUrl": "https://cdn.example.com/iphone.jpg",
    "mobileImageUrl": "https://cdn.example.com/iphone-mobile.jpg",
    "targetSlug": "iphone15",
    "showDelay": 2000,
    "autoHideAfter": 0,
    "dismissible": true
  }
}
```

### Example 2: Weighted Random Selection (A/B Testing)

**Banner Data in MongoDB:**
```javascript
[
  {
    _id: "banner_a",
    name: "Design A",
    weight: 70,  // 70% chance
    stats: { impressions: 1000 }
  },
  {
    _id: "banner_b",
    name: "Design B",
    weight: 30,  // 30% chance
    stats: { impressions: 0 }
  }
]
```

**Selection Algorithm:**
```javascript
BannerSchema.statics.getRandomActive = async function(type, options) {
  const query = { isActive: true, type };
  const banners = await this.find(query);

  // Calculate total weight
  const totalWeight = banners.reduce((sum, b) => sum + b.weight, 0);
  
  // Generate random number 0 to totalWeight
  let random = Math.random() * totalWeight;
  
  // Find which banner this random number falls into
  for (let banner of banners) {
    random -= banner.weight;
    if (random <= 0) return banner;  // Selected!
  }
  
  return banners[0]; // Fallback
};
```

**Visual Representation:**
```
Total weight: 70 + 30 = 100

Random 0-100:
[0 -------- 70 -------- 100]
  Banner A    Banner B

If random = 45  → Banner A (selected)
If random = 85  → Banner B (selected)
```

**Probability Distribution:**
```
Runs: 10000
Banner A weight 70: selected ~7000 times (70%)
Banner B weight 30: selected ~3000 times (30%)
```

### Example 3: Record Banner Click

**Frontend Code:**
```javascript
const handleBannerClick = async (bannerData) => {
  try {
    // Record click on backend
    await fetch(`${API_URL}/api/banners/${bannerData.id}/click`, {
      method: 'POST'
    });
  } catch (e) {
    console.log('Click tracking failed:', e);
  }
  
  // Redirect user
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
};
```

**Backend Route:**
```javascript
router.post('/:id/click', bannerController.recordClick);
```

**Backend Handler:**
```javascript
const recordClick = async (req, res) => {
  const { id } = req.params;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  const banner = await Banner.findById(id);
  if (!banner) {
    return res.status(404).json({ success: false, error: 'Banner not found' });
  }

  // Record click (includes unique IP tracking)
  await banner.recordClick(ip);

  res.json({ success: true, message: 'Click recorded' });
};
```

**MongoDB Update:**
```javascript
// Before
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  stats: {
    impressions: 100,
    clicks: 15,
    ctr: 15.0,
    clickedIPs: ["192.168.1.1", "10.0.0.5"]
  }
}

// After recordClick("192.168.1.1")
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  stats: {
    impressions: 100,
    clicks: 16,        // +1
    ctr: 16.0,         // Recalculated
    clickedIPs: ["192.168.1.1", "10.0.0.5"]  // Same IP not re-added
  }
}

// After recordClick("172.16.0.1")
{
  stats: {
    impressions: 100,
    clicks: 17,
    ctr: 17.0,
    clickedIPs: ["192.168.1.1", "10.0.0.5", "172.16.0.1"]  // New IP added
  }
}
```

### Example 4: Admin - Create Banner

**Frontend Form:**
```javascript
const handleCreateBanner = async (formData) => {
  const response = await fetch(`${API_URL}/api/banners`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'iPhone 15 Launch',
      imageUrl: 'https://cdn.example.com/iphone.jpg',
      mobileImageUrl: 'https://cdn.example.com/iphone-mobile.jpg',
      targetSlug: 'iphone15',
      type: 'sticky_bottom',
      weight: 50,
      priority: 10,
      desktopOnly: false,
      mobileOnly: false,
      targetArticles: [],
      targetCategories: [],
      startDate: '2026-01-20',
      endDate: '2026-01-31',
      altText: 'iPhone 15 50% discount',
      showDelay: 2000,
      autoHideAfter: 0,
      dismissible: true
    })
  });
};
```

**Backend Route:**
```javascript
router.post('/', authenticate, requireAdmin, bannerController.create);
```

**Database Result:**
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  name: 'iPhone 15 Launch',
  imageUrl: 'https://cdn.example.com/iphone.jpg',
  mobileImageUrl: 'https://cdn.example.com/iphone-mobile.jpg',
  targetSlug: 'iphone15',
  type: 'sticky_bottom',
  isActive: true,
  weight: 50,
  priority: 10,
  desktopOnly: false,
  mobileOnly: false,
  targetArticles: [],
  targetCategories: [],
  startDate: ISODate("2026-01-20T00:00:00Z"),
  endDate: ISODate("2026-01-31T23:59:59Z"),
  altText: 'iPhone 15 50% discount',
  showDelay: 2000,
  autoHideAfter: 0,
  dismissible: true,
  stats: {
    impressions: 0,
    clicks: 0,
    ctr: 0,
    uniqueClicks: 0,
    clickedIPs: []
  },
  createdAt: ISODate("2026-01-15T12:00:00Z"),
  updatedAt: ISODate("2026-01-15T12:00:00Z")
}
```

---

## Frontend Integration

### Example: ArticleDetail Component

```javascript
import React, { useEffect, useState, useCallback } from 'react';
import { StickyBanner } from './components/StickyBanner';

const ArticleDetail = () => {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const isMobile = /Mobile|Android/i.test(navigator.userAgent);
  
  // Fetch article on mount
  useEffect(() => {
    fetchArticle();
    fetchBanner();
  }, [slug]);

  // Fetch article content
  const fetchArticle = async () => {
    try {
      const response = await fetch(`${API_URL}/api/links/${slug}`);
      const data = await response.json();
      setArticle(data.data);
    } catch (error) {
      console.error('Failed to fetch article:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch banner for this article
  const fetchBanner = async () => {
    try {
      const device = isMobile ? 'mobile' : 'desktop';
      const response = await fetch(
        `${API_URL}/api/banners/random?` +
        `type=sticky_bottom&device=${device}&articleSlug=${slug}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setBanner(data.data);
        }
      }
    } catch (error) {
      console.log('Banner fetch failed:', error);
    }
  };

  // Handle banner click
  const handleBannerClick = async (bannerData) => {
    // Record click
    try {
      await fetch(`${API_URL}/api/banners/${bannerData.id}/click`, {
        method: 'POST'
      });
    } catch (e) {
      // Fail silently
    }

    // Redirect
    const targetUrl = `${BRIDGE_SERVER_URL}/go/${bannerData.targetSlug}`;
    if (isMobile) {
      window.location.href = targetUrl;
    } else {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ paddingBottom: banner ? 100 : 0 }}>
      {/* Article Content */}
      <article>
        <h1>{article.title}</h1>
        <img src={article.imageUrl} alt={article.title} />
        <p>{article.description}</p>
      </article>

      {/* Banner at bottom */}
      {banner && (
        <StickyBanner banner={banner} onBannerClick={handleBannerClick} />
      )}
    </div>
  );
};

export default ArticleDetail;
```

---

## Testing Examples

### Example 1: curl Tests for Meta Injection

```bash
# Test 1: Get HTML with meta tags
curl -I http://localhost:3001/flash50
# Look for: Content-Type: text/html

# Test 2: Check og:title meta tag
curl -s http://localhost:3001/flash50 | \
  grep -o 'og:title" content="[^"]*"'
# Output: og:title" content="Flash Sale 50%"

# Test 3: Verify escaping
curl -s "http://localhost:3001/test-xss" | \
  grep -o 'og:title" content="[^"]*"'
# Should be: og:title" content="Deal Hot &lt;script&gt;"

# Test 4: Bot detection
curl -H "User-Agent: facebookexternalhit" http://localhost:3001/flash50 | \
  head -c 200
# Should return HTML instead of redirect
```

### Example 2: JavaScript Tests (Frontend)

```javascript
// Test banner API
const testBannerAPI = async () => {
  const response = await fetch(
    'http://localhost:3001/api/banners/random?type=sticky_bottom&device=desktop'
  );
  
  const data = await response.json();
  
  console.log('Success:', data.success);
  console.log('Banner:', data.data);
  console.assert(data.success === true, 'Banner API failed');
  console.assert(data.data.imageUrl, 'No image URL');
};

// Test click tracking
const testClickTracking = async () => {
  const bannerId = '507f1f77bcf86cd799439011';
  
  const response = await fetch(
    `http://localhost:3001/api/banners/${bannerId}/click`,
    { method: 'POST' }
  );
  
  const data = await response.json();
  console.log('Click tracked:', data.success);
  console.assert(data.success === true, 'Click tracking failed');
};
```

### Example 3: MongoDB Tests

```javascript
// Check link data
db.links.findOne({slug: "flash50"});

// Check click logs
db.links.findOne({slug: "flash50"}).clickLogs;

// Count clicks
db.links.findOne({slug: "flash50"}).clickLogs.length;

// Check banner data
db.banners.findOne({name: "iPhone 15 Launch"});

// Check banner statistics
db.banners.aggregate([
  {
    $group: {
      _id: null,
      totalImpressions: { $sum: "$stats.impressions" },
      totalClicks: { $sum: "$stats.clicks" },
      avgCTR: { $avg: "$stats.ctr" }
    }
  }
]);

// Find active banners
db.banners.find({
  isActive: true,
  startDate: { $lte: new Date() },
  endDate: { $gte: new Date() }
});
```

---

## Debugging Examples

### Example 1: Debug Missing Meta Tags

**Problem:** Social media preview doesn't show meta tags

**Debugging Steps:**

```bash
# Step 1: Check if server returns HTML
curl http://localhost:3001/flash50 | head -100

# Step 2: Check if placeholders exist in build
grep __META_TITLE__ frontend/build/index.html

# Step 3: Check if template is being cached
# Look in server logs for: "[RenderController] React template loaded"

# Step 4: Verify link exists in MongoDB
mongo
> db.links.findOne({slug: "flash50"})

# Step 5: Check renderController code
vi backend/src/controllers/renderController.js
# Search for: injectMetaTags
```

**Solution Checklist:**
- [ ] Run: `npm run build` in frontend
- [ ] Restart backend server
- [ ] Verify placeholders in build file
- [ ] Check MongoDB for link data
- [ ] Test with: `curl http://localhost:3001/flash50 | grep og:title`

### Example 2: Debug Banner Not Showing

**Problem:** Banner API returns 404

**Debugging Steps:**

```javascript
// Step 1: Check if banner exists
db.banners.find()

// Step 2: Check if banner is active
db.banners.findOne().isActive  // Should be: true

// Step 3: Check date range
db.banners.findOne().startDate  // Should be: null or <= now
db.banners.findOne().endDate    // Should be: null or >= now

// Step 4: Check API route
curl "http://localhost:3001/api/banners/random?type=sticky_bottom"

// Step 5: Check MongoDB logs
// Add banner manually
db.banners.insertOne({
  name: "Test Banner",
  imageUrl: "https://via.placeholder.com/1200x100",
  targetSlug: "flash50",
  type: "sticky_bottom",
  isActive: true,
  weight: 50,
  priority: 10,
  stats: { impressions: 0, clicks: 0, ctr: 0 }
})

// Retry API
curl "http://localhost:3001/api/banners/random?type=sticky_bottom"
```

**Solution Checklist:**
- [ ] Verify banner exists in MongoDB
- [ ] Check isActive = true
- [ ] Verify startDate is in past or null
- [ ] Verify endDate is in future or null
- [ ] Test API directly
- [ ] Check server logs for errors

### Example 3: Performance Debugging

```javascript
// Add timing logs to renderController

const renderArticle = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const link = await linkServiceMongo.getLinkBySlug(slug);
    const fetchTime = Date.now();
    
    const template = getReactTemplate();
    const templateTime = Date.now();
    
    const html = injectMetaTags(template, {
      title: link.title,
      // ... other meta
    });
    const injectTime = Date.now();
    
    console.log(`📊 Timing:
      - Fetch link: ${fetchTime - startTime}ms
      - Get template: ${templateTime - fetchTime}ms
      - Inject meta: ${injectTime - templateTime}ms
      - Total: ${injectTime - startTime}ms
    `);
    
    res.send(html);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

## Quick Reference

### Meta Tag Placeholders
```
__META_TITLE__          → link.title
__META_DESCRIPTION__    → link.description
__META_IMAGE__          → link.imageUrl
__META_URL__            → Full request URL
__META_SITE_NAME__      → "Hot News"
__META_TYPE__           → "article"
__META_AUTHOR__         → link.author
__META_PUBLISHED_TIME__ → ISO timestamp
```

### Banner Weights (A/B Testing)
```
Weight: 70 + Weight: 30
= 70% Banner A, 30% Banner B

Weight: 50 + Weight: 50
= 50% Banner A, 50% Banner B (equal)

Weight: 90 + Weight: 10
= 90% Banner A, 10% Banner B (winner-heavy)
```

### Response Status Codes
```
200: Success
400: Bad request (validation)
404: Not found (no banner)
500: Server error
```

---

**For more examples, see the actual controller code:**
- `backend/src/controllers/renderController.js`
- `backend/src/controllers/bannerController.js`
- `frontend/src/components/ArticleDetail.js`
