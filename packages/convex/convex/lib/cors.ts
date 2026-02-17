/** CORS headers for Convex HTTP endpoints with origin validation. */
export function corsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get("Origin");

  // Allowlist of authorized origins
  const ALLOWED_ORIGINS = [
    "https://islas.vercel.app",  // Production deployment
    "http://localhost:3000",                 // Local Next.js dev
    "http://localhost:5173",                 // Vite dev (if used)
  ];

  // Check if origin is in allowlist
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : null;

  // Log blocked attempts for monitoring
  if (origin && !allowedOrigin) {
    console.warn(`⚠️  Blocked CORS request from unauthorized origin: ${origin}`);
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/** SHA-256 hash a string using the Web Crypto API (available in Convex runtime). */
export async function hashApiKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
