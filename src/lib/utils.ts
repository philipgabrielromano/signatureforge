import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function isAbsoluteHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function findUnsafeImageUrls(html: string): string[] {
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  const unsafe: string[] = [];
  for (const match of matches) {
    const src = match[1];
    if (
      !src.startsWith("https://") ||
      src.includes("localhost") ||
      src.includes("127.0.0.1") ||
      src.startsWith("/") ||
      src.startsWith("data:")
    ) {
      unsafe.push(src);
    }
  }
  return unsafe;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
