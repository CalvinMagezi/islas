import type { ToolResultProps } from "@/components/chat/tool-result-part";

export function DealPipeline(_props: ToolResultProps) {
    const columns = ["Screening", "Due Diligence", "IC Review", "Approved"];
    const deals = [
        { name: "Fintech Co", stage: "Screening", vertical: "Venture" },
        { name: "AgriLoan Platform", stage: "Due Diligence", vertical: "Credit" },
        { name: "Solar Grid 1", stage: "IC Review", vertical: "Real Assets" },
    ];

    return (
        <div className="flex flex-col gap-3 p-4 surface border-border rounded-xl">
            <h2 className="text-xl font-bold font-serif mb-2">Deal Pipeline</h2>

            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                {columns.map(col => (
                    <div key={col} className="min-w-[200px] flex flex-col gap-2 p-2 bg-muted rounded-lg border">
                        <h3 className="text-xs font-semibold text-center uppercase tracking-wider">{col}</h3>
                        {deals.filter(d => d.stage === col).map(deal => (
                            <div key={deal.name} className="p-2 surface rounded shadow-sm text-sm border-l-2 border-oakstone-gold cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-colors">
                                <div className="font-semibold">{deal.name}</div>
                                <div className="text-xs text-muted-foreground">{deal.vertical}</div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
