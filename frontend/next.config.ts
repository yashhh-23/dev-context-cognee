import type { NextConfig } from 'next'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'


const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Proxy all /api/* requests EXCEPT /api/auth/* to FastAPI backend
      {
        source: '/api/:path((?!auth(?:/|$)).*)',
        destination: `${API_BASE}/api/:path`,
      },

    ]
  },
}

export default nextConfig
