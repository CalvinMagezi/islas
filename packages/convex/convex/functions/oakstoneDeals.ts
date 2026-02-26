import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

const verticalValidator = v.union(
  v.literal("Credit"),
  v.literal("Venture"),
  v.literal("Absolute Return"),
  v.literal("Real Assets"),
  v.literal("Digital Assets"),
  v.literal("Listed Assets"),
);

const statusValidator = v.union(
  v.literal("screening"),
  v.literal("due_diligence"),
  v.literal("ic_review"),
  v.literal("approved"),
  v.literal("passed"),
  v.literal("closed"),
);

export const upsertDeal = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    vertical: verticalValidator,
    status: statusValidator,
    companyName: v.string(),
    sector: v.optional(v.string()),
    geography: v.optional(v.string()),
    dealSize: v.optional(v.string()),
    summary: v.optional(v.string()),
    riskNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for existing deal by company name + vertical to update rather than duplicate
    const all = await ctx.db
      .query("oakstoneDeals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const existing = all.find(
      (d) => d.companyName.toLowerCase() === args.companyName.toLowerCase() && d.vertical === args.vertical
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        status: args.status,
        sector: args.sector,
        geography: args.geography,
        dealSize: args.dealSize,
        summary: args.summary,
        riskNotes: args.riskNotes,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("oakstoneDeals", {
      ...args,
      relatedDocIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const listDeals = internalQuery({
  args: {
    userId: v.string(),
    vertical: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const deals = await ctx.db
      .query("oakstoneDeals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return deals
      .filter((d) => !args.vertical || d.vertical === args.vertical)
      .filter((d) => !args.status || d.status === args.status);
  },
});
