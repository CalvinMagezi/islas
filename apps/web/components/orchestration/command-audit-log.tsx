"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Shield, CheckCircle, XCircle, Clock, Terminal, AlertTriangle } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Id } from "@repo/convex";

interface CommandAuditLogProps {
    jobId: Id<"agentJobs">;
}

interface ApprovalRequest {
    _id: Id<"approvalRequests">;
    status: "pending" | "approved" | "rejected" | "expired";
    riskLevel: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    toolName: string;
    toolArgs?: Record<string, unknown>;
    createdAt: number;
    resolvedAt?: number;
    resolvedBy?: string;
    rejectionReason?: string;
}

export function CommandAuditLog({ jobId }: CommandAuditLogProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const approvals = useQuery(api.approvals.getByJob, { jobId });

    if (!approvals || approvals.length === 0) {
        return null;
    }

    const stats = approvals.reduce(
        (acc, approval) => {
            acc[approval.status]++;
            return acc;
        },
        { pending: 0, approved: 0, rejected: 0, expired: 0 }
    );

    return (
        <div className="border-t border-zinc-800 bg-zinc-900/50">
            {/* Collapsed Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-900 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-cyan-500" />
                    <span className="text-sm font-semibold text-zinc-300">
                        Command Audit Log
                    </span>
                    <span className="text-xs text-zinc-500">
                        {approvals.length} command{approvals.length !== 1 ? "s" : ""}
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    {/* Stats */}
                    {stats.pending > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                            <Clock className="h-3.5 w-3.5" />
                            {stats.pending}
                        </div>
                    )}
                    {stats.approved > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-green-400">
                            <CheckCircle className="h-3.5 w-3.5" />
                            {stats.approved}
                        </div>
                    )}
                    {stats.rejected > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-red-400">
                            <XCircle className="h-3.5 w-3.5" />
                            {stats.rejected}
                        </div>
                    )}

                    {/* Expand Icon */}
                    {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-zinc-500" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                    )}
                </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="max-h-64 overflow-y-auto border-t border-zinc-800">
                    <table className="w-full text-xs">
                        <thead className="bg-zinc-900 sticky top-0">
                            <tr className="text-left text-zinc-500">
                                <th className="px-4 py-2 font-medium">Time</th>
                                <th className="px-4 py-2 font-medium">Command</th>
                                <th className="px-4 py-2 font-medium">Risk</th>
                                <th className="px-4 py-2 font-medium">Status</th>
                                <th className="px-4 py-2 font-medium">User</th>
                            </tr>
                        </thead>
                        <tbody>
                            {approvals.map((approval) => (
                                <AuditLogRow key={approval._id} approval={approval} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function AuditLogRow({ approval }: { approval: ApprovalRequest }) {
    const statusConfig = {
        pending: { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
        approved: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
        rejected: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
        expired: { icon: Clock, color: "text-zinc-500", bg: "bg-zinc-500/10" },
    };

    const riskConfig = {
        low: "text-blue-400",
        medium: "text-yellow-400",
        high: "text-orange-400",
        critical: "text-red-400",
    };

    const config = statusConfig[approval.status as keyof typeof statusConfig];
    const riskColor = riskConfig[approval.riskLevel as keyof typeof riskConfig];
    const StatusIcon = config.icon;

    const timestamp = new Date(approval.createdAt).toLocaleTimeString();

    return (
        <tr className="border-t border-zinc-800 hover:bg-zinc-900/50">
            {/* Time */}
            <td className="px-4 py-3 text-zinc-400">
                {timestamp}
            </td>

            {/* Command */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-2 max-w-md">
                    <Terminal className="h-3.5 w-3.5 text-cyan-500 flex-shrink-0" />
                    <code className="text-zinc-300 truncate">
                        {String(approval.toolArgs?.command ?? approval.toolName)}
                    </code>
                </div>
            </td>

            {/* Risk */}
            <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1 ${riskColor}`}>
                    <AlertTriangle className="h-3 w-3" />
                    <span className="uppercase font-medium">{approval.riskLevel}</span>
                </span>
            </td>

            {/* Status */}
            <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${config.bg} ${config.color} font-medium`}>
                    <StatusIcon className="h-3 w-3" />
                    {approval.status}
                </span>
            </td>

            {/* User */}
            <td className="px-4 py-3 text-zinc-400">
                {approval.resolvedBy || "—"}
            </td>
        </tr>
    );
}
