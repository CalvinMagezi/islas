import { FileBarChart2, Download } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

export function ReportView({ data }: ToolResultProps) {
    const { reportType } = data as { reportType: string };
    return (
        <div className="flex flex-col gap-4 p-5 surface border-border rounded-xl shadow-sm">
            <div className="flex justify-between items-center border-b pb-3 border-oakstone-gold/30">
                <h2 className="text-xl font-bold font-serif flex items-center gap-2 text-oakstone-blue dark:text-gray-100">
                    <FileBarChart2 className="w-5 h-5" />
                    {reportType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                </h2>
                <button className="flex items-center gap-1 text-xs bg-oakstone-blue hover:bg-oakstone-secondary text-white px-3 py-1.5 rounded transition-colors">
                    <Download className="w-3 h-3" /> Export PDF
                </button>
            </div>

            <div className="prose prose-chat text-sm">
                <h3 className="text-oakstone-gold">Executive Summary</h3>
                <p>The portfolio has demonstrated resilience in Q3 despite macroeconomic headwinds in emerging markets. Credit strategies outperformed benchmarks by 120bps.</p>

                <h3 className="text-oakstone-gold mt-4">Key Metrics</h3>
                <ul>
                    <li><strong>AUM Growth:</strong> +4.2% QoQ</li>
                    <li><strong>Deployment:</strong> $45M across 3 new positions</li>
                    <li><strong>Exits:</strong> 1 successful realization (Beta Solar)</li>
                </ul>
            </div>
        </div>
    );
}
