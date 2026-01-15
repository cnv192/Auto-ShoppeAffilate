# 🛍️ Shoppe Link Management System

## Mục Đích Dự Án

Hệ thống quản lý liên kết thông minh cho Shopee Marketing với các tính năng:
- **Smart Routing**: Tự động xác định loại request (Bot/User) và trả về dữ liệu phù hợp
- **Deep Linking**: Hỗ trợ chuyển hướng an toàn cho cả Desktop và Mobile
- **Facebook Marketing Automation**: Tự động hóa comment trên Facebook posts
- **Banner Management**: Hệ thống quảng cáo động với A/B testing
- **Campaign Scheduling**: Lên lịch và quản lý các chiến dịch marketing
- **Real-time Analytics**: Thống kê click, IP tracking, device detection

---

## 🏗️ Kiến Trúc Chung

```
Shoppe/
├── backend/              # Node.js + Express API Server (Port 3001)
├── frontend/             # React Admin Dashboard (Port 3000)
├── bridge-server/        # Proxy Server để xử lý Deep Linking (Port 3002)
└── facebook-sync-extension/  # Chrome Extension để đồng bộ Facebook
```

---

## 📦 Backend (`/backend`)

### Cấu Trúc Thư Mục

```
backend/
├── src/
│   ├── server.js                      # Entry point chính
│   ├── config/
│   │   ├── mongodb.js                # Kết nối MongoDB
│   │   └── redis.js                  # Kết nối Redis
│   ├── models/                       # MongoDB Schemas
│   │   ├── User.js                  # User model (admin/user roles)
│   │   ├── Link.js                  # Link model (rút gọn URL + tracking)
│   │   ├── Campaign.js              # Campaign model (chiến dịch Facebook)
│   │   ├── Banner.js                # Banner model (quảng cáo)
│   │   ├── FacebookAccount.js       # Tài khoản Facebook
│   │   └── ResourceSet.js           # Tập hợp tài nguyên
│   ├── controllers/
│   │   ├── bannerController.js      # Logic xử lý banner
│   │   ├── renderController.js      # Render HTML + Open Graph
│   │   └── resourceSetController.js # Quản lý resource sets
│   ├── middleware/
│   │   ├── auth.js                  # JWT authentication
│   │   ├── ipFilter.js              # IP filtering + IP2Location lookup
│   │   ├── imageOptimizer.js        # Tối ưu hóa ảnh
│   │   ├── smartRouting.js          # Smart routing (bot detection)
│   │   └── uploadHandler.js         # Xử lý upload file
│   ├── routes/                       # API Routes
│   │   ├── linkRoutes.js            # CRUD links
│   │   ├── redirectRoutes.js        # Redirect URLs
│   │   ├── authRoutes.js            # Authentication
│   │   ├── campaignRoutes.js        # Chiến dịch Facebook
│   │   ├── bannerRoutes.js          # Quản lý banner
│   │   ├── dashboardRoutes.js       # Dashboard statistics
│   │   ├── userRoutes.js            # User management
│   │   ├── uploadRoutes.js          # File upload (Cloudinary)
│   │   ├── cloudinaryRoutes.js      # Cloudinary API wrapper
│   │   ├── facebookAccountRoutes.js # Tài khoản Facebook
│   │   ├── extensionRoutes.js       # Extension integration
│   │   ├── resourceSetRoutes.js     # Resource management
│   │   ├── accountRoutes.js         # Account operations
│   │   ├── debugRoutes.js           # Debug endpoints
│   │   └── redirectRoutes.js        # Redirect logic
│   ├── services/
│   │   ├── linkServiceMongo.js      # Link CRUD operations
│   │   ├── linkService.js           # Legacy link service
│   │   ├── campaignScheduler.js     # Cron job scheduling
│   │   ├── facebookAutomationService.js  # Facebook API automation
│   │   ├── facebookCrawler.js       # Facebook post crawler
│   │   └── uploadService.js         # Upload & image optimization
│   └── tests/
│       ├── testDualModeComment.js    # Test dual-mode commenting
│       └── testFacebookCrawler.js    # Test Facebook crawler
├── sample.bin.db11/                 # IP2Location database
├── sample6.bin.db11/                # IP2Location database (alternative)
└── package.json                     # Dependencies
```

