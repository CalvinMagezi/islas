import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

const WORKSPACE_DIR = process.env.WORKSPACE_DIR || "/workspace";
const ACCESS_PASSPHRASE = process.env.NEXT_PUBLIC_ACCESS_PASSPHRASE;

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get("islas-auth");
  if (!cookie) return false;
  if (!ACCESS_PASSPHRASE) return false;
  return cookie.value === ACCESS_PASSPHRASE;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: segments } = await params;

  // Sanitize: reject any segment that attempts directory traversal
  if (segments.some((s) => s === ".." || s.includes("\0"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const relativePath = segments.join("/");
  const absolutePath = path.resolve(WORKSPACE_DIR, relativePath);

  // Confirm the resolved path is still inside WORKSPACE_DIR
  if (!absolutePath.startsWith(path.resolve(WORKSPACE_DIR))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  let data: Buffer;
  try {
    data = await fs.readFile(absolutePath);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const filename = path.basename(absolutePath);

  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(data.length),
    },
  });
}
