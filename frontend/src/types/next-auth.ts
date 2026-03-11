import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    // Google ID token used to call protected backend APIs.
    googleIdToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    // Persist Google ID token across NextAuth JWT lifecycle.
    googleIdToken?: string;
  }
}
