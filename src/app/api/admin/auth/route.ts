import { NextRequest } from "next/server";
import crypto from "crypto";
import { registerAdminToken } from "@/middleware";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  if (password === adminPassword) {
    const token = crypto.randomBytes(32).toString("hex");
    registerAdminToken(token);
    return Response.json({ ok: true, message: "ورود موفقیت‌آمیز بود.", token });
  }
  return Response.json({ ok: false, message: "رمز عبور اشتباه است." }, { status: 401 });
}
