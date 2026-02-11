import Link from 'next/link'

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

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-white mt-8">
      {/* Main footer */}
      <div className="container-news py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold text-primary-500 mb-4">Báo mới</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Báo mới - Cập nhật tin tức 24/7 với các chuyên mục đa dạng: Thời sự, Thế giới, Kinh tế,
              Giải trí, Thể thao, Công nghệ và nhiều hơn nữa. Mang đến cho bạn đọc những tin tức
              nhanh nhất, chính xác nhất.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Facebook">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="YouTube">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Twitter">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-sm font-semibold mb-4 uppercase tracking-wide text-gray-300">Chuyên mục</h4>
            <ul className="space-y-2">
              {categories.slice(0, 5).map((cat) => (
                <li key={cat.name}>
                  <Link href={cat.href} className="text-gray-400 hover:text-white text-sm transition-colors">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold mb-4 uppercase tracking-wide text-gray-300">Liên kết</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Giới thiệu</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Liên hệ</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Quảng cáo</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Điều khoản sử dụng</a></li>
              <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Chính sách bảo mật</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="container-news py-4 flex flex-col md:flex-row items-center justify-between text-sm text-gray-400">
          <p>&copy; {currentYear} Báo mới. Bảo lưu mọi quyền.</p>
          <p className="mt-2 md:mt-0">
            Giấy phép hoạt động báo chí số XXX/GP-BTTTT
          </p>
        </div>
      </div>
    </footer>
  )
}
