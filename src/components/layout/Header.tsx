"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav } from "./MobileNav";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { data } = useSession();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        <MobileNav />
        <div>
          <h1 className="text-base font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium">{data?.user?.name ?? "Admin"}</p>
          <p className="text-xs text-muted-foreground">{data?.user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
