"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Shield, CheckCircle, XCircle, Clock, Terminal } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@repo/convex";
import { Id } from "@repo/convex";

interface ApprovalRequest {
    _id: Id<"approvalRequests">;
    title: string;
    description: string;
    toolName: string;
    toolArgs?: Record<string, unknown>;
    riskLevel: "low" | "medium" | "high" | "critical";
    status: "pending" | "approved" | "rejected" | "expired";
    createdAt: number;
    expiresAt: number;
}

interface CommandApprovalModalProps {
    approvals: ApprovalRequest[];
    onClose?: () => void;
}

export function CommandApprovalModal({ approvals, onClose }: CommandApprovalModalProps) {
    const resolveApproval = useMutation(api.approvals.resolveApproval);
    const [processing, setProcessing] = useState<string | null>(null);

    const pendingApprovals = approvals.filter((a) => a.status === "pending");

    if (pendingApprovals.length === 0) {
        return null;
    }

    const handleApprove = async (approvalId: Id<"approvalRequests">) => {
        setProcessing(approvalId);
        try {
            await resolveApproval({
                approvalId,
                decision: "approved",
            });
        } catch (err: unknown) {
            console.error("Failed to approve:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            alert(`Error: ${errorMessage}`);
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (approvalId: Id<"approvalRequests">, reason?: string) => {
        setProcessing(approvalId);
        try {
            await resolveApproval({
                approvalId,
                decision: "rejected",
                rejectionReason: reason || "Rejected by user",
            });
        } catch (err: unknown) {
            console.error("Failed to reject:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            alert(`Error: ${errorMessage}`);
        } finally {
            setProcessing(null);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-orange-500/10 to-red-500/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-500/20 rounded-lg">
                                <AlertTriangle className="h-5 w-5 text-orange-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-100">
                                    Command Approval Required
                                </h2>
                                <p className="text-sm text-zinc-400 mt-0.5">
                                    {pendingApprovals.length} dangerous command{pendingApprovals.length !== 1 ? "s" : ""} need{pendingApprovals.length === 1 ? "s" : ""} your approval
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Approval List */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {pendingApprovals.map((approval) => (
                            <ApprovalCard
                                key={approval._id}
                                approval={approval}
                                processing={processing === approval._id}
                                onApprove={() => handleApprove(approval._id)}
                                onReject={(reason) => handleReject(approval._id, reason)}
                            />
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                            <div className="flex items-center gap-2">
                                <Shield className="h-3.5 w-3.5" />
                                <span>Terminal execution paused until approval</span>
                            </div>
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="text-zinc-400 hover:text-zinc-100 transition-colors"
                                >
                                    Dismiss
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function ApprovalCard({
    approval,
    processing,
    onApprove,
    onReject,
}: {
    approval: ApprovalRequest;
    processing: boolean;
    onApprove: () => void;
    onReject: (reason?: string) => void;
}) {
    const [showRejectReason, setShowRejectReason] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [now, setNow] = useState(() => Date.now());

    // Update time every second
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const riskConfig = {
        low: { color: "text-blue-400 bg-blue-500/10 border-blue-500/30", icon: Shield },
        medium: { color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", icon: AlertTriangle },
        high: { color: "text-orange-400 bg-orange-500/10 border-orange-500/30", icon: AlertTriangle },
        critical: { color: "text-red-400 bg-red-500/10 border-red-500/30", icon: AlertTriangle },
    };

    const config = riskConfig[approval.riskLevel];
    const RiskIcon = config.icon;

    // Calculate time remaining
    const timeRemaining = Math.max(0, approval.expiresAt - now);
    const secondsRemaining = Math.floor(timeRemaining / 1000);

    return (
        <div className={`border rounded-lg overflow-hidden ${config.color}`}>
            {/* Header */}
            <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                        <RiskIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-zinc-100">
                                {approval.title}
                            </h3>
                            <p className="text-xs text-zinc-400 mt-1">
                                {approval.description}
                            </p>
                        </div>
                    </div>

                    {/* Risk Badge */}
                    <div className={`px-2 py-1 rounded text-xs font-medium uppercase ${config.color}`}>
                        {approval.riskLevel}
                    </div>
                </div>
            </div>

            {/* Command Details */}
            <div className="px-4 py-3 bg-zinc-900/50">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                        <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                        <span className="text-zinc-500">Command:</span>
                    </div>
                    <div className="bg-black/40 rounded p-3 font-mono text-xs text-cyan-400">
                        {String(approval.toolArgs?.command ?? approval.toolName)}
                    </div>

                    {/* Timer */}
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                            Expires in {secondsRemaining}s
                        </span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="px-4 py-3 bg-zinc-800/30 border-t border-zinc-700">
                {!showRejectReason ? (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onApprove}
                            disabled={processing}
                            className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded transition-colors flex items-center justify-center gap-2"
                        >
                            {processing ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-4 w-4" />
                                    Approve & Execute
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => setShowRejectReason(true)}
                            disabled={processing}
                            className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 disabled:bg-zinc-700 disabled:text-zinc-500 text-red-400 font-medium rounded transition-colors flex items-center justify-center gap-2"
                        >
                            <XCircle className="h-4 w-4" />
                            Reject & Block
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-zinc-400 mb-2">
                                Rejection Reason (optional)
                            </label>
                            <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Why are you rejecting this command?"
                                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => onReject(rejectReason)}
                                disabled={processing}
                                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded transition-colors"
                            >
                                {processing ? "Processing..." : "Confirm Rejection"}
                            </button>
                            <button
                                onClick={() => setShowRejectReason(false)}
                                disabled={processing}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
