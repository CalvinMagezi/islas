import { TrendingUp, Globe } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

export function MarketBrief({ data }: ToolResultProps) {
    const { topic } = data as { topic: string };
    return (
        <div className="flex flex-col gap-4 p-4 surface border-border rounded-xl">
            <h2 className="text-xl font-bold font-serif border-b pb-2 flex items-center gap-2">
                <Globe className="w-5 h-5 text-oakstone-blue" />
                Market Brief: {topic}
            </h2>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg border">
                    <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Yield Curve</div>
                    <div className="font-mono text-sm text-green-600 font-bold flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Normalizing
                    </div>
                </div>
                <div className="p-3 bg-muted rounded-lg border">
                    <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Regional Focus</div>
                    <div className="font-mono text-sm font-bold">Emerging Markets</div>
                </div>
            </div>

            <div className="prose prose-chat text-sm mt-2">
                <p>
                    African bond markets are showing signs of stabilization following recent monetary policy adjustments.
                    Inflationary pressures are moderating, though currency volatility remains a key consideration for cross-border investments.
                </p>
            </div>
        </div>
    );
}
