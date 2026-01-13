# 🛒 Shopee Link Management System

Hệ thống quản lý link thông minh với các tính năng:
- **Smart Routing Middleware**: Phân biệt bot preview và người dùng thực
- **Deep Link Redirect**: Tự động mở app Shopee trên mobile
- **Admin Dashboard**: Giao diện quản trị đẹp mắt với Ant Design

## 📁 Cấu trúc dự án

```
Shoppe/
├── backend/                    # Node.js + Express Backend
│   ├── src/
│   │   ├── config/
│   │   │   └── redis.js       # Cấu hình Redis
│   │   ├── middleware/
│   │   │   └── smartRouting.js # Middleware phân luồng thông minh
│   │   ├── routes/
│   │   │   ├── linkRoutes.js  # API quản lý links
│   │   │   └── redirectRoutes.js # Xử lý redirect
│   │   ├── services/
│   │   │   └── linkService.js # Business logic
│   │   ├── views/
│   │   │   ├── redirect.ejs   # Trang redirect với Deep Link
│   │   │   ├── preview.ejs    # Trang preview cho bot
│   │   │   └── error.ejs      # Trang lỗi
│   │   └── server.js          # Entry point
│   ├── .env                   # Environment variables
│   └── package.json
│
└── frontend/                   # React + Ant Design Frontend
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── LinkTable.js   # Bảng danh sách links
    │   │   ├── LinkForm.js    # Form tạo/sửa link
    │   │   └── StatsCards.js  # Thẻ thống kê
    │   ├── services/
    │   │   └── api.js         # API service
    │   ├── App.js             # Main component
    │   └── index.js           # Entry point
    └── package.json
```

## 🚀 Cài đặt và Chạy

### Yêu cầu
- Node.js >= 16
- Redis Server (không bắt buộc, hệ thống vẫn chạy được)

### 1. Cài đặt Redis (Optional)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Windows:**
- Tải từ: https://github.com/microsoftarchive/redis/releases
- Hoặc dùng Docker: `docker run -d -p 6379:6379 redis`

### 2. Chạy Backend

```bash
cd backend
npm install
npm run dev     # Development mode với nodemon
# hoặc
npm start       # Production mode
```

Backend sẽ chạy tại: `http://localhost:3001`

### 3. Chạy Frontend

```bash
cd frontend
npm install
npm start
```

Frontend sẽ chạy tại: `http://localhost:3000`

## 📖 Hướng dẫn sử dụng

### API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/links` | Lấy danh sách tất cả links |
| GET | `/api/links/:slug` | Lấy thông tin một link |
| GET | `/api/links/:slug/stats` | Lấy thống kê link |
| POST | `/api/links` | Tạo link mới |
| PUT | `/api/links/:slug` | Cập nhật link |
| DELETE | `/api/links/:slug` | Xóa link |
| GET | `/:slug` | Redirect đến link đích |

### Tạo Link mới

```json
POST /api/links
{
    "title": "🔥 Flash Sale Shopee",
    "targetUrl": "https://shopee.vn/flash_sale",
    "imageUrl": "https://cf.shopee.vn/file/...",
    "customSlug": "flash50"  // Optional
}
```

### Sample Links (đã tạo sẵn)

- `http://localhost:3001/flash50` - Flash Sale
- `http://localhost:3001/iphone15` - iPhone 15
- `http://localhost:3001/fashion70` - Thời trang

## 🔧 Cấu hình

### Environment Variables (backend/.env)

```env
# Server
PORT=3001
NODE_ENV=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS
FRONTEND_URL=http://localhost:3000
```

## 📱 Cách hoạt động Deep Link

1. **Người dùng click link** (VD: `http://yoursite.com/flash50`)
2. **Backend kiểm tra User-Agent**:
   - Nếu là bot (Facebook, Zalo...) → Trả về HTML với Open Graph meta tags
   - Nếu là người dùng → Chuyển đến trang redirect
3. **Trang Redirect** kiểm tra thiết bị:
   - **Mobile**: Thử mở app Shopee qua `shopee://...`
   - Nếu app không cài → Fallback sang web sau 200ms
   - **Desktop**: Redirect thẳng đến web URL

## 🎨 UI Features

- ✅ Màu sắc chủ đạo: Trắng và Cam (#EE4D2D)
- ✅ Ant Design components
- ✅ Responsive design
- ✅ Dark mode support (có thể thêm)
- ✅ Loading states
- ✅ Error handling

## 📊 Tracking Features

- ✅ Đếm số click
- ✅ Lưu IP người truy cập
- ✅ Rate limiting (10 req/phút/IP)
- ✅ Thống kê theo ngày

## 🔒 Bảo mật

- Rate limiting chống spam
- Input validation
- CORS configuration
- XSS prevention

## 📝 License

MIT License

---

Made with ❤️ for Shopee Marketing
