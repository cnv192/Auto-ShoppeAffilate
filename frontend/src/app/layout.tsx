import type { Metadata, Viewport } from 'next'
import './globals.css'
import AntdProvider from '@/components/AntdProvider'
import SWRProvider from '@/components/SWRProvider'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://www.tintuc24h.site')
  ),
  title: {
    default: 'Tin tức 24h - Đọc báo tin tức mới nhất trong ngày',
    template: '%s | Tin tức 24h',
  },
  description: 'Tin tức 24h - Cập nhật tin tức mới nhất 24h qua, đọc báo online với tin nóng, tin nhanh về thời sự, thế giới, kinh tế, đời sống, giải trí, thể thao, công nghệ.',
  keywords: ['tin tức', 'tin tức 24h', 'đọc báo', 'tin mới', 'tin nóng', 'thời sự', 'báo điện tử'],
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://tintuc24h.vercel.app',
    siteName: 'Tin tức 24h',
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  },
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#D31016" />
      </head>
      <body className="bg-white text-gray-900">
        <SWRProvider>
          <AntdProvider>
            {children}
          </AntdProvider>
        </SWRProvider>
      </body>
    </html>
  )
}
