import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";

const validTokens = new Set<string>();

export function verifyAdminToken(token: string): boolean {
  return validTokens.has(token);
}

export function registerAdminToken(token: string): void {
  validTokens.add(token);
  if (validTokens.size > 100) {
    const first = validTokens.values().next().value;
    if (first) validTokens.delete(first);
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/admin")) {
    if (pathname === "/api/admin/auth") return NextResponse.next();

    const authHeader = request.headers.get("authorization");
    const cookieToken = request.cookies.get("admin_token")?.value;
    const token = authHeader?.replace("Bearer ", "") || cookieToken;

    if (!token || !verifyAdminToken(token)) {
      return NextResponse.json(
        { ok: false, message: "غیرمجاز." },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/admin/:path*"],
};
