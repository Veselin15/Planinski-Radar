import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Configure NextAuth with Google OAuth for user sign-in.
const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  // Keep authentication pages inside the app for a guided UX.
  pages: {
    signIn: "/auth",
  },
  // Use server-side secret from env for signed session tokens.
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account }) {
      // Persist Google ID token in JWT so frontend can call protected Django APIs.
      if (account?.id_token) {
        token.googleIdToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose Google ID token on session object for authenticated API writes.
      session.googleIdToken = token.googleIdToken;
      return session;
    },
  },
});

// Export both handlers for Next.js App Router auth endpoints.
export { handler as GET, handler as POST };