### Models Chi Tiết

#### **User Model** (`src/models/User.js`)
```javascript
{
  username: String,           // Unique, lowercase
  password: String,           // Hashed with bcrypt
  role: 'admin' | 'user',    // Authorization level
  fullName: String,          // Display name
  email: String,             // Optional
  phone: String,             // Optional
  isActive: Boolean,         // Account status
  stats: {
    totalLinks: Number,
    totalClicks: Number,
    totalCampaigns: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### **Link Model** (`src/models/Link.js`)
```javascript
{
  slug: String,              // Unique, used in URLs
  title: String,             // Display title
  targetUrl: String,         // Destination URL
  description: String,       // SEO meta description
  imageUrl: String,          // Open Graph image
  category: String,          // e.g., "Khuyến mãi", "Flash Sale"
  author: String,            // Content author
  userId: ObjectId,          // Owner reference
  
  // Tracking data
  clickLogs: [{
    ip: String,
    userAgent: String,
    referer: String,
    device: 'desktop|mobile|tablet',
    isValid: Boolean,
    clickedAt: Date
  }],
  
  // Statistics
  totalClicks: Number,
  validClicks: Number,       // Only valid user clicks
  uniqueIPs: Number,
  
  // Status
  isActive: Boolean,
  expiresAt: Date,           // Optional expiration
  publishedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### **Campaign Model** (`src/models/Campaign.js`)
```javascript
{
  name: String,
  description: String,
  userId: ObjectId,          // Campaign owner
  
  // Content
  slugs: [String],           // List of Shopee links to comment
  commentTemplates: [String], // Random comments to post
  
  // Scheduling
  startTime: String,         // HH:mm format
  durationHours: Number,     // Campaign duration
  startDate: Date,           // Start date
  
  // Targeting filters
  minLikes: Number,
  minComments: Number,
  minShares: Number,
  
  // Frequency control
  maxCommentsPerPost: Number,
  
  // Status tracking
  status: 'active'|'paused'|'stopped'|'completed',
  
  // Safety info
  blockedAt: Date,           // When account got blocked
  totalComments: Number,     // Sent comments count
  
  createdAt: Date,
  updatedAt: Date
}
```

#### **Banner Model** (`src/models/Banner.js`)
```javascript
{
  name: String,              // Internal name
  type: 'sticky_bottom'|'popup'|'inline', // Banner type
  
  // Image URLs
  imageUrl: String,          // Desktop image
  mobileImageUrl: String,    // Mobile image
  altText: String,
  
  // Target
  targetSlug: String,        // Link to redirect to
  targetUrl: String,         // Full URL
  
  // Display settings
  device: 'desktop'|'mobile'|'all',
  showDelay: Number,         // ms before showing
  autoHideAfter: Number,     // ms to auto-hide
  dismissible: Boolean,      // Allow close button
  
  // A/B Testing
  variant: String,           // A, B, C...
  
  // Stats
  stats: {
    impressions: Number,
    clicks: Number,
    ctr: Number,             // Click-through rate
    uniqueClicks: Number,
    clickedIPs: [String]
  },
  
  // Targeting
  articleSlug: String,       // Show on specific article
  displayOn: 'all'|'specific',
  
  isActive: Boolean,
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Services Chi Tiết

#### **linkServiceMongo.js**
- CRUD operations cho Links
- Click tracking và validation
- IP-based unique click counting
- Data initialization

#### **facebookAutomationService.js** (3600+ lines)
- **Desktop GraphQL API Integration**: Gửi comment qua Desktop Chrome simulation
- **Dual-Mode Commenting**:
  - Mode A: Comment trực tiếp trên posts
  - Mode B: Reply to comments với name substitution
- **Desktop HTML Scraping**: Crawl feed để lấy post IDs
- **Security**: Cookie-based authentication, jazoest token generation
- **Auto-stop**: Tự động dừng khi bị block

#### **facebookCrawler.js**
- Desktop Chrome headers simulation
- URL parsing và normalization
- Feed HTML extraction
- Bot detection prevention

#### **campaignScheduler.js**
- Cron job scheduling cho campaigns
- Automatic campaign execution
- Status tracking và updates

#### **uploadService.js**
- Cloudinary integration
- Image optimization với Sharp
- File validation

### Middleware Chi Tiết

#### **smartRouting.js** (Smart Routing Middleware)
**Purpose**: Phân biệt giữa Bot requests và User requests

**Logic Flow**:
```
Request → Check User-Agent
  ├─ Is Preview Bot (Facebook, Twitter, Zalo)?
  │  └─ Return HTML with Open Graph meta tags
  ├─ Check IP address (IP2Location)
  │  ├─ Is Datacenter/Bot?
  │  │  └─ Don't count click
  │  └─ Is from Vietnam?
  │     └─ Count valid click in MongoDB
  └─ Track in Redis (Rate limiting)
```

**Supported Bot Detection**:
- facebookexternalhit, facebookcatalog, facebot
- twitterbot, zalo, googlebot
- linkedinbot, telegrambot, discordbot, slackbot
- whatsapp, pinterest, skypeuripreview, line-poker

#### **ipFilter.js**
- IP2Location database lookup
- Detect datacenter/proxy IPs
- Get country, ISP, region info
- Cache results in Redis

#### **auth.js**
- JWT token validation
- User role checking (admin/user)
- Optional authentication middleware

#### **imageOptimizer.js**
- Resize images
- Format conversion
- Compression

#### **uploadHandler.js**
- Multer integration
- File validation
- Cloudinary storage

### Routes Overview

| Route | Method | Auth | Mục Đích |
|-------|--------|------|---------|
| `/api/links/public` | GET | ❌ | Lấy danh sách public links |
| `/api/links` | GET | ✅ | Lấy links của user |
| `/api/links` | POST | ✅ | Tạo link mới |
| `/api/links/:id` | PUT | ✅ | Cập nhật link |
| `/api/links/:id` | DELETE | ✅ | Xóa link |
| `/api/links/:slug/track` | POST | ❌ | Tracking view |
| `/api/links/:slug` | GET | ❌ | Chi tiết link |
| `/go/:slug` | GET | ❌ | Redirect (Smart Routing) |
| `/api/banners/random` | GET | ❌ | Random banner |
| `/api/campaigns` | GET/POST | ✅ | Campaign management |
| `/api/auth/login` | POST | ❌ | User login |
| `/api/auth/logout` | POST | ✅ | User logout |
| `/api/dashboard/*` | GET | ✅ | Analytics & stats |
| `/api/upload` | POST | ✅ | File upload |

### Configuration Files

#### **config/mongodb.js**
- Kết nối MongoDB
- Connection pooling
- Error handling

#### **config/redis.js**
- Kết nối Redis
- Cache layer
- Rate limiting

---

## 🎨 Frontend (`/frontend`)

### Cấu Trúc Thư Mục

```
frontend/
├── src/
│   ├── App.js                        # Main routing component
│   ├── index.js                      # React DOM render
│   ├── components/
│   │   ├── HomePage.js              # Homepage (articles list)
│   │   ├── ArticleDetail.js         # Single article page
│   │   ├── Login.js                 # Login page
│   │   ├── AdminLayout.js           # Admin sidebar layout
│   │   ├── Dashboard.js             # Admin dashboard
│   │   ├── LinksPage.js             # Links management page
│   │   ├── LinkForm.js              # Create/edit link form
│   │   ├── LinkFormArticle.js       # Article creation form
│   │   ├── LinkTable.js             # Links table with sorting
│   │   ├── CampaignList.js          # Campaigns list
│   │   ├── CampaignForm.js          # Campaign creation form
│   │   ├── FacebookAccountManager.js # Facebook account sync
│   │   ├── UserManagement.js        # Admin user management
│   │   ├── UserProfile.js           # User profile page
│   │   ├── ResourceManagement.js    # Resource sets management
│   │   ├── ExtensionSetupGuide.js   # Extension setup instructions
│   │   ├── PostIdExtractor.js       # Extract Facebook post IDs
│   │   ├── StatsCards.js            # Dashboard statistics cards
│   │   └── AdminDashboard.js        # Admin-only dashboard
│   ├── pages/
│   │   └── ExtensionAuthPage.js    # Extension OAuth page
│   ├── services/
│   │   ├── api.js                  # Axios configuration
│   │   ├── authService.js          # Authentication logic
│   │   ├── campaignService.js      # Campaign API calls
│   │   └── uploadService.js        # Upload API calls
│   ├── config/
│   │   └── api.js                  # API endpoints
│   └── index.js                     # Entry point
├── public/
│   └── index.html                   # HTML template
└── package.json                     # Dependencies
```

### Components Chi Tiết

#### **Homepage.js** - Trang Chủ
- Hiển thị danh sách links (articles) mới nhất
- Search & filter by category
- Hot links section (trending)
- Responsive design

#### **ArticleDetail.js** - Chi Tiết Bài Viết
- Full article content display
- Meta information (author, date, views)
- Cookie injection iframe (affiliate tracking)
- Banner system with sticky bottom
- Deep link redirect logic

**Key Features**:
```javascript
- injectCookieIframe(): Tạo invisible iframe để seed cookies
- handleBannerClick(): Xử lý click banner (mobile vs desktop)
- handleRedirect(): Smart redirect dựa vào device type
- trackView(): Gửi tracking data
```

#### **AdminLayout.js** - Admin Sidebar Layout
- Navigation menu
- User authentication check
- Role-based access control
- Responsive sidebar

#### **Dashboard.js** - Admin Dashboard
- Key metrics cards (total clicks, links, campaigns)
- Charts with Recharts
- Recent activity log
- Performance statistics

#### **LinksPage.js** - Links Management
- List tất cả links
- Create/Edit/Delete operations
- Bulk actions
- Sorting & filtering

#### **LinkForm.js** - Link Creation Form
- Form fields:
  - Slug (URL slug)
  - Title
  - Target URL
  - Description
  - Image URL
  - Category
  - Author
  - Status
- Image preview
- Validation

#### **LinkTable.js** - Links Table Display
- Sortable columns
- Pagination
- Click stats display
- Edit/Delete actions

#### **CampaignList.js** - Campaign Management
- List active/paused/completed campaigns
- Status indicators
- Start/Stop/Pause actions
- Edit campaign

#### **CampaignForm.js** - Campaign Creation
- Form fields:
  - Campaign name
  - Description
  - Links (select multiple)
  - Comment templates
  - Schedule (start time, duration)
  - Targeting filters (min likes, comments, shares)
  - Frequency control
- Template management
- Status preview

#### **FacebookAccountManager.js** - Facebook Account Sync
- Connect Facebook account
- Account list
- Sync extension data
- Cookie management
- Token refresh

#### **UserManagement.js** - User Admin Panel
- Create new users
- Edit user info
- Change roles
- Deactivate accounts
- View stats

#### **ExtensionSetupGuide.js** - Extension Instructions
- Step-by-step setup guide
- Browser compatibility
- Permission explanation

#### **PostIdExtractor.js** - Facebook Post ID Tool
- Extract post IDs from URLs
- Batch extraction
- Copy to clipboard

### Services

#### **authService.js**
```javascript
- isAuthenticated()    // Check login status
- isAdmin()           // Check admin role
- login(username, password)
- logout()
- getToken()
- setToken(token)
- getUser()
- isTokenExpired()
```

#### **api.js** (Axios Instance)
```javascript
- baseURL: http://localhost:3001
- Default headers
- Interceptors for auth
- Error handling
```

#### **campaignService.js**
```javascript
- getCampaigns()
- createCampaign(data)
- updateCampaign(id, data)
- deleteCampaign(id)
- startCampaign(id)
- pauseCampaign(id)
- stopCampaign(id)
```

#### **uploadService.js**
```javascript
- uploadImage(file)
- uploadMultiple(files)
- getUploadProgress()
```

### Theme Configuration
- Primary color: #EE4D2D (Shopee red)
- UI Library: Ant Design v5
- Font: System fonts with fallback
- Border radius: 8px

---

## 🌐 Bridge Server (`/bridge-server`)

### Mục Đích
Proxy server để xử lý deep linking an toàn, kiểm tra link availability, và referrer washing.

### Cấu Trúc
```
bridge-server/
├── index.js              # Main server
└── package.json          # Dependencies (Express, Mongoose)
```

### Routes

#### `GET /go/:slug`
- Lấy link từ MongoDB
- Kiểm tra availability (active + not expired)
- Referrer washing (no-referrer-when-downgrade)
- Cache control headers
- Redirect người dùng

#### HTML Fallback
- 404 page nếu link không tồn tại

### Key Features
- Minimal MongoDB connection (chỉ cần links collection)
- Referrer policy management
- Cache prevention headers
- Safe redirect mechanism

---

## 🔌 Extension (`/facebook-sync-extension`)

### Mục Đích
Chrome extension để tự động hóa đồng bộ dữ liệu Facebook (cookies, tokens, posts).

### Cấu Trúc
```
facebook-sync-extension/
├── manifest.json         # Extension manifest (MV3)
├── bg.js                 # Background service worker
├── background.js         # Alternative background script
└── icons/
    ├── create-icons.js   # Icon generation script
    └── [icon files]      # PNG icons (16, 48, 128)
```

### Manifest v3 Config
```json
{
  "permissions": ["scripting", "activeTab", "tabs", "cookies"],
  "host_permissions": ["*://*.facebook.com/*", "http://localhost:3001/*"],
  "background": { "service_worker": "bg.js" }
}
```

### bg.js - Background Service Worker

#### Main Logic Flow
```
1. Click extension icon
   └─ Open admin page (http://localhost:3000/admin)

2. Detect sync URL (towblock_connect=1 parameter)
   ├─ Extract userId from URL
   └─ Execute extraction script

3. Extract Facebook data
   ├─ Get cookies
   ├─ Get access tokens
   ├─ Parse post data
   └─ Send to backend

4. Close tab after sync
```

#### Key Functions
- `chrome.action.onClicked`: Icon click handler
- `chrome.tabs.onUpdated`: Tab URL monitoring
- `chrome.scripting.executeScript`: Inject extraction script
- `sleep()`: Utility delay function

#### Extraction Process
1. Wait 2 seconds for Facebook to load
2. Inject content script
3. Collect cookies from document.cookie
4. Parse Facebook GraphQL data
5. Extract post IDs and metadata
6. Send to backend API
7. Close tab automatically

---

## 🗄️ Database Schema

### MongoDB Collections

#### **links**
- Stores all shortened links
- Indexed: slug, userId, isActive
- Includes click logs and statistics

#### **users**
- User accounts
- Indexed: username, email
- Stores role-based permissions

#### **campaigns**
- Facebook automation campaigns
- Indexed: userId, status
- Tracks scheduling and execution

#### **banners**
- Advertisement banners
- Indexed: type, device, articleSlug
- Includes performance metrics

#### **facebookaccounts**
- Connected Facebook accounts
- Stores cookies and tokens
- Indexed: userId

#### **resourcesets**
- Collection of resources (links, images, templates)
- Organized by type and category

### Redis Cache Keys
```
link:{slug}             // Cached link data
user:{userId}           // User session cache
campaign:{id}           // Campaign schedule
ip-info:{ip}           // IP location data (2hr TTL)
rate-limit:{ip}        // Request rate limiting
```

---

## 🔄 Data Flow Examples

### Example 1: User Clicks a Link (Smart Routing)

```
User clicks link → Request hits /go/:slug
│
├─ Is Preview Bot?
│  ├─ YES → Return HTML with Open Graph meta
│  │        (For Facebook preview)
│  └─ NO → Continue
│
├─ Get client IP
│  └─ Check against IP2Location DB
│
├─ Is Datacenter/Bot IP?
│  ├─ YES → Don't count click, redirect silently
│  └─ NO → Continue
│
├─ Is Valid User from Vietnam?
│  ├─ YES → Create ClickLog entry in MongoDB
│  │        Update stats
│  └─ NO → Log as invalid click
│
└─ Redirect user
   ├─ Check device type
   ├─ Set referrer policy
   └─ Send 301 redirect
```

### Example 2: Facebook Campaign Execution

```
Admin creates campaign
│
└─ Set schedule: startTime=08:00, durationHours=5
   │
   └─ Schedule cron job via node-cron
      │
      └─ At 08:00 (every day):
         ├─ Load campaign details
         ├─ Get Facebook account (cookie + token)
         ├─ Fetch feed posts using Desktop GraphQL
         ├─ Filter posts (minLikes, minComments, etc)
         │
         ├─ For each post:
         │  ├─ Select random slug
         │  ├─ Select random comment template
         │  ├─ Send comment via GraphQL API
         │  ├─ Wait random delay (1-3 min)
         │  └─ Check if comment was posted
         │
         ├─ Loop until duration expires (08:00 + 5 hours)
         │
         └─ Stop campaign
            ├─ Update status to 'completed'
            └─ Send notification
```

### Example 3: Article Display with Banner

```
User opens article page
│
└─ ArticleDetail component mounts
   │
   ├─ fetchArticle(slug)
   │  ├─ Call /api/links/:slug
   │  ├─ Track view with /api/links/:slug/track
   │  └─ Set article state
   │
   ├─ fetchBanner()
   │  ├─ Call /api/banners/random
   │  ├─ Filter by: type, device, articleSlug
   │  └─ Set banner state
   │
   └─ useEffect triggers if article && banner exist
      │
      └─ Call injectCookieIframe(banner.targetSlug)
         │
         ├─ Create hidden 1x1 iframe
         ├─ Set src to /go/:targetSlug
         ├─ Append to DOM
         └─ Remove after 5 seconds
            (Affiliate cookies seeded in localStorage)

User sees article + sticky banner at bottom
│
└─ User clicks banner
   │
   ├─ trackBannerClick()
   │  └─ POST /api/banners/:id/click
   │
   └─ Redirect based on device
      ├─ Mobile: window.location.href (deep link)
      └─ Desktop: window.open (new tab)
```

---

## 🔐 Authentication & Authorization

### User Roles

#### **Admin**
- ✅ View all links
- ✅ View all campaigns
- ✅ Manage users
- ✅ Access system statistics
- ✅ Delete any content

#### **User**
- ✅ Create/edit own links
- ✅ Create/manage own campaigns
- ✅ View own statistics
- ❌ View other users' data
- ❌ Manage users

### JWT Token
```javascript
{
  userId: ObjectId,
  username: String,
  role: 'admin'|'user',
  exp: Number (timestamp)
}
```

- Stored in localStorage
- Sent in Authorization header: `Bearer {token}`
- Validated on every protected route
- Expires after 7 days (configurable)

---

## 🚀 Running the Project

### Prerequisites
- Node.js 16+
- MongoDB 5+
- Redis 6+
- Chrome browser (for extension)

### Installation

```bash
# Backend
cd backend
npm install
cp .env.example .env  # Configure DB, Redis, Cloudinary

# Frontend
cd frontend
npm install
cp .env.example .env  # Configure API URL

# Bridge Server
cd bridge-server
npm install
cp .env.example .env  # Configure DB

# Extension
# Load in Chrome at chrome://extensions/
```

### Environment Variables

#### Backend (.env)
```
PORT=3001
MONGO_URI=mongodb://localhost:27017/shoppe
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_jwt_secret
CLOUDINARY_NAME=your_cloudinary
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
IP2LOCATION_DB_PATH=./sample.bin.db11
BRIDGE_SERVER_URL=http://localhost:3002
```

#### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:3001
REACT_APP_BRIDGE_URL=http://localhost:3002
```

#### Bridge Server (.env)
```
PORT=3002
MONGO_URI=mongodb://localhost:27017/shoppe
```

### Starting Services

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm start

# Terminal 3: Bridge Server
cd bridge-server && npm start

# Load Extension in Chrome
chrome://extensions/ → Load unpacked → Select facebook-sync-extension/
```

### Verify Setup
```
✅ Frontend: http://localhost:3000
✅ Backend: http://localhost:3001
✅ Bridge: http://localhost:3002
✅ Extension: Appears in Chrome toolbar
```

---

## 📊 Key Features Detailed

### 1. Smart Routing
- **Bot Detection**: Identifies Facebook, Twitter, Zalo bots
- **IP Filtering**: Uses IP2Location to block datacenters
- **Device Detection**: Separates mobile/desktop users
- **Open Graph**: Returns preview HTML for social sharing
- **Rate Limiting**: Redis-based request throttling

### 2. Deep Linking
- **Referrer Washing**: No-referrer policy for privacy
- **Device-specific**: Different behavior for mobile vs desktop
- **Affiliate Cookie Injection**: Hidden iframe for tracking
- **Expiration**: Links can expire after set date

### 3. Facebook Automation
- **Desktop GraphQL**: Uses standard Chrome headers
- **Dual-Mode Commenting**:
  - Direct post comments
  - Reply to specific comments with name substitution
- **Feed Crawler**: HTML scraping for post discovery
- **Safety Checks**: Auto-stop on block detection
- **Scheduling**: Cron-based campaign scheduling

### 4. Banner System
- **Dynamic Loading**: Random banner selection
- **A/B Testing**: Multiple banner variants
- **Device-specific**: Different images for mobile/desktop
- **Auto-hide**: Configurable display duration
- **Sticky Bottom**: Remains visible while scrolling
- **Click Tracking**: Measures CTR and engagement

### 5. Analytics
- **Click Tracking**: Individual click logs with IP, device, referer
- **Unique Visits**: Deduplicated by IP address
- **Geographic Data**: Country/region/city via IP2Location
- **Device Stats**: Desktop vs mobile breakdown
- **Real-time Dashboard**: Updated statistics

### 6. User Management
- **Role-based Access**: Admin vs User permissions
- **Permission Scoping**: Users see only their own data
- **Account Creation**: Admin creates accounts (no self-signup)
- **Status Management**: Activate/deactivate users

---

## 🛠️ Configuration & Customization

### Image Optimization
Located in `backend/src/middleware/imageOptimizer.js`
- Resize to 1200x630 (Open Graph recommended)
- Convert to WebP for web
- Compress with quality 80

### IP2Location Database
- Two sample databases included: `sample.bin.db11` and `sample6.bin.db11`
- Database file path configured in backend/.env
- Updates available from IP2Location.com

### Cloudinary Integration
- Image hosting and CDN
- Automatic optimization
- URL transformation API

### Campaign Scheduler
- Uses `node-cron` for scheduling
- Configurable timezone
- Auto-stop on errors

---

## 📝 API Documentation

### Public APIs (No Auth Required)

```
GET  /api/links/public              # Get all public links
GET  /:slug                         # Get link detail
GET  /api/banners/random            # Random banner
POST /api/links/:slug/track         # Track view
```

### Protected APIs (Auth Required)

```
GET    /api/links                   # Get user's links
POST   /api/links                   # Create link
PUT    /api/links/:id               # Update link
DELETE /api/links/:id               # Delete link

GET    /api/campaigns               # Get campaigns
POST   /api/campaigns               # Create campaign
PUT    /api/campaigns/:id           # Update campaign
DELETE /api/campaigns/:id           # Delete campaign
POST   /api/campaigns/:id/start     # Start campaign
POST   /api/campaigns/:id/pause     # Pause campaign
POST   /api/campaigns/:id/stop      # Stop campaign

GET    /api/dashboard/*             # Various statistics

POST   /api/auth/login              # User login
POST   /api/auth/logout             # User logout

GET    /api/users                   # List users (admin only)
POST   /api/users                   # Create user (admin only)
```

---

## 🐛 Troubleshooting

### Links Not Tracking
- Check if IP2Location database exists
- Verify MongoDB connection
- Check Redis cache
- Review smartRouting middleware logs

### Facebook Comments Not Posting
- Verify Facebook account cookies are valid
- Check if campaign is scheduled correctly
- Ensure fb_dtsg token is extracted
- Check for account blocks (auto-stop)

### Extension Not Syncing
- Check manifest.json permissions
- Verify server is running on port 3001
- Check browser console for errors
- Ensure userId parameter is in URL

### Banner Not Displaying
- Check if banner exists and is active
- Verify article slug matches
- Check device filter configuration
- Ensure showDelay hasn't passed

---

## 📚 Additional Resources

- **IP2Location**: www.ip2location.com
- **Ant Design**: ant.design
- **React Router**: reactrouter.com
- **Mongoose**: mongoosejs.com
- **Express**: expressjs.com
- **Recharts**: recharts.org

---

## 👥 Contributing

When adding new features:
1. Update relevant model/schema
2. Add route endpoint
3. Implement controller logic
4. Add middleware if needed
5. Update frontend component
6. Add error handling
7. Test with real data

---

## 📄 License

Proprietary - Shoppe Link Management System

---

## 📞 Support

For issues or questions:
- Check logs: `backend/server.js`, `frontend/App.js`
- Review MongoDB collections for data integrity
- Test APIs with Postman
- Check browser console for frontend errors

---

**Last Updated**: January 15, 2026
**Version**: 1.0.0
**Status**: Production Ready
