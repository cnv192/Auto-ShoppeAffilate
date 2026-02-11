# Quick Reference Guide

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
echo 'NEXT_PUBLIC_API_URL=http://localhost:3001' > .env.local

# 3. Start development server
npm run dev

# 4. Visit application
open http://localhost:3000
```

---

## 📁 File Structure Quick Lookup

### Pages
- **Home:** `src/app/page.tsx` - Lists all articles
- **Article:** `src/app/article/[slug]/page.tsx` - Single article detail
- **Admin:** `src/app/admin/page.tsx` - Dashboard placeholder
- **404:** `src/app/not-found.tsx` - Not found page

### Components
- **Header:** `src/components/Header.tsx` - Navigation
- **Footer:** `src/components/Footer.tsx` - Footer layout
- **ArticleCard:** `src/components/ArticleCard.tsx` - Grid card
- **ArticleInteractionClient:** `src/components/ArticleInteractionClient.tsx` - Client interaction

### Hooks
- **useUserInteraction:** `src/hooks/useUserInteraction.ts` - User interaction detection

### Utilities
- **API Config:** `src/config/api.ts` - API endpoints
- **Types:** `src/lib/types.ts` - TypeScript interfaces
- **Utils:** `src/lib/utils.ts` - Helper functions

### Configuration
- **Next.js:** `next.config.js`
- **Tailwind:** `tailwind.config.ts`
- **TypeScript:** `tsconfig.json`
- **Middleware:** `middleware.ts`

---

## 🔧 Common Tasks

### Add a New Page
```bash
# Create new directory
mkdir -p src/app/features

# Create page.tsx
touch src/app/features/page.tsx
```

```tsx
// src/app/features/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Features',
}

export default function FeaturesPage() {
  return <div>Features content</div>
}
```

### Add a New Component
```bash
# Create component file
touch src/components/MyComponent.tsx
```

```tsx
// src/components/MyComponent.tsx
interface Props {
  title: string
}

export function MyComponent({ title }: Props) {
  return <div>{title}</div>
}
```

### Create a Custom Hook
```bash
# Create hook file
touch src/hooks/useMyHook.ts
```

```typescript
// src/hooks/useMyHook.ts
'use client'

import { useState } from 'react'

export function useMyHook() {
  const [state, setState] = useState(null)
  return { state, setState }
}
```

### Fetch Data from Backend
```typescript
// In server component
import { fetchFromApi } from '@/lib/utils'

const data = await fetchFromApi('/api/endpoint', {
  cache: 'no-store'
})
```

### Add Styling
- **Global:** Edit `src/app/globals.css`
- **Component:** Use Tailwind classes
- **Theme:** Update `tailwind.config.ts`

```tsx
// Using Tailwind classes
<div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
  <h2 className="text-lg font-semibold">Title</h2>
</div>
```

---

## 🎯 Key Concepts

### Server vs Client Components
```tsx
// Server Component (default) - SSR
export default function ServerComponent() {
  // Can fetch data directly
  // Has access to server resources
  // Not sent to browser
  return <div>Server rendered</div>
}

// Client Component - CSR
'use client'

import { useState } from 'react'

export function ClientComponent() {
  const [count, setCount] = useState(0)
  return <div>Client rendered: {count}</div>
}
```

### Middleware for Bot Detection
```typescript
// middleware.ts automatically:
// 1. Detects if request is from bot
// 2. Adds x-user-type header
// 3. Available in all routes

// Access in components:
const response = fetch(url, options)
const userType = response.headers.get('x-user-type') // 'bot' | 'user'
```

### User Interaction Hook
```typescript
'use client'

import { useUserInteraction } from '@/hooks/useUserInteraction'

export function MyComponent() {
  useUserInteraction({
    scrollThreshold: 200,
    debounceDelay: 300,
    onInteraction: () => {
      console.log('User interacted!')
      // Load external resources
    }
  })

  return <div>Content</div>
}
```

---

## 🌐 Environment Variables

### Development
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Production
```bash
# .env.production.local
NEXT_PUBLIC_API_URL=https://api.shoppe.com
```

---

## 📊 API Endpoints

### Public Links (Home Page)
```
GET /api/links/public?limit=12&offset=0
```

### Article Detail
```
GET /api/links/{slug}
```

---

## 🎨 Tailwind Classes Quick Ref

### Common Classes
```tsx
// Layout
<div className="flex items-center justify-between">

// Spacing
<div className="p-4 m-2 mt-8">

// Typography
<h1 className="text-4xl font-bold">

// Colors
<div className="bg-primary-600 text-white">

// Borders & Shadows
<div className="border border-gray-200 rounded-lg shadow-md">

// Responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

---

## 🔍 Debugging

### Check Bot Detection
```javascript
// Browser DevTools Console
fetch('/').then(r => console.log(r.headers.get('x-user-type')))
```

### Monitor User Interaction
```javascript
// Browser DevTools Console
window.addEventListener('userInteraction', (e) => {
  console.log('User interacted:', e.detail)
})
```

### View Page Metadata
```bash
# View page source (Ctrl+U or Cmd+U)
# Look for <meta> tags in <head>
```

---

## 📦 Dependencies

### Core
- `next@^14.0.0` - Framework
- `react@^18.2.0` - UI library
- `typescript@^5.3.0` - Type safety

### Styling
- `tailwindcss@^3.3.0` - Utility CSS
- `autoprefixer@^10.4.14` - CSS vendor prefixes
- `postcss@^8.4.31` - CSS processing

### Dev
- `@types/react` - React type definitions
- `@types/node` - Node.js type definitions
- `eslint` - Code linting

---

## 🚢 Deployment

### Vercel (Recommended)
```bash
# Connect GitHub repo to Vercel
# Set environment variables
# Deploy automatically on push
```

### Docker
```bash
npm run build
docker build -t shoppe-frontend .
docker run -p 3000:3000 shoppe-frontend
```

### Manual
```bash
npm run build
npm start
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -i :3000
kill -9 <PID>

# Or use different port
npm run dev -- -p 3001
```

### Module Not Found
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Restart dev server
npm run dev
```

### Build Fails
```bash
# Check for TypeScript errors
npm run type-check

# Check for linting errors
npm run lint

# Clear cache and rebuild
rm -rf .next && npm run build
```

---

## 📚 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Docs](https://react.dev)
- [TypeScript](https://www.typescriptlang.org/docs)

---

## 🎯 Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm start               # Start production server
npm run lint            # Run ESLint
npm run type-check      # Check TypeScript

# Utilities
npm install            # Install dependencies
npm list              # List installed packages
npm outdated          # Check for updates
```

---

**Happy Coding! 🚀**
