import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

export function DealAnalysis({ data }: ToolResultProps) {
    const { companyName, description } = data as { companyName: string, description: string };
    return (
        <div className="flex flex-col gap-4 p-4 surface border-border rounded-xl">
            <h2 className="text-xl font-bold font-serif border-b pb-2">Deal Analysis: {companyName}</h2>

            <div className="prose prose-chat max-w-none">
                <p className="text-sm">{description}</p>

                <h3 className="text-sm font-semibold mt-4 mb-2 flex flex-row items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Executive Summary
                </h3>
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    Strong market position with solid recurring revenue. Primary risk relates to customer concentration.
                </p>

                <h3 className="text-sm font-semibold mt-4 mb-2 flex flex-row items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-oakstone-gold" /> Risk Matrix
                </h3>
                <table className="w-full text-xs">
                    <thead>
                        <tr><th>Risk Factor</th><th>Severity</th><th>Mitigant</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Customer Concentration</td>
                            <td><span className="text-red-500 font-semibold">High</span></td>
                            <td>Diversification strategy in place for Q3</td>
                        </tr>
                        <tr>
                            <td>Regulatory Changes</td>
                            <td><span className="text-yellow-600 font-semibold">Medium</span></td>
                            <td>Proactive legal counsel engagement</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
