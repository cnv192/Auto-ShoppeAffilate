import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-2xl font-semibold text-gray-700 mb-4">
          Không tìm thấy trang
        </p>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          {"Xin lỗi, chúng tôi không tìm thấy trang bạn đang tìm kiếm."}
        </p>
        <Link href="/" className="btn-primary">
          Về trang chủ
        </Link>
      </div>
    </div>
  )
}