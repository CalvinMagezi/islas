import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const seedOakstone = internalMutation({
    args: { userId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        // Default system user ID if not provided
        const userId = args.userId || "system_oakstone";

        // 1. Seed Deals
        const deals = [
            {
                userId,
                name: "Project Phoenix",
                vertical: "Venture" as const,
                status: "screening" as const,
                companyName: "Phoenix Tech",
                sector: "SaaS",
                geography: "North America",
                dealSize: "$15M",
                summary: "B2B SaaS platform for AI-driven logistics.",
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            {
                userId,
                name: "EcoData Infrastructure",
                vertical: "Real Assets" as const,
                status: "due_diligence" as const,
                companyName: "EcoData",
                sector: "Datacenters",
                geography: "Europe",
                dealSize: "$120M",
                summary: "Sustainable datacenter infrastructure project.",
                createdAt: Date.now() - 100000,
                updatedAt: Date.now(),
            },
            {
                userId,
                name: "Vanguard Credit Facility",
                vertical: "Credit" as const,
                status: "ic_review" as const,
                companyName: "Vanguard Logistics",
                sector: "Logistics",
                geography: "Global",
                dealSize: "$50M",
                summary: "Senior secured lending facility.",
                createdAt: Date.now() - 500000,
                updatedAt: Date.now(),
            }
        ];

        for (const deal of deals) {
            await ctx.db.insert("oakstoneDeals", deal);
        }

        // 2. Seed Documents
        const docs = [
            {
                userId,
                title: "Project Phoenix Pitch Deck",
                content: "Phoenix Tech is revolutionizing logistics using AI. We are raising $15M for our Series A to expand our engineering team and enter the European market.",
                docType: "pitch_deck" as const,
                vertical: "Venture" as const,
                companyName: "Phoenix Tech",
                tags: ["AI", "Logistics", "Series A"],
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            {
                userId,
                title: "EcoData Q3 Market Brief",
                content: "The European datacenter market is seeing unprecedented demand driven by AI workloads. Power availability remains the key constraint. EcoData's renewable focus provides a unique advantage.",
                docType: "market_brief" as const,
                vertical: "Real Assets" as const,
                companyName: "EcoData",
                tags: ["Datacenters", "Europe", "Renewable Energy"],
                createdAt: Date.now() - 200000,
                updatedAt: Date.now(),
            },
            {
                userId,
                title: "Vanguard Term Sheet",
                content: "Term sheet for $50M senior secured credit facility. Interest rate: SOFR + 650 bps. Maturity: 4 years. Security: 1st lien on all assets.",
                docType: "contract" as const,
                vertical: "Credit" as const,
                companyName: "Vanguard Logistics",
                tags: ["Term Sheet", "Direct Lending", "Senior Secured"],
                createdAt: Date.now() - 400000,
                updatedAt: Date.now(),
            }
        ];

        for (const doc of docs) {
            await ctx.db.insert("oakstoneDocs", doc);
        }

        return { success: true, seededDeals: deals.length, seededDocs: docs.length };
    },
});
