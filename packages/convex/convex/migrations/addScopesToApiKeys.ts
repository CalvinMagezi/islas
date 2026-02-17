/**
 * Migration: Add scopes field to existing API keys
 *
 * This migration adds the `scopes` field to all existing API keys in the database.
 * All existing keys are granted full_access scopes for backwards compatibility.
 *
 * Run this once after deploying the schema change:
 * npx convex run migrations/addScopesToApiKeys:migrate
 */

import { internalMutation } from "../_generated/server";
import { SCOPE_PRESETS } from "../functions/apiKeys";

export const migrate = internalMutation({
  args: {},
  handler: async (ctx) => {
    const keys = await ctx.db.query("apiKeys").collect();

    let updated = 0;
    let skipped = 0;

    for (const key of keys) {
      // Check if key already has scopes
      if ("scopes" in key && Array.isArray(key.scopes) && key.scopes.length > 0) {
        skipped++;
        continue;
      }

      // Add full_access scopes to existing keys
      await ctx.db.patch(key._id, {
        scopes: [...SCOPE_PRESETS.full_access],
      });
      updated++;
    }

    return {
      success: true,
      message: `Migration complete: Updated ${updated} keys, skipped ${skipped} keys that already had scopes`,
      updated,
      skipped,
      total: keys.length,
    };
  },
});
