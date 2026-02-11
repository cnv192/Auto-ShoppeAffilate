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
      : 'https://your-domain.com')
  ),
  title: {
    default: 'Shoppe - News & Resources',
    template: '%s | Shoppe',
  },
  description: 'Your trusted source for curated news and resources.',
  keywords: ['news', 'resources', 'shoppe'],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://shoppe.local',
    siteName: 'Shoppe',
  },
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
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
        <meta name="theme-color" content="#EE4D2D" />
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
