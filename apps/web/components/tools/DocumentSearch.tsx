import { FileText, Search } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

interface SearchResult {
    title: string;
    type: string;
    vertical?: string;
    score: number;
    snippet?: string;
    companyName?: string;
}

export function DocumentSearch({ data }: ToolResultProps) {
    const { query, results } = data as { query: string; results?: SearchResult[] };
    // Using mock results for POC if none provided
    const searchResults = results && results.length > 0 ? results : [
        { title: "Project Phoenix IM", type: "im", vertical: "Real Assets", score: 0.95 },
        { title: "Q3 Market Summary", type: "market_brief", vertical: "Credit", score: 0.88 },
    ];

    return (
        <div className="flex flex-col gap-3 p-4 surface border-border rounded-xl">
            <h2 className="text-lg font-bold font-serif flex items-center gap-2">
                <Search className="w-4 h-4 text-oakstone-light-blue" />
                Search Results: &quot;{query}&quot;
            </h2>

            <div className="flex flex-col gap-2 mt-2">
                {searchResults.map((res, i) => (
                    <div key={i} className="flex flex-col gap-1 p-2 border rounded hover:bg-muted cursor-pointer transition-colors">
                        <div className="flex justify-between items-start">
                            <div className="font-semibold text-sm flex items-center gap-2">
                                <FileText className="w-3 h-3 text-muted-foreground" />
                                {res.title}
                            </div>
                            <div className="text-xs bg-oakstone-secondary text-white px-2 rounded-full uppercase tracking-wider">
                                {res.type}
                            </div>
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-2">
                            <span>{res.vertical}</span>
                            <span>•</span>
                            <span>Match: {Math.round(res.score * 100)}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
