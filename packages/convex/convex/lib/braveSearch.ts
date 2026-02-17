/**
 * Brave Search API integration for fetching current news
 */

export interface BraveSearchResult {
    title: string;
    url: string;
    description: string;
}

export interface BraveWebSearchResponse {
    web?: {
        results: Array<{
            title: string;
            url: string;
            description: string;
        }>;
    };
}

/**
 * Search the web using Brave Search API
 * @param query - Search query
 * @param count - Number of results (max 20)
 * @param freshness - Filter by freshness: pd (past day), pw (past week), pm (past month)
 */
export async function braveWebSearch(
    query: string,
    count: number = 10,
    freshness: "pd" | "pw" | "pm" = "pd"
): Promise<BraveSearchResult[]> {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (!apiKey) {
        throw new Error("BRAVE_SEARCH_API_KEY is not configured");
    }

    const params = new URLSearchParams({
        q: query,
        count: String(count),
        freshness,
    });

    const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?${params}`,
        {
            headers: {
                "X-Subscription-Token": apiKey,
                Accept: "application/json",
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Brave Search API error: ${response.status}`);
    }

    const data = (await response.json()) as BraveWebSearchResponse;

    return (
        data.web?.results.map((r) => ({
            title: r.title,
            url: r.url,
            description: r.description,
        })) ?? []
    );
}
