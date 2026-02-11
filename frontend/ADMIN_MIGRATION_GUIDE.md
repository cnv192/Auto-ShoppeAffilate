# Admin Dashboard Migration Guide

## ✅ Completed: Phase 1 Admin Migration

This guide documents the migration of the admin dashboard from the legacy React SPA to Next.js 14+.

---

## 📁 File Structure

### Created Files:

```
frontend-next/
├── src/
│   ├── lib/
│   │   ├── authService.ts       # 🔐 Authentication service
│   │   ├── apiClient.ts         # 🔌 API client wrapper
│   │
│   ├── components/
│   │   ├── AdminSidebar.tsx     # 📌 Sidebar navigation
│   │   └── AdminTopbar.tsx      # ⬆️ Top navbar
│   │
│   └── app/
│       └── admin/
│           ├── layout.tsx        # 🛡️ Admin layout with auth guard
│           ├── page.tsx          # 📊 Dashboard home
│           ├── login/
│           │   └── page.tsx      # 🔑 Login page
│           ├── campaigns/
│           │   └── page.tsx      # ⚡ Campaign list
│           └── links/
│               └── page.tsx      # 🔗 Link management
```

---

## 🔄 Key Changes from React to Next.js

### 1. **Client-Side Declaration**
All admin pages marked with `'use client'`:
```typescript
'use client'
```

### 2. **Router Navigation**
| React Router | Next.js | Example |
|---|---|---|
| `useNavigate()` | `useRouter()` from `next/navigation` | `router.push('/admin/login')` |
| `<Link>` | `<Link>` from `next/link` | `<Link href="/admin">` |
| `useLocation()` | `usePathname()` from `next/navigation` | `pathname === '/admin'` |

### 3. **API Calls**
All API calls use the centralized `apiClient`:
```typescript
import { apiClient } from '@/lib/apiClient'

// GET request
const data = await apiClient.get('/campaigns')

// POST request
await apiClient.post('/campaigns', campaignData)

// DELETE request
await apiClient.delete(`/campaigns/${id}`)
```

### 4. **Authentication**
```typescript
import { authService } from '@/lib/authService'

// Check if authenticated
if (!authService.isAuthenticated()) {
  router.push('/admin/login')
}

// Get current user
const user = authService.getCurrentUser()

// Login
await authService.login(username, password)

// Logout
authService.logout()
```

---

## 📋 Migration Checklist

### Phase 1: Core Structure ✅
- ✅ Auth service created
- ✅ API client wrapper created
- ✅ Admin layout with sidebar
- ✅ Login page
- ✅ Dashboard (stats overview)
- ✅ Campaigns page (list with CRUD actions)
- ✅ Links page (list with CRUD actions)

### Phase 2: Additional Pages (TODO)
- [ ] Banner Management (`app/admin/banners/page.tsx`)
- [ ] Facebook Account Manager (`app/admin/facebook/page.tsx`)
- [ ] Resource Management (`app/admin/resources/page.tsx`)
- [ ] User Management (`app/admin/users/page.tsx`) - Admin only
- [ ] User Profile (`app/admin/profile/page.tsx`)

### Phase 3: Components (TODO)
- [ ] Campaign Form (Create/Edit modal)
- [ ] Link Form (Create/Edit modal)
- [ ] Upload component
- [ ] Image preview component
- [ ] Statistics cards with charts

### Phase 4: Advanced Features (TODO)
- [ ] Pagination for lists
- [ ] Search/filter functionality
- [ ] Bulk actions
- [ ] Export data (CSV)
- [ ] Import functionality
- [ ] Real-time updates via WebSocket

---

## 🔧 How to Use

### Running the Admin Dashboard

1. **Start the app:**
   ```bash
   npm run dev
   ```

2. **Navigate to admin:**
   ```
   http://localhost:3000/admin/login
   ```

3. **Login with credentials:**
   - Use your backend credentials
   - Token is saved to localStorage

