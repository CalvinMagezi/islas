import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACCESS_PASSPHRASE = process.env.NEXT_PUBLIC_ACCESS_PASSPHRASE;

export function middleware(request: NextRequest) {
  // Skip auth check if passphrase not configured (development mode)
  if (!ACCESS_PASSPHRASE) {
    return NextResponse.next();
  }

  // Skip auth for login page, auth API, and MCP gateway (uses Bearer token auth)
  if (
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/api/auth") ||
    request.nextUrl.pathname.startsWith("/api/mcp")
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get("islas-auth");

  if (!authCookie || authCookie.value !== ACCESS_PASSPHRASE) {
    // Redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
