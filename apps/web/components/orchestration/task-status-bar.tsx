"use client";

import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

interface Task {
    id: string;
    description: string;
    status: "pending" | "running" | "completed" | "failed";
}

interface TaskStats {
    pending: number;
    running: number;
    completed: number;
    failed: number;
}

interface TaskStatusBarProps {
    tasks: Task[];
    stats: TaskStats;
    completionPercent: number;
}

export function TaskStatusBar({ tasks, stats, completionPercent }: TaskStatusBarProps) {
    return (
        <div className="border-b border-zinc-800 bg-zinc-900/30">
            {/* Progress Bar */}
            <div className="h-1 bg-zinc-800 relative overflow-hidden">
                <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${completionPercent}%` }}
                />
            </div>

            {/* Stats */}
            <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                    {/* Left: Task Summary */}
                    <div className="flex items-center gap-4">
                        <div className="text-xs">
                            <span className="text-zinc-500">Total Tasks:</span>
                            <span className="ml-2 font-medium text-zinc-300">{tasks.length}</span>
                        </div>

                        <div className="h-4 w-px bg-zinc-700" />

                        <div className="flex items-center gap-3">
                            {stats.pending > 0 && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <Clock className="h-3.5 w-3.5 text-yellow-400" />
                                    <span className="text-zinc-400">{stats.pending} Pending</span>
                                </div>
                            )}

                            {stats.running > 0 && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <Loader2 className="h-3.5 w-3.5 text-green-400 animate-spin" />
                                    <span className="text-zinc-400">{stats.running} Running</span>
                                </div>
                            )}

                            {stats.completed > 0 && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                                    <span className="text-zinc-400">{stats.completed} Completed</span>
                                </div>
                            )}

                            {stats.failed > 0 && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <XCircle className="h-3.5 w-3.5 text-red-400" />
                                    <span className="text-zinc-400">{stats.failed} Failed</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Completion Percent */}
                    <div className="text-sm font-semibold text-cyan-400">
                        {completionPercent}% Complete
                    </div>
                </div>

                {/* Task List (Compact) */}
                <div className="mt-3 flex flex-wrap gap-2">
                    {tasks.map((task) => (
                        <TaskChip key={task.id} task={task} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function TaskChip({ task }: { task: Task }) {
    const statusConfig = {
        pending: {
            icon: Clock,
            color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
            dotColor: "bg-yellow-500",
        },
        running: {
            icon: Loader2,
            color: "bg-green-500/10 border-green-500/30 text-green-400",
            dotColor: "bg-green-500",
            spin: true,
        },
        completed: {
            icon: CheckCircle2,
            color: "bg-blue-500/10 border-blue-500/30 text-blue-400",
            dotColor: "bg-blue-500",
        },
        failed: {
            icon: XCircle,
            color: "bg-red-500/10 border-red-500/30 text-red-400",
            dotColor: "bg-red-500",
        },
    };

    const config = statusConfig[task.status];

    return (
        <div
            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs font-medium ${config.color}`}
            title={task.description}
        >
            <div className={`w-2 h-2 rounded-full ${config.dotColor} ${"spin" in config && config.spin ? 'animate-pulse' : ''}`} />
            <span className="max-w-[150px] truncate">{task.id}</span>
        </div>
    );
}
