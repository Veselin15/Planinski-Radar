"use client";

import { SessionProvider } from "next-auth/react";

type AuthProviderProps = {
  children: React.ReactNode;
};

export default function AuthProvider({ children }: AuthProviderProps) {
  // Provide NextAuth session state to the entire client component tree.
  return <SessionProvider>{children}</SessionProvider>;
}
