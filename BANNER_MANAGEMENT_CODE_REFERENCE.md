# Banner Management - Code Integration Reference

## Quick Reference: Code Changes

### Summary of Changes
- **Files Created:** 1 (BannerManagement.js)
- **Files Modified:** 2 (App.js, AdminLayout.js)
- **Lines Added:** ~700
- **Integration Points:** 2 (route + menu)

---

## 1. New Component: BannerManagement.js

**Location:** `frontend/src/components/BannerManagement.js`

**File Size:** 650+ lines

**Imports Required:**
```javascript
import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, Switch, Space, 
         Spin, message, Image, Popconfirm, Card, Row, Col, Upload, Badge } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, EyeOutlined, EyeInvisibleOutlined } 
        from '@ant-design/icons';
import api from '../config/api';
```

**Key Functions:**
- `fetchBanners()` - Load all banners from API
- `handleAddBanner()` - Open create modal
- `handleEditBanner()` - Open edit modal with pre-filled data
- `handleSubmit()` - Save create/update to API
- `handleToggleActive()` - Toggle banner active status
- `handleDeleteBanner()` - Delete banner with confirmation

**Component Structure:**
```
BannerManagement
├── Card (Container)
│   ├── Title with "Thêm Banner" button
│   ├── Table (list of banners)
│   │   ├── Image preview column
│   │   ├── Name column
│   │   ├── Type column (with badges)
│   │   ├── Device column
│   │   ├── Priority column (sortable)
│   │   ├── Weight column
│   │   ├── Status column (toggle buttons)
│   │   └── Actions column (edit/delete)
│   └── Pagination
└── Modal (Create/Edit Form)
    ├── Banner name input
    ├── Desktop image URL input
    ├── Desktop image preview
    ├── Mobile image URL input
    ├── Mobile image preview
    ├── Target slug input
    ├── Type select dropdown
    ├── Device select dropdown
    ├── Weight input number
    ├── Priority input number
    ├── Active toggle switch
    └── Action buttons (Cancel/Create/Update)
```

---

## 2. App.js - Route Integration

**File:** `frontend/src/App.js`

**Import Added:**
```javascript
import BannerManagement from './components/BannerManagement';
```

**Route Added (Line 79):**
```javascript
<Route path="banners" element={<BannerManagement />} />
```

**Complete Nested Routes Section:**
```javascript
<Routes>
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="links" element={<LinksPage />} />
    <Route path="campaigns" element={<CampaignList />} />
    <Route path="banners" element={<BannerManagement />} />      {/* NEW */}
    <Route path="facebook" element={<FacebookAccountManager />} />
    <Route path="resources" element={<ResourceManagement />} />
    <Route path="profile" element={<UserProfile />} />
    {authService.isAdmin() && (
        <Route path="users" element={<UserManagement />} />
    )}
    <Route path="" element={<Navigate to="/admin/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
</Routes>
```

**Access URL:** `http://localhost:3000/admin/banners`

---

## 3. AdminLayout.js - Menu Integration

**File:** `frontend/src/components/AdminLayout.js`

**Icon Import Added:**
```javascript
import { FileImageOutlined } from '@ant-design/icons';
```

**Complete Icon Imports:**
```javascript
import {
    DashboardOutlined,
    LinkOutlined,
    UserOutlined,
    FacebookOutlined,
    ThunderboltOutlined,
    LogoutOutlined,
    SettingOutlined,
    FolderOutlined,
    FileImageOutlined                          {/* NEW */}
} from '@ant-design/icons';
```

**Menu Item Added (in menuItems array):**
```javascript
{
    key: 'banners',
    icon: <FileImageOutlined />,
    label: 'Quản lý Banner'
}
```

**Position in Menu:** Between "Chiến dịch" and "Resource Sets"

**Complete Menu Items Array:**
```javascript
const menuItems = useMemo(() => {
    const items = [
        {
            key: 'dashboard',
            icon: <DashboardOutlined />,
            label: 'Dashboard'
        },
        {
            key: 'links',
            icon: <LinkOutlined />,
            label: 'Quản lý Links'
        },
        {
            key: 'campaigns',
            icon: <ThunderboltOutlined />,
            label: 'Chiến dịch'
        },
        {
            key: 'banners',                     {/* NEW */}
            icon: <FileImageOutlined />,        {/* NEW */}
            label: 'Quản lý Banner'             {/* NEW */}
        },
        {
            key: 'resources',
            icon: <FolderOutlined />,
            label: 'Resource Sets'
        },
        {
            key: 'facebook',
            icon: <FacebookOutlined />,
            label: 'Tài khoản Facebook'
        }
    ];
    
    if (user && user.role === 'admin') {
        items.push({
            key: 'users',
            icon: <UserOutlined />,
            label: 'Quản lý User'
        });
    }
    
    return items;
}, [user]);
```

---

## API Endpoints Used

The BannerManagement component automatically calls these backend endpoints:

```javascript
// List all banners
GET /api/banners
Response: { data: [ { _id, name, imageUrl, ... }, ... ] }

// Create banner
POST /api/banners
Body: { name, imageUrl, mobileImageUrl, targetSlug, type, device, weight, priority, isActive }
Response: { data: { _id, ... } }

// Get single banner
GET /api/banners/:id
Response: { data: { _id, name, ... } }

// Update banner
PUT /api/banners/:id
Body: { name, imageUrl, ... }
Response: { data: { _id, ... } }

// Delete banner
DELETE /api/banners/:id
Response: { message: "Banner deleted" }

// Toggle active status
POST /api/banners/:id/toggle
Response: { data: { _id, isActive, ... } }
```

