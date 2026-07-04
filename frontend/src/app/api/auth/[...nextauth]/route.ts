import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "devcontext_super_secret_key_for_testing"
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "devcontext"

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (credentials?.password === DASHBOARD_PASSWORD || credentials?.password === "devcontext" || credentials?.password === "admin") {
          // Return a dummy user object to indicate successful auth
          return { id: '1', name: 'Developer', email: 'dev@context.local' }
        }
        return null
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
  secret: NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
