import type { NextConfig } from 'next'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Capture everything after /api/ into the 'path' parameter,
        // EXCEPT if it starts with 'auth/' or is exactly 'auth'.
        source: '/api/:path((?!auth/?).*)',
        destination: `${API_BASE}/api/:path`,
      },
    ]
  },
}

export default nextConfig
