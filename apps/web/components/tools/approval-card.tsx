"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@repo/convex";
import type { Id } from "@repo/convex";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

const RISK_STYLES: Record<
  string,
  { border: string; bg: string; icon: typeof Shield; badge: string }
> = {
  low: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    icon: Shield,
    badge: "bg-blue-500/20 text-blue-300",
  },
  medium: {
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/10",
    icon: ShieldAlert,
    badge: "bg-yellow-500/20 text-yellow-300",
  },
  high: {
    border: "border-orange-500/30",
    bg: "bg-orange-500/10",
    icon: ShieldAlert,
    badge: "bg-orange-500/20 text-orange-300",
  },
  critical: {
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    icon: ShieldX,
    badge: "bg-red-500/20 text-red-300",
  },
};

interface ApprovalData {
  approvalId: string;
  status: string;
  title: string;
  description: string;
  riskLevel: string;
  expiresAt: number;
}

export function ApprovalCard({ data, onAction }: ToolResultProps) {
  const approval = data as ApprovalData | undefined;
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<"approved" | "rejected" | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const resolveApproval = useMutation(
    api.functions.approvals.resolveApproval,
  );

  if (!approval) return null;

  const risk = RISK_STYLES[approval.riskLevel] ?? RISK_STYLES.medium;
  const RiskIcon = risk.icon;
  const isExpired = approval.expiresAt < Date.now();

  // Already resolved
  if (resolved || isExpired) {
    const isApproved = resolved === "approved";
    return (
      <div className="glass animate-float-up flex items-center gap-2.5 rounded-xl px-4 py-3">
        {isExpired && !resolved ? (
          <>
            <Clock className="h-4.5 w-4.5 shrink-0 text-muted-foreground/50" />
            <span className="text-sm text-muted-foreground/50">
              {approval.title} — expired
            </span>
          </>
        ) : isApproved ? (
          <>
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-green-400" />
            <span className="text-sm text-muted-foreground/90">
              {approval.title} — approved
            </span>
          </>
        ) : (
          <>
            <XCircle className="h-4.5 w-4.5 shrink-0 text-red-400" />
            <span className="text-sm text-muted-foreground/90">
              {approval.title} — rejected
            </span>
          </>
        )}
      </div>
    );
  }

  const handleApprove = async () => {
    setResolving(true);
    try {
      await resolveApproval({
        approvalId: approval.approvalId as Id<"approvalRequests">,
        decision: "approved",
      });
      setResolved("approved");
      onAction?.(
        `I approved the request "${approval.title}" (ID: ${approval.approvalId}). Please proceed with the action.`,
      );
    } catch (err) {
      console.error("Failed to approve:", err);
    } finally {
      setResolving(false);
    }
  };

  const handleReject = async () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    setResolving(true);
    try {
      await resolveApproval({
        approvalId: approval.approvalId as Id<"approvalRequests">,
        decision: "rejected",
        rejectionReason: rejectionReason || undefined,
      });
      setResolved("rejected");
      onAction?.(
        `I rejected the request "${approval.title}" (ID: ${approval.approvalId}).${rejectionReason ? ` Reason: ${rejectionReason}` : ""} Do NOT proceed with that action.`,
      );
    } catch (err) {
      console.error("Failed to reject:", err);
    } finally {
      setResolving(false);
    }
  };

  const timeLeft = Math.max(
    0,
    Math.floor((approval.expiresAt - Date.now()) / 60000),
  );

  return (
    <div
      className={`glass animate-float-up rounded-xl border ${risk.border} p-4 space-y-3`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`rounded-lg p-1.5 ${risk.bg}`}>
            <RiskIcon className="h-4 w-4 text-current" />
          </div>
          <div>
            <h4 className="text-sm font-medium">{approval.title}</h4>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {approval.description}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${risk.badge}`}
        >
          {approval.riskLevel}
        </span>
      </div>

      {/* Expiry */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
        <Clock className="h-3 w-3" />
        <span>Expires in {timeLeft} min</span>
      </div>

      {/* Reject reason input */}
      {showRejectInput && (
        <input
          type="text"
          placeholder="Reason for rejection (optional)"
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-white/20"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleReject();
          }}
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={resolving}
          className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-3"
        >
          {resolving ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <ShieldCheck className="h-3 w-3 mr-1" />
          )}
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReject}
          disabled={resolving}
          className="text-xs h-7 px-3 border-white/10 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30"
        >
          {showRejectInput ? (
            "Confirm Reject"
          ) : (
            <>
              <ShieldX className="h-3 w-3 mr-1" />
              Reject
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
