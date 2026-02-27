import type { ToolResultProps } from "@/components/chat/tool-result-part";

interface Deal {
    companyName: string;
    name: string;
    vertical: string;
    status: string;
    dealSize?: string;
    sector?: string;
    geography?: string;
}

interface PipelineData {
    stages: Record<string, Deal[]>;
    totalDeals: number;
}

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
    screening: { label: "Screening", color: "border-blue-400" },
    due_diligence: { label: "Due Diligence", color: "border-yellow-500" },
    ic_review: { label: "IC Review", color: "border-orange-500" },
    approved: { label: "Approved", color: "border-green-500" },
    passed: { label: "Passed", color: "border-gray-400" },
    closed: { label: "Closed", color: "border-purple-500" },
};

export function DealPipeline({ data }: ToolResultProps) {
    const pipeline = data as PipelineData;
    const stages = pipeline?.stages ?? {};
    const totalDeals = pipeline?.totalDeals ?? 0;

    return (
        <div className="flex flex-col gap-3 p-4 surface border-border rounded-xl">
            <div className="flex justify-between items-center border-b pb-2">
                <h2 className="text-xl font-bold font-serif">Deal Pipeline</h2>
                <span className="text-sm text-muted-foreground font-mono">{totalDeals} deals</span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {Object.entries(STAGE_CONFIG).map(([key, config]) => {
                    const deals = stages[key] ?? [];
                    return (
                        <div key={key} className="min-w-[200px] flex flex-col gap-2 p-2 bg-muted rounded-lg border">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-semibold uppercase tracking-wider">{config.label}</h3>
                                <span className="text-xs text-muted-foreground">{deals.length}</span>
                            </div>
                            {deals.length === 0 ? (
                                <div className="text-xs text-muted-foreground text-center py-4 italic">No deals</div>
                            ) : (
                                deals.map((deal) => (
                                    <div key={deal.companyName} className={`p-2 surface rounded shadow-sm text-sm border-l-2 ${config.color} cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-colors`}>
                                        <div className="font-semibold">{deal.companyName}</div>
                                        <div className="text-xs text-muted-foreground">{deal.vertical}</div>
                                        {deal.dealSize && (
                                            <div className="text-xs font-mono mt-1">{deal.dealSize}</div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
