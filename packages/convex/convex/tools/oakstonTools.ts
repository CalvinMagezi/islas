import { createTool, type ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";

export const searchDocuments = createTool({
    description: "Search Oakstone's ingested document corpus (IMs, pitch decks, financial models, etc.) via semantic vector search powered by OpenRouter embeddings.",
    args: z.object({
        query: z.string().describe("Natural language search query"),
        docType: z.string().optional().describe("Filter by document type: im, pitch_deck, financial_model, report, contract, memo, market_brief"),
        vertical: z.string().optional().describe("Filter by investment vertical: Credit, Venture, Absolute Return, Real Assets, Digital Assets, Listed Assets"),
        limit: z.number().optional().describe("Max results (default 5)"),
    }),
    handler: async (ctx: ToolCtx, args: { query: string; docType?: string; vertical?: string; limit?: number }): Promise<{
        found: boolean;
        message: string;
        results: Array<{ title: string; snippet: string; docType: string; vertical?: string; companyName?: string; score: number }>;
    }> => {
        // @ts-ignore
        const results = await ctx.runAction(internal.chat.searchDocuments.searchDocuments, {
            query: args.query,
            userId: ctx.userId ?? "local-user",
            docType: args.docType,
            vertical: args.vertical,
            limit: args.limit ?? 5,
        }) as any[];

        if (!results || results.length === 0) {
            return { found: false, message: `No documents found for: "${args.query}"`, results: [] };
        }

        return {
            found: true,
            message: `Found ${results.length} relevant document(s)`,
            results: results.map((r: any) => ({
                title: r.title,
                snippet: r.content,
                docType: r.docType,
                vertical: r.vertical,
                companyName: r.companyName,
                score: r.score,
            })),
        };
    },
});

export const analyzeDeal = createTool({
    description: "Analyze a deal and generate a structured risk/mitigant matrix and summary.",
    args: z.object({
        dealDescription: z.string(),
        companyName: z.string(),
    }),
    handler: async (ctx: ToolCtx, args: { dealDescription: string; companyName: string }) => {
        return {
            status: "success",
            companyName: args.companyName,
            description: args.dealDescription,
            analysis: "Analyzed successfully",
            uiVariant: "dealAnalysis"
        };
    }
});

export const generateMemo = createTool({
    description: "Generate an IC memo, LP letter, or board pack based on provided context.",
    args: z.object({
        topicContext: z.string(),
        memoType: z.string(),
    }),
    handler: async (ctx: ToolCtx, args: { topicContext: string; memoType: string }) => {
        return {
            status: "success",
            memoType: args.memoType,
            topicContext: args.topicContext,
            content: "Generated memo content"
        };
    }
});

export const trackDeal = createTool({
    description: "Create or update a deal in the Oakstone deal pipeline. Status workflow: screening → due_diligence → ic_review → approved / passed → closed.",
    args: z.object({
        name: z.string().describe("Deal or company name"),
        vertical: z.string().describe("Investment vertical: Credit, Venture, Absolute Return, Real Assets, Digital Assets, Listed Assets"),
        status: z.string().describe("Pipeline status: screening, due_diligence, ic_review, approved, passed, closed"),
        companyName: z.string(),
        sector: z.string().optional(),
        geography: z.string().optional(),
        dealSize: z.string().optional(),
        summary: z.string().optional(),
    }),
    handler: async (ctx: ToolCtx, args: {
        name: string; vertical: string; status: string; companyName: string;
        sector?: string; geography?: string; dealSize?: string; summary?: string;
    }): Promise<{ created: boolean; dealName: string; status: string }> => {
        // @ts-ignore
        await ctx.runMutation(internal.functions.oakstoneDeals.upsertDeal, {
            userId: ctx.userId ?? "local-user",
            name: args.name,
            vertical: args.vertical as any,
            status: args.status as any,
            companyName: args.companyName,
            sector: args.sector,
            geography: args.geography,
            dealSize: args.dealSize,
            summary: args.summary,
        });
        return { created: true, dealName: args.name, status: args.status };
    },
});

export const showPortfolio = createTool({
    description: "Display an interactive portfolio overview of Oakstone's investments grouped by vertical.",
    args: z.object({
        vertical: z.string().optional().describe("Filter by vertical, or omit for all verticals"),
        status: z.string().optional().describe("Filter by status: screening, due_diligence, ic_review, approved, passed, closed"),
    }),
    handler: async (ctx: ToolCtx, args: { vertical?: string; status?: string }): Promise<{
        deals: unknown[];
        totalCount: number;
        byVertical: Record<string, number>;
    }> => {
        // @ts-ignore
        const deals = await ctx.runQuery(internal.functions.oakstoneDeals.listDeals, {
            userId: ctx.userId ?? "local-user",
            vertical: args.vertical,
            status: args.status,
        }) as any[];

        const byVertical: Record<string, number> = {};
        for (const d of deals) {
            byVertical[d.vertical] = (byVertical[d.vertical] ?? 0) + 1;
        }

        return { deals, totalCount: deals.length, byVertical };
    },
});

export const showMarketBrief = createTool({
    description: "Display a market brief and macro summary for a specific topic, region, or vertical.",
    args: z.object({
        topic: z.string(),
    }),
    handler: async (ctx: ToolCtx, args: { topic: string }) => {
        return { status: "success", topic: args.topic, uiVariant: "marketBrief" };
    }
});

export const generateReport = createTool({
    description: "Generate an automated portfolio, market, or pipeline report.",
    args: z.object({
        reportType: z.string(),
    }),
    handler: async (ctx: ToolCtx, args: { reportType: string }) => {
        return { status: "success", reportType: args.reportType, uiVariant: "reportView" };
    }
});

export const showDealPipeline = createTool({
    description: "Display a Kanban-style deal pipeline showing all deals grouped by pipeline stage.",
    args: z.object({
        vertical: z.string().optional().describe("Filter by investment vertical"),
    }),
    handler: async (ctx: ToolCtx, args: { vertical?: string }): Promise<{
        stages: Record<string, unknown[]>;
        totalDeals: number;
    }> => {
        // @ts-ignore
        const deals = await ctx.runQuery(internal.functions.oakstoneDeals.listDeals, {
            userId: ctx.userId ?? "local-user",
            vertical: args.vertical,
        }) as any[];

        const stages: Record<string, any[]> = {
            screening: [],
            due_diligence: [],
            ic_review: [],
            approved: [],
            passed: [],
            closed: [],
        };
        for (const d of deals) {
            if (stages[d.status]) stages[d.status].push(d);
        }

        return { stages, totalDeals: deals.length };
    },
});
