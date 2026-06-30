import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/auth/signin',
  },
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * 1. /auth/signin
     * 2. /api/auth (NextAuth API routes)
     * 3. /_next (Next.js internals)
     * 4. /favicon.ico, /images, etc. (static files)
     */
    '/((?!auth/signin|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
