export type SignaturePushStatus = "pending" | "success" | "failed";

export type AssignmentTargetType = "user" | "department" | "group";

export type ScheduleStatus = "scheduled" | "active" | "completed" | "cancelled";

export type AzureTenantConfig = {
  azureTenantId: string;
  azureClientId: string;
  azureClientSecret: string;
};

export type InjectResult = {
  success: boolean;
  method: "outlook-rest-v2" | "graph-mailboxsettings" | "ews-soap" | "none";
  error?: string;
};

export type UserSyncResult = {
  added: number;
  updated: number;
  unchanged: number;
  errors: string[];
};

export type DeployBatchResult = {
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
};

export type CronTickResult = {
  ok: boolean;
  timestamp: string;
  activated?: unknown;
  deactivated?: unknown;
  deployed?: unknown;
  synced?: unknown;
  activateError?: string;
  deactivateError?: string;
  deployError?: string;
  syncError?: string;
};

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/templates", label: "Templates", icon: "FileSignature" },
  { href: "/users", label: "Users", icon: "Users" },
  { href: "/assignments", label: "Assignments", icon: "Link2" },
  { href: "/schedules", label: "Schedules", icon: "CalendarClock" },
  { href: "/images", label: "Images", icon: "ImageIcon" },
  { href: "/audit", label: "Audit log", icon: "ScrollText" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;
