import { ImageResponse } from 'next/og'

// Cấu hình Metadata cho ảnh
export const alt = 'Tin tức 24h'
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'
export const runtime = 'nodejs'

// Next.js sẽ tự dùng hàm default này để làm hàm GET
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          textAlign: 'center',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1f2937',
        }}
      >
        Tin tức 24h
      </div>
    ),
    {
      ...size,
    },
  )
}