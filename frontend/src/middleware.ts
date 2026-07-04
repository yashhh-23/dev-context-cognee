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
     * 1. / (landing page)
     * 2. /auth/signin
     * 3. /api/auth (NextAuth API routes)
     * 4. /_next (Next.js internals)
     * 5. Static files (images, fonts, favicon, docs)
     */
    '/((?!$|auth/signin|api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)',
  ],
}
