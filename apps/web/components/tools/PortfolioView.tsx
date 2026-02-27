import type { ToolResultProps } from "@/components/chat/tool-result-part";

interface Deal {
    companyName: string;
    name: string;
    vertical: string;
    status: string;
    dealSize?: string;
    sector?: string;
    geography?: string;
    summary?: string;
}

interface PortfolioData {
    deals: Deal[];
    totalCount: number;
    byVertical: Record<string, number>;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    screening: { label: "Screening", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
    due_diligence: { label: "Due Diligence", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
    ic_review: { label: "IC Review", className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
    approved: { label: "Approved", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
    passed: { label: "Passed", className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200" },
    closed: { label: "Closed", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
};

export function PortfolioView({ data }: ToolResultProps) {
    const portfolio = data as PortfolioData;
    const deals = portfolio?.deals ?? [];
    const totalCount = portfolio?.totalCount ?? 0;
    const byVertical = portfolio?.byVertical ?? {};

    return (
        <div className="flex flex-col gap-4 p-4 surface border-border rounded-xl">
            <div className="flex justify-between items-center border-b pb-2">
                <h2 className="text-xl font-bold font-serif">Oakstone Portfolio</h2>
                <span className="text-sm text-muted-foreground font-mono">{totalCount} investments</span>
            </div>

            {/* Vertical summary tabs */}
            <div className="flex gap-2 flex-wrap">
                {Object.entries(byVertical).map(([vertical, count]) => (
                    <span key={vertical} className="px-2 py-1 text-xs rounded-full bg-muted border font-medium">
                        {vertical}: {count}
                    </span>
                ))}
            </div>

            {/* Deal cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {deals.map((deal) => {
                    const badge = STATUS_BADGE[deal.status] ?? { label: deal.status, className: "bg-gray-100 text-gray-800" };
                    return (
                        <div key={deal.companyName} className="p-3 border rounded-lg flex flex-col gap-2 hover:shadow-sm transition-shadow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-semibold">{deal.companyName}</h3>
                                    <p className="text-xs text-muted-foreground">{deal.name}</p>
                                </div>
                                <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${badge.className}`}>
                                    {badge.label}
                                </span>
                            </div>
                            {deal.summary && (
                                <p className="text-sm text-muted-foreground">{deal.summary}</p>
                            )}
                            <div className="flex gap-3 text-xs border-t pt-2 mt-auto">
                                <span className="font-medium">{deal.vertical}</span>
                                {deal.sector && <span className="text-muted-foreground">{deal.sector}</span>}
                                {deal.geography && <span className="text-muted-foreground">{deal.geography}</span>}
                                {deal.dealSize && <span className="font-mono">{deal.dealSize}</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
