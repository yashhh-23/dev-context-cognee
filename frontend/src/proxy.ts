import { NextFetchEvent, NextRequest } from 'next/server'
import { withAuth } from 'next-auth/middleware'

const authMiddleware = withAuth({
  pages: {
    signIn: '/auth/signin',
  },
})

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  return authMiddleware(req as any, event)
}

export const config = {
  matcher: [
    '/overview/:path*',
    '/bugs/:path*',
    '/contribute/:path*',
    '/graph/:path*',
    '/ingest/:path*',
    '/recall/:path*',
  ],
}
