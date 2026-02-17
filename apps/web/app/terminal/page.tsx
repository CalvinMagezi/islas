"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/convex";
import { useRouter } from "next/navigation";
import { Terminal, Play, Zap, Shield, AlertTriangle } from "lucide-react";

export default function TerminalTestPage() {
    const router = useRouter();
    const [creating, setCreating] = useState(false);
    const [instruction, setInstruction] = useState("echo 'Hello from Islas Terminal!'");
    const [securityProfile, setSecurityProfile] = useState<"minimal" | "standard" | "guarded" | "admin">("standard");

    const createJob = useMutation(api.agent.createJob);
    const recentJobs = useQuery(api.agent.listUserJobs, { limit: 5 });

    const handleCreateTerminal = async () => {
        setCreating(true);
        try {
            // Create a terminal-only job (agent won't process with Pi SDK)
            const jobId = await createJob({
                instruction: `[TERMINAL] ${instruction}`,
                type: "background",
                securityProfile,
                // @ts-expect-error - orchestrationType exists but types not updated yet
                orchestrationType: "single",
            });

            // Navigate to terminal page
            router.push(`/terminal/${jobId}`);
        } catch (err: unknown) {
            console.error("Failed to create terminal:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            alert(`Error: ${errorMessage}`);
        } finally {
            setCreating(false);
        }
    };

    const testCommands = [
        { label: "Hello World", command: "echo 'Hello from Islas Terminal!'" },
        { label: "List Files", command: "ls -la" },
        { label: "System Info", command: "uname -a && whoami && pwd" },
        { label: "Network Test", command: "ping -c 3 google.com" },
        { label: "Git Status", command: "git status" },
    ];

    const securityProfiles = [
        {
            value: "minimal" as const,
            icon: Shield,
            name: "Minimal",
            description: "Read-only access, no writes",
            color: "text-blue-400",
        },
        {
            value: "standard" as const,
            icon: Shield,
            name: "Standard",
            description: "Read/write, safe commands only",
            color: "text-green-400",
        },
        {
            value: "guarded" as const,
            icon: AlertTriangle,
            name: "Guarded",
            description: "All commands with approval gates",
            color: "text-yellow-400",
        },
        {
            value: "admin" as const,
            icon: Zap,
            name: "Admin",
            description: "Full system access (dangerous)",
            color: "text-red-400",
        },
    ];

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            {/* Header */}
            <div className="border-b border-zinc-800 bg-zinc-900/50">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center gap-3">
                        <Terminal className="h-8 w-8 text-cyan-500" />
                        <div>
                            <h1 className="text-2xl font-bold">Terminal Test Lab</h1>
                            <p className="text-sm text-zinc-400">
                                Spawn interactive terminal sessions with the Islas Agent
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Create Terminal */}
                    <div className="space-y-6">
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Play className="h-5 w-5 text-cyan-500" />
                                Create New Terminal Session
                            </h2>

                            {/* Command Input */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                                        Command or Instruction
                                    </label>
                                    <textarea
                                        value={instruction}
                                        onChange={(e) => setInstruction(e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                                        rows={3}
                                        placeholder="Enter a command or task description..."
                                    />
                                </div>

                                {/* Quick Commands */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                                        Quick Commands
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {testCommands.map((cmd) => (
                                            <button
                                                key={cmd.label}
                                                onClick={() => setInstruction(cmd.command)}
                                                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs transition-colors"
                                            >
                                                {cmd.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Security Profile */}
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">
                                        Security Profile
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {securityProfiles.map((profile) => {
                                            const Icon = profile.icon;
                                            const isSelected = securityProfile === profile.value;
                                            return (
                                                <button
                                                    key={profile.value}
                                                    onClick={() => setSecurityProfile(profile.value)}
                                                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                                                        isSelected
                                                            ? "border-cyan-500 bg-cyan-500/10"
                                                            : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Icon className={`h-4 w-4 ${profile.color}`} />
                                                        <span className="font-medium text-sm">
                                                            {profile.name}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-zinc-500">
                                                        {profile.description}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Create Button */}
                                <button
                                    onClick={handleCreateTerminal}
                                    disabled={creating || !instruction.trim()}
                                    className="w-full py-3 px-4 bg-cyan-500 hover:bg-cyan-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    {creating ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                            Creating Terminal...
                                        </>
                                    ) : (
                                        <>
                                            <Terminal className="h-4 w-4" />
                                            Launch Terminal Session
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-cyan-400 mb-2">
                                How it works
                            </h3>
                            <ul className="text-xs text-zinc-400 space-y-1">
                                <li>• Creates an agent job with your command</li>
                                <li>• Spawns a secure PTY (pseudo-terminal) session</li>
                                <li>• Streams output in real-time via WebSocket</li>
                                <li>• Security profile enforces command restrictions</li>
                                <li>• Terminal auto-cleans up after 30 minutes of inactivity</li>
                            </ul>
                        </div>
                    </div>

                    {/* Right Column: Recent Sessions */}
                    <div className="space-y-6">
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
                            <h2 className="text-lg font-semibold mb-4">Recent Terminal Jobs</h2>
                            {recentJobs && recentJobs.length > 0 ? (
                                <div className="space-y-3">
                                    {recentJobs.map((job) => (
                                        <div
                                            key={job._id}
                                            className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/terminal/${job._id}`)}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <code className="text-xs text-cyan-400">
                                                    {job._id.slice(-12)}
                                                </code>
                                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
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
                                            <p className="text-sm text-zinc-300 mb-2 truncate">
                                                {job.instruction}
                                            </p>
                                            <div className="flex items-center justify-between text-xs text-zinc-500">
                                                <span>
                                                    {new Date(job.createdAt).toLocaleString()}
                                                </span>
                                                {job.securityProfile && (
                                                    <span className="px-2 py-0.5 bg-zinc-700 rounded">
                                                        {job.securityProfile}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-zinc-500">
                                    <Terminal className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p className="text-sm">No recent terminal sessions</p>
                                </div>
                            )}
                        </div>

                        {/* Security Warning */}
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                Security Notice
                            </h3>
                            <p className="text-xs text-zinc-400">
                                Terminals run with your system permissions. The agent automatically
                                blocks dangerous commands (rm -rf, sudo, etc.) based on your security
                                profile. Always use the minimum required security level.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
