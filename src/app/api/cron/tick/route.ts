import { NextRequest, NextResponse } from "next/server";
import { runCronTick } from "@/lib/jobs/tick";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runCronTick();
  return NextResponse.json(results);
}