---

## Form Fields Details

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| name | string | ✅ | - | Banner display name |
| imageUrl | string | ✅ | - | Desktop image URL |
| mobileImageUrl | string | ❌ | null | Mobile-specific image |
| targetSlug | string | ✅ | - | Article slug to link to |
| type | enum | ✅ | - | sticky_bottom, popup, inline, sidebar, header |
| device | enum | ❌ | 'all' | all, mobile, desktop |
| weight | number | ❌ | 50 | 0-100% for A/B testing |
| priority | number | ❌ | 0 | Display order (higher = first) |
| isActive | boolean | ❌ | true | Enable/disable banner |

---

## Table Column Configuration

```javascript
const columns = [
    {
        title: 'Hình ảnh',
        dataIndex: 'imageUrl',
        width: 100,
        render: (url) => <Image src={url} preview />
    },
    {
        title: 'Tên banner',
        dataIndex: 'name',
        width: 150,
        ellipsis: true
    },
    {
        title: 'Loại',
        dataIndex: 'type',
        width: 120,
        render: (type) => <Badge color={colors[type]} text={typeMap[type]} />
    },
    {
        title: 'Thiết bị',
        dataIndex: 'device',
        width: 100,
        render: (device) => deviceMap[device]
    },
    {
        title: 'Ưu tiên',
        dataIndex: 'priority',
        width: 80,
        sorter: (a, b) => a.priority - b.priority
    },
    {
        title: 'Trọng số',
        dataIndex: 'weight',
        width: 80,
        render: (weight) => `${weight}%`
    },
    {
        title: 'Trạng thái',
        dataIndex: 'isActive',
        width: 100,
        render: (isActive, record) => 
            <Button onClick={() => handleToggleActive(record)}>
                {isActive ? 'Bật' : 'Tắt'}
            </Button>
    },
    {
        title: 'Hành động',
        width: 120,
        render: (_, record) => 
            <Space>
                <Button onClick={() => handleEditBanner(record)} />
                <Popconfirm onConfirm={() => handleDeleteBanner(record._id)}>
                    <Button danger />
                </Popconfirm>
            </Space>
    }
];
```

---

## State Management

```javascript
const [banners, setBanners] = useState([]);           // List of banners
const [loading, setLoading] = useState(false);         // API loading state
const [modalVisible, setModalVisible] = useState(false); // Modal visibility
const [editingId, setEditingId] = useState(null);      // ID of banner being edited
const [form] = Form.useForm();                          // Ant Form instance
const [imagePreview, setImagePreview] = useState(null); // Desktop image preview
const [mobileImagePreview, setMobileImagePreview] = useState(null); // Mobile image preview
```

---

## Hook Usage

```javascript
// Load banners when component mounts
useEffect(() => {
    fetchBanners();
}, []);

// Rebuild menu when user changes (admin-only items)
useMemo(() => {
    // ... build menuItems array
}, [user]);
```

---

## Error Handling

All API calls include try-catch with user-friendly messages:

```javascript
try {
    setLoading(true);
    // API call here
    message.success('Thành công!');
} catch (error) {
    message.error('Lỗi: ' + (error.response?.data?.message || error.message));
} finally {
    setLoading(false);
}
```

---

## Navigation Flow

```
Admin Sidebar
    ↓
Click "Quản lý Banner"
    ↓
navigate('/admin/banners')
    ↓
Route matches: path="banners"
    ↓
BannerManagement component loads
    ↓
fetchBanners() fetches from /api/banners
    ↓
Table displays all banners
```

---

## Styling & Theme

Uses Ant Design v5 with custom theme:

```javascript
// Colors in theme
const themeConfig = {
    token: {
        colorPrimary: '#EE4D2D',      // Shopee red
        colorLink: '#EE4D2D',
        colorLinkHover: '#d94429',
        borderRadius: 8,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...'
    }
};
```

All buttons, inputs, modals inherit this theme automatically.

---

## Dependencies

All required packages already installed:
- ✅ react
- ✅ react-router-dom
- ✅ antd (Ant Design v5)
- ✅ @ant-design/icons
- ✅ axios (via api config)

---

## Quick Debug Commands

```bash
# Check if routes work
curl http://localhost:3000/admin/banners

# Check API endpoint
curl http://localhost:3001/api/banners

# Test banner creation
curl -X POST http://localhost:3001/api/banners \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Banner",
    "imageUrl": "https://...",
    "targetSlug": "test",
    "type": "popup"
  }'
```

---

## File Manifest

```
frontend/src/
├── components/
│   ├── BannerManagement.js          [NEW - 650+ lines]
│   ├── AdminLayout.js               [MODIFIED - added icon import & menu item]
│   ├── App.js                       [MODIFIED - added import & route]
│   └── ... (other components unchanged)
├── config/
│   └── api.js                       [Unchanged - already has correct baseURL]
└── ... (rest of structure unchanged)
```

---

## Verification Steps

```bash
# 1. Verify component file exists
ls -la frontend/src/components/BannerManagement.js

# 2. Check imports in App.js
grep "BannerManagement" frontend/src/App.js

# 3. Check route in App.js
grep 'path="banners"' frontend/src/App.js

# 4. Check menu icon in AdminLayout.js
grep "FileImageOutlined" frontend/src/components/AdminLayout.js

# 5. Check menu item in AdminLayout.js
grep '"banners"' frontend/src/components/AdminLayout.js
```

All files ready for production deployment! 🚀
