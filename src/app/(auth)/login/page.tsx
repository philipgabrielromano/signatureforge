"use client";

import { signIn } from "next-auth/react";
import { PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const demo = process.env.NEXT_PUBLIC_DEMO_HINT !== "false";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500">
            <PenTool className="h-5 w-5" />
          </div>
          <p className="text-lg font-semibold">SignatureForge</p>
        </div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <div className="mt-6 space-y-3">
          <Button className="w-full" onClick={() => signIn("azure-ad", { callbackUrl: "/dashboard" })}>
            Sign in with Microsoft
          </Button>
          {demo ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => signIn("demo", { callbackUrl: "/dashboard" })}
            >
              Continue in demo mode
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
