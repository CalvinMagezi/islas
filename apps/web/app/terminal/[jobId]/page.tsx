"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Id } from "@repo/convex";
import { TerminalView } from "@/components/chat/terminal-view";
import { ArrowLeft, Activity } from "lucide-react";
import Link from "next/link";

export default function TerminalPage() {
    const params = useParams();
    const jobId = params.jobId as Id<"agentJobs">;

    const job = useQuery(api.agent.getJob, { jobId });
    const sessions = useQuery(api.agent.getTerminalSessions, { jobId });

    if (!job) {
        return (
            <div className="flex items-center justify-center h-screen bg-zinc-950">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4" />
                    <p className="text-zinc-400">Loading terminal session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-zinc-950">
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
                        <h1 className="text-sm font-semibold text-zinc-100">
                            Terminal Session
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <div className="flex items-center gap-2">
                        <span>Job:</span>
                        <code className="px-2 py-1 bg-zinc-800 rounded text-cyan-400">
                            {jobId.slice(-8)}
                        </code>
                    </div>
                    <div className="flex items-center gap-2">
                        <span>Status:</span>
                        <span className={`px-2 py-1 rounded font-medium ${
                            job.status === "running"
                                ? "bg-green-500/10 text-green-400"
                                : job.status === "done"
                                ? "bg-blue-500/10 text-blue-400"
                                : job.status === "failed"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-yellow-500/10 text-yellow-400"
                        }`}>
                            {job.status}
                        </span>
                    </div>
                    {sessions && sessions.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span>Sessions:</span>
                            <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-300 font-medium">
                                {sessions.length}
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

            {/* Terminal */}
            <div className="flex-1 p-4 overflow-hidden">
                <TerminalView jobId={jobId} />
            </div>
        </div>
    );
}
