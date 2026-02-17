"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Id } from "@repo/convex";
import { ArrowLeft, Activity, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { TaskDAGVisualization } from "@/components/orchestration/task-dag";
import { TerminalGrid } from "@/components/orchestration/terminal-grid";
import { TaskStatusBar } from "@/components/orchestration/task-status-bar";
import { CommandApprovalModal } from "@/components/orchestration/command-approval-modal";
import { CommandAuditLog } from "@/components/orchestration/command-audit-log";

export default function OrchestrationPage() {
    const params = useParams();
    const jobId = params.jobId as Id<"agentJobs">;

    const job = useQuery(api.agent.getJob, { jobId });
    const taskPlan = useQuery(api.agent.getTaskPlan, { jobId });
    const sessions = useQuery(api.agent.getTerminalSessions, { jobId });
    const approvals = useQuery(api.approvals.getByJob, { jobId });

    if (!job) {
        return (
            <div className="flex items-center justify-center h-screen bg-zinc-950">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4" />
                    <p className="text-zinc-400">Loading orchestration data...</p>
                </div>
            </div>
        );
    }

    // Calculate task statistics
    const taskStats = taskPlan?.tasks.reduce(
        (acc, task) => {
            acc[task.status]++;
            return acc;
        },
        { pending: 0, running: 0, completed: 0, failed: 0 }
    ) || { pending: 0, running: 0, completed: 0, failed: 0 };

    const totalTasks = taskPlan?.tasks.length || 0;
    const completionPercent = totalTasks > 0
        ? Math.round(((taskStats.completed + taskStats.failed) / totalTasks) * 100)
        : 0;

    return (
        <>
            {/* Command Approval Modal */}
            {approvals && approvals.length > 0 && (
                <CommandApprovalModal approvals={approvals} />
            )}

            <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="text-sm">Back</span>
                    </Link>
                    <div className="h-4 w-px bg-zinc-700" />
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-cyan-500" />
                        <h1 className="text-sm font-semibold">Mission Control</h1>
                    </div>
                </div>

                {/* Job Status */}
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Job:</span>
                        <code className="px-2 py-1 bg-zinc-800 rounded text-cyan-400">
                            {jobId.slice(-8)}
                        </code>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Status:</span>
                        <StatusBadge status={job.status} />
                    </div>
                    {totalTasks > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-500">Progress:</span>
                            <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-300 font-medium">
                                {completionPercent}%
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Job Instruction */}
            <div className="px-4 py-2 bg-zinc-900/30 border-b border-zinc-800">
                <p className="text-xs text-zinc-400">
                    <span className="text-zinc-600">$</span> {job.instruction}
                </p>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {taskPlan && taskPlan.tasks.length > 0 ? (
                    <>
                        {/* Task Status Bar */}
                        <TaskStatusBar
                            tasks={taskPlan.tasks}
                            stats={taskStats}
                            completionPercent={completionPercent}
                        />

                        {/* Two-Column Layout */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left: DAG Visualization */}
                            <div className="w-1/3 border-r border-zinc-800 overflow-auto">
                                <TaskDAGVisualization
                                    tasks={taskPlan.tasks}
                                    _sessions={sessions || []}
                                />
                            </div>

                            {/* Right: Terminal Grid */}
                            <div className="flex-1 overflow-hidden">
                                <TerminalGrid
                                    _jobId={jobId}
                                    tasks={taskPlan.tasks}
                                    sessions={sessions || []}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center text-zinc-500">
                            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No orchestration plan available</p>
                            <p className="text-xs mt-2">
                                This job does not have parallel tasks configured
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Command Audit Log (collapsible footer) */}
            <CommandAuditLog jobId={jobId} />
        </div>
        </>
    );
}

function StatusBadge({ status }: { status: string }) {
    const statusConfig = {
        pending: { icon: Clock, color: "text-yellow-400 bg-yellow-500/10", label: "Pending" },
        running: { icon: Loader2, color: "text-green-400 bg-green-500/10", label: "Running", spin: true },
        waiting_for_user: { icon: Clock, color: "text-blue-400 bg-blue-500/10", label: "Waiting" },
        done: { icon: CheckCircle2, color: "text-blue-400 bg-blue-500/10", label: "Done" },
        failed: { icon: XCircle, color: "text-red-400 bg-red-500/10", label: "Failed" },
        cancelled: { icon: XCircle, color: "text-zinc-400 bg-zinc-500/10", label: "Cancelled" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
        <span className={`px-2 py-1 rounded font-medium flex items-center gap-1.5 ${config.color}`}>
            <Icon className={`h-3.5 w-3.5 ${"spin" in config && config.spin ? 'animate-spin' : ''}`} />
            {config.label}
        </span>
    );
}
