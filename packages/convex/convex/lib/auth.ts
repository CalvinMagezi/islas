import { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Single-user authentication: Always returns a static local user ID.
 * Frontend validates passphrase, backend uses this hardcoded user ID.
 */
export async function getAuthUserId(
  _ctx: QueryCtx | MutationCtx,
): Promise<string> {
  return "local-user";
}

export async function getOptionalAuthUserId(
  _ctx: QueryCtx | MutationCtx,
): Promise<string | null> {
  return "local-user";
}
