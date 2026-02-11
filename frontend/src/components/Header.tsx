'use client'

import Link from 'next/link'
import { useState } from 'react'

interface HeaderProps {
  title?: string
  subtitle?: string
}

const categories = [
  { name: 'Thời sự', href: '/?category=thoi-su' },
  { name: 'Thế giới', href: '/?category=the-gioi' },
  { name: 'Kinh tế', href: '/?category=kinh-te' },
  { name: 'Đời sống', href: '/?category=doi-song' },
  { name: 'Giải trí', href: '/?category=giai-tri' },
  { name: 'Thể thao', href: '/?category=the-thao' },
  { name: 'Công nghệ', href: '/?category=cong-nghe' },
  { name: 'Sức khỏe', href: '/?category=suc-khoe' },
]

function getCurrentDateVN() {
  const date = new Date()
  const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
  const day = days[date.getDay()]
  const dateNum = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  return `${day}, ${dateNum}/${month}/${year}`
}

export function Header({ title = 'Tin tức 24h' }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="news-header">
      {/* Top bar */}
      <div className="bg-gray-100 border-b border-gray-200">
        <div className="container-news py-2 flex items-center justify-between">
          <span className="text-xs text-gray-600">{getCurrentDateVN()}</span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-600">Tin tức 24h</span>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="bg-white py-4">
        <div className="container-news">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <h1 className="text-3xl md:text-4xl font-extrabold text-primary-500 tracking-tight">
                {title}
              </h1>
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-primary-500"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Search - desktop */}
            <div className="hidden md:flex items-center">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  className="px-4 py-2 pr-10 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-64"
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="bg-primary-500">
        <div className="container-news">
          {/* Desktop navigation */}
          <div className="hidden md:flex items-center justify-center">
            <Link href="/" className="text-white font-medium text-sm px-4 py-3 hover:bg-primary-600 transition-colors">
              Trang chủ
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.name}
                href={cat.href}
                className="text-white font-medium text-sm px-4 py-3 hover:bg-primary-600 transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </div>

          {/* Mobile navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-2">
              <Link
                href="/"
                className="block text-white font-medium text-sm px-4 py-2 hover:bg-primary-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                Trang chủ
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.name}
                  href={cat.href}
                  className="block text-white font-medium text-sm px-4 py-2 hover:bg-primary-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}
