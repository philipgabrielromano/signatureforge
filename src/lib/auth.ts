import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

const demoMode =
  process.env.AUTH_DEMO_MODE === "true" || !process.env.AZURE_AD_CLIENT_ID;

const providers = [];

if (process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET) {
  const tenantId = process.env.AZURE_AD_TENANT_ID || "common";
  providers.push(
    MicrosoftEntraID({
      id: "azure-ad",
      name: "Microsoft",
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      authorization: {
        params: { scope: "openid profile email User.Read" },
      },
    })
  );
}

if (demoMode) {
  providers.push(
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: {},
      async authorize() {
        return {
          id: "demo-admin",
          name: "Demo Admin",
          email: "admin@signatureforge.local",
        };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
});

export function isDemoMode(): boolean {
  return demoMode;
}

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user?.email) {
    throw new AuthRequiredError();
  }
  return session;
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AuthRequiredError";
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function actorEmail(): Promise<string> {
  const session = await auth();
  return session?.user?.email ?? "system";
}
