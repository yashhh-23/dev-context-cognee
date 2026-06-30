import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = 'dev-context-cognee-super-secret-key-12345'
}

if (!process.env.DASHBOARD_PASSWORD) {
  process.env.DASHBOARD_PASSWORD = 'devcontext'
}

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const expectedPassword = process.env.DASHBOARD_PASSWORD!
        if (credentials?.password === expectedPassword) {
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
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
