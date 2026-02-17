import GitHub from "@auth/core/providers/github";
import Resend from "@auth/core/providers/resend";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * ⚠️ WARNING: This auth configuration is NOT ACTIVE ⚠️
 *
 * Islas uses a single-user passphrase authentication system.
 * This file exists ONLY for:
 * 1. Providing authTables schema structure (spread into schema.ts)
 * 2. Maintaining @convex-dev/auth package compatibility
 *
 * The GitHub/Resend providers defined below are NEVER invoked.
 *
 * Actual authentication happens in:
 * - Frontend: apps/web/app/login/page.tsx + middleware.ts
 * - Backend: lib/auth.ts (returns hardcoded "local-user")
 *
 * To modify authentication, edit lib/auth.ts, not this file.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
    providers: [GitHub, Resend as any],
});
