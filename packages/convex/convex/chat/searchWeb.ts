/**
 * Web Search Tool - Search the web using Brave Search API
 */

import { action } from "../_generated/server";
import { v } from "convex/values";

export const searchWeb = action({
  args: {
    query: v.string(),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const braveApiKey = process.env.BRAVE_API_KEY;

    if (!braveApiKey) {
      throw new Error("BRAVE_API_KEY not configured");
    }

    try {
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(args.query)}&count=${args.count ?? 5}`,
        {
          headers: {
            Accept: "application/json",
            "X-Subscription-Token": braveApiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Brave API error: ${response.statusText}`);
      }

      const data = await response.json();

      return (
        data.web?.results?.map((r: any) => ({
          title: r.title,
          url: r.url,
          description: r.description,
          age: r.age,
        })) ?? []
      );
    } catch (error) {
      console.error("Web search error:", error);
      return [];
    }
  },
});
