"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  FileSignature,
  Users,
  Link2,
  CalendarClock,
  ImageIcon,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/templates", label: "Templates", icon: FileSignature },
  { href: "/users", label: "Users", icon: Users },
  { href: "/assignments", label: "Assignments", icon: Link2 },
  { href: "/schedules", label: "Schedules", icon: CalendarClock },
  { href: "/images", label: "Images", icon: ImageIcon },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden">
          <Menu className="h-4 w-4" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <PenTool className="h-4 w-4" />
            SignatureForge
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-6 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                  active ? "bg-sidebar-accent text-white" : "text-slate-300"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
