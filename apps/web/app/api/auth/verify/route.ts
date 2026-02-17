import { NextRequest, NextResponse } from "next/server";

const ACCESS_PASSPHRASE = process.env.NEXT_PUBLIC_ACCESS_PASSPHRASE;

export async function POST(request: NextRequest) {
  try {
    const { passphrase } = await request.json();

    if (!ACCESS_PASSPHRASE) {
      return NextResponse.json(
        { success: false, error: "Authentication not configured" },
        { status: 500 }
      );
    }

    if (passphrase === ACCESS_PASSPHRASE) {
      const response = NextResponse.json({ success: true });

      // Set secure cookie (30 days)
      response.cookies.set("islas-auth", passphrase, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });

      return response;
    }

    return NextResponse.json(
      { success: false, error: "Invalid passphrase" },
      { status: 401 }
    );
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: "Authentication failed" },
      { status: 500 }
    );
  }
}
