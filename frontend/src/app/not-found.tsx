import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-2xl font-semibold text-gray-700 mb-4">
          Page not found
        </p>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          {/* Cách sửa: Bao quanh đoạn text bằng cặp ngoặc nhọn và nháy kép */}
          {"Sorry, we couldn't find the page you're looking for."}
        </p>
        <Link href="/" className="btn-primary">
          Go back home
        </Link>
      </div>
    </div>
  )
}