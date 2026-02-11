# Shoppe Frontend Next.js 14+

A modern, performant Next.js 14+ frontend for Shoppe with support for both Public News Site (SSR) and Admin Dashboard (CSR).

## 🎯 Architecture Overview

```
frontend-next/
├── src/
│   ├── app/                    # App Router pages and layouts
│   │   ├── page.tsx           # Home page (SSR)
│   │   ├── article/[slug]/    # Article detail pages (SSR)
│   │   ├── admin/             # Admin dashboard (CSR) - Under migration
│   │   ├── api/               # API routes (optional)
│   │   ├── layout.tsx         # Root layout
│   │   ├── not-found.tsx      # 404 page
│   │   └── globals.css        # Global styles with Tailwind
│   ├── components/            # Reusable React components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── ArticleCard.tsx
│   │   └── ArticleInteractionClient.tsx
│   ├── hooks/                 # Custom React hooks
│   │   └── useUserInteraction.ts
│   ├── lib/                   # Utility functions
│   │   ├── types.ts           # TypeScript interfaces
│   │   └── utils.ts           # Helper functions
│   └── config/                # Configuration
│       └── api.ts             # API configuration
├── public/                    # Static files
├── middleware.ts              # Next.js middleware
├── next.config.js            # Next.js configuration
├── tailwind.config.ts        # Tailwind configuration
└── tsconfig.json             # TypeScript configuration
```

## 🚀 Features

### Public Pages (SSR)
- **Home Page**: Fetches articles from backend API with caching strategy
- **Article Detail Pages**: Server-side rendered with dynamic metadata for SEO
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **SEO Optimized**: Meta tags, Open Graph, Twitter Cards

### Performance & Security
- **User-Agent Detection**: Middleware identifies bots vs real users
- **Smart Resource Loading**: `useUserInteraction` hook for lazy loading
- **Security Headers**: X-Frame-Options, CSP, and more
- **Image Optimization**: Next.js built-in image optimization
- **Caching Strategies**: Configurable revalidation per route

### Admin Dashboard (Phase 2)
- Structure ready for React SPA migration
- Placeholder components for future implementation
- Protected routes (to be added)

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local

# Configure API endpoint
# NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Development

```bash
npm run dev
# Open http://localhost:3000
```

### Build & Production

```bash
npm run build
npm start
```

## 📦 Key Files

### `middleware.ts`
- Detects user-agent (Bot vs Real User)
- Adds `x-user-type` header for downstream logic
- Applied to all routes except static files

### `src/hooks/useUserInteraction.ts`
- Monitors scroll, click, and keyboard events
- Triggers only for real users (checked via headers)
- Debounced for performance
- Dispatches `userInteraction` custom event
- Use for lazy loading external resources

### `src/app/page.tsx`
- Home page with SSR
- Fetches articles from `GET /api/links/public`
- Grid layout with ArticleCard components
- No cache (`cache: 'no-store'`)

### `src/app/article/[slug]/page.tsx`
- Dynamic article pages
- Checks `isCloaked` status
- Mounts `useUserInteraction` for non-cloaked articles
- Generates SEO metadata dynamically

## 🔌 Backend Integration

### API Endpoints

**Get Public Links**
```
GET /api/links/public?limit=12&offset=0
Response:
{
  "success": true,
  "data": [{
    "_id": "...",
    "title": "...",
    "slug": "...",
    "description": "...",
    "thumbnail": "...",
    "isCloaked": false,
    "createdAt": "..."
  }]
}
```

**Get Article Detail**
```
GET /api/links/{slug}
Response:
{
  "success": true,
  "data": {
    "_id": "...",
    "title": "...",
    "content": "...",
    "isCloaked": false,
    ...
  }
}
```

## 🎨 Styling

- **Framework**: Tailwind CSS 3
- **Colors**: Custom theme with primary and secondary colors
- **Components**: Pre-defined component classes (.btn-primary, .card, etc.)
- **Responsive**: Mobile-first breakpoints (sm, md, lg, xl)

## 📱 Responsive Breakpoints

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

## 🔐 Security

- **CSP Headers**: Content Security Policy
- **X-Frame-Options**: Prevent clickjacking
- **X-XSS-Protection**: XSS protection
- **Referrer-Policy**: Strict origin tracking

## 🚦 Caching Strategy

```typescript
// No cache - Always fresh
cache: 'no-store'

// Revalidate every 5 minutes
next: { revalidate: 300 }

// Revalidate every 24 hours
next: { revalidate: 86400 }
```

## 📊 Metadata & SEO

- **Dynamic Metadata**: Generated based on content
- **Open Graph**: Social media sharing
- **Twitter Cards**: Twitter preview
- **Sitemap**: Automatic via Next.js (requires config)
- **Robots.txt**: Configure indexing rules

## 🔄 Admin Dashboard Migration

The admin dashboard from the React SPA will be migrated in the next phase. Structure is ready:

- `/src/app/admin` - Layout and pages
- RBAC (Role-Based Access Control) to be added
- Authentication middleware to be integrated
- State management (consider Redux/Zustand)

## 📝 Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🐛 Debugging

### Enable Next.js Debug Mode
```bash
DEBUG=* npm run dev
```

### Check Middleware
- Response headers will include `x-user-type: bot|user`
- Monitor browser dev tools → Network tab

### Verify User Interaction Hook
```javascript
// Browser console
window.addEventListener('userInteraction', (e) => {
  console.log('User interacted:', e.detail)
})
```

## 📚 Resources

- [Next.js 14 Docs](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)

## 📄 License

Copyright © 2025 Shoppe. All rights reserved.
