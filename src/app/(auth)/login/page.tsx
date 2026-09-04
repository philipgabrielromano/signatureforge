"use client";

import { signIn } from "next-auth/react";
import { PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const demo = process.env.NEXT_PUBLIC_DEMO_HINT !== "false";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500">
              <PenTool className="h-5 w-5" />
            </div>
            <p className="text-lg font-semibold">SignatureForge</p>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Push Microsoft 365 signatures into every mailbox. No transport rules.
          </h1>
          <p className="max-w-xl text-slate-300">
            Marketing updates a template. SignatureForge writes roaming HTML into each user&apos;s Exchange mailbox
            through Microsoft Graph and EWS. Outlook on Windows, Mac, iOS, Android, and the web picks it up without
            mail-flow infrastructure.
          </p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>Direct mailbox injection — Graph REST, mailboxSettings, then EWS SOAP fallback</li>
            <li>Azure Blob Storage for logos so images survive Render&apos;s ephemeral disk</li>
            <li>Render Cron Job every 5 minutes for schedule activation and pending deploys</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <h2 className="text-xl font-semibold">Admin sign-in</h2>
          <p className="mt-2 text-sm text-slate-400">
            SignatureForge is an admin console. End users never log in — their Outlook clients receive signatures from
            Exchange itself.
          </p>
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
          <p className="mt-6 text-xs text-slate-500">
            Microsoft sign-in requires AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, and AZURE_AD_TENANT_ID. Demo mode is
            for local development when those values are not set.
          </p>
        </div>
      </div>
    </main>
  );
}
