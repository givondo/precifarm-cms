import { NextResponse } from "next/server";
import { getRoutes } from "@/lib/services";
export async function GET() {
  return NextResponse.json({ data: getRoutes() });
}
