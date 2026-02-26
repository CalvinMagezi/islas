
interface Company {
    name: string;
    status: string;
    vertical: string;
    description: string;
}

import type { ToolResultProps } from "@/components/chat/tool-result-part";

export function PortfolioView(_props: ToolResultProps) {
    // Mock data for POC UI
    const companies: Company[] = [
        { name: "Alpha Tech", status: "active", vertical: "Credit", description: "B2B SaaS" },
        { name: "Beta Solar", status: "exited", vertical: "Real Assets", description: "Solar Farm Developer" },
        { name: "Gamma Crypto", status: "pipeline", vertical: "Digital Assets", description: "DeFi Protocol" },
    ];

    return (
        <div className="flex flex-col gap-4 p-4 surface border-border rounded-xl">
            <div className="flex justify-between items-center border-b pb-2 mb-2">
                <h2 className="text-xl font-bold font-serif">Oakstone Portfolio</h2>
                <div className="flex gap-2 text-sm">
                    <span className="px-2 py-1 bg-oakstone-blue text-white rounded">Credit</span>
                    <span className="px-2 py-1 bg-oakstone-gold text-white rounded">Real Assets</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {companies.map(c => (
                    <div key={c.name} className="p-3 border rounded-lg glass-heavy flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-lg">{c.name}</h3>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                {c.status}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{c.description}</p>
                        <div className="mt-2 pt-2 border-t text-xs font-mono">Vertical: {c.vertical}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
