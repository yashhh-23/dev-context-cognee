import type { NextConfig } from 'next'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      fallback: [
        // Proxy all /api/* requests that don't match a local Next.js API route (like /api/auth/*) to FastAPI backend
        {
          source: '/api/:path*',
          destination: `${API_BASE}/api/:path*`,
        },
      ],
    }
  },
}

export default nextConfig