4. **Access features:**
   - Dashboard: `http://localhost:3000/admin`
   - Campaigns: `http://localhost:3000/admin/campaigns`
   - Links: `http://localhost:3000/admin/links`

---

## 📝 Adding a New Admin Page

### Step 1: Create the page component

```typescript
// app/admin/myfeature/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { apiClient } from '@/lib/apiClient'

interface MyData {
  _id: string
  name: string
  // ... other fields
}

export default function MyFeaturePage() {
  const [data, setData] = useState<MyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await apiClient.get<{ success: boolean; data: MyData[] }>('/myfeature')
        setData(Array.isArray(response.data) ? response.data : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My Feature</h1>
      {/* Your content here */}
    </div>
  )
}
```

### Step 2: Add navigation link

Edit `src/components/AdminSidebar.tsx`:
```typescript
const menuItems = [
  // ... existing items
  { name: 'My Feature', href: '/admin/myfeature', icon: '⭐' },
]
```

---

## 🎨 Styling with Tailwind CSS

All components use Tailwind CSS classes. Key classes used:

```typescript
// Layout
className="flex items-center justify-between"

// Spacing
className="p-6 mb-8 mt-4"

// Colors
className="bg-primary-600 text-white"
className="bg-green-50 text-green-800"

// Components
className="rounded-lg shadow border border-gray-200"
className="px-4 py-2 hover:bg-gray-100 transition-colors"

// Responsive
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
```

---

## 🔗 API Integration

### Environment Setup

Create `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Example API Calls

```typescript
// Fetch campaigns
const { data: campaigns } = await apiClient.get('/campaigns')

// Create campaign
const { data: newCampaign } = await apiClient.post('/campaigns', {
  name: 'My Campaign',
  budget: 1000,
})

// Update campaign
await apiClient.put(`/campaigns/${id}`, {
  name: 'Updated Campaign',
})

// Delete campaign
await apiClient.delete(`/campaigns/${id}`)
```

---

## 🐛 Debugging

### Check Authentication
```typescript
// In browser console
import { authService } from '@/lib/authService'
authService.getToken()      // Should return token
authService.getCurrentUser() // Should return user object
```

### Monitor API Calls
```typescript
// All API calls will show in Network tab with Authorization header
```

### Check Redirect Logic
- Visiting `/admin` without token → redirects to `/admin/login`
- Login successful → redirects to `/admin`

---

## 📚 Next Steps

1. **Complete Phase 2 pages** - Implement remaining admin sections
2. **Add forms** - Create/Edit modal dialogs
3. **Pagination** - Add pagination to list pages
4. **Search/Filter** - Add search and filtering
5. **Charts** - Add data visualization for dashboard
6. **Error Handling** - Enhanced error boundaries
7. **Loading States** - Skeleton screens
8. **Testing** - Unit and integration tests

---

## ⚠️ Important Notes

1. **Token Management:**
   - Tokens are stored in localStorage
   - Consider using httpOnly cookies in production

2. **CORS:**
   - Ensure backend allows requests from localhost:3000

3. **Authentication:**
   - Auth check happens on client side in layout
   - Add server-side middleware for additional security

4. **Performance:**
   - Use `useCallback` for API functions to prevent unnecessary fetches
   - Consider adding data pagination to large lists

---

## 🎉 Migration Status

**Overall Progress: 40%**

- ✅ Core authentication system
- ✅ API client wrapper
- ✅ Main navigation/layout
- ✅ Login page
- ✅ Dashboard
- ✅ Campaigns management
- ✅ Links management
- ⏳ Forms and modals
- ⏳ Additional pages
- ⏳ Advanced features
- ⏳ Testing

---

## 📞 Support

For migration questions:
1. Check existing component implementations
2. Review TypeScript types in `src/lib/types.ts`
3. Refer to legacy React components in `frontend/src/components/`

---

**Last Updated:** January 17, 2026  
**Status:** ✅ Phase 1 Complete
