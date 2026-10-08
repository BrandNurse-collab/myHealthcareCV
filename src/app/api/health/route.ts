import { NextResponse } from "next/server";

// Minimal liveness check for uptime monitoring / deployment smoke tests.
export async function GET() {
  return NextResponse.json({ status: "ok", service: "healthcv-ai", timestamp: new Date().toISOString() });
}
