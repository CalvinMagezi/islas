"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

interface Task {
    id: string;
    description: string;
    status: "pending" | "running" | "completed" | "failed";
    dependencies: string[];
    terminalId?: string;
}

interface TerminalSession {
    sessionId: string;
    status: "starting" | "running" | "exited" | "error";
}

interface TaskDAGVisualizationProps {
    tasks: Task[];
    _sessions: TerminalSession[];
}

export function TaskDAGVisualization({ tasks, _sessions }: TaskDAGVisualizationProps) {
    const mermaidRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Initialize mermaid
        mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            themeVariables: {
                darkMode: true,
                background: "#18181b",
                primaryColor: "#06b6d4",
                primaryTextColor: "#f4f4f5",
                primaryBorderColor: "#3f3f46",
                lineColor: "#52525b",
                secondaryColor: "#27272a",
                tertiaryColor: "#3f3f46",
            },
        });
    }, []);

    useEffect(() => {
        if (!mermaidRef.current || tasks.length === 0) return;

        const renderDiagram = async () => {
            try {
                // Generate Mermaid diagram
                const diagram = generateMermaidDiagram(tasks);

                // Clear previous content safely
                while (mermaidRef.current!.firstChild) {
                    mermaidRef.current!.removeChild(mermaidRef.current!.firstChild);
                }

                // Render new diagram - mermaid.render() returns sanitized SVG
                const { svg } = await mermaid.render("task-dag", diagram);

                // Create SVG element safely using DOMParser (XSS-safe)
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svg, "image/svg+xml");
                const svgElement = svgDoc.documentElement;

                // Append to container
                mermaidRef.current!.appendChild(svgElement);

                setError(null);
            } catch (err: unknown) {
                console.error("Mermaid render error:", err);
                const errorMessage = err instanceof Error ? err.message : "Unknown error";
                setError(errorMessage);
            }
        };

        renderDiagram();
    }, [tasks]);

    if (tasks.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-zinc-500">
                <p className="text-sm">No tasks to visualize</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-300">Task Dependency Graph</h2>
                <p className="text-xs text-zinc-500 mt-1">
                    Visual representation of task execution order
                </p>
            </div>

            {/* Diagram */}
            <div className="flex-1 overflow-auto p-4">
                {error ? (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <p className="text-sm text-red-400 font-medium mb-1">
                            Failed to render diagram
                        </p>
                        <p className="text-xs text-red-300">{error}</p>
                    </div>
                ) : (
                    <div ref={mermaidRef} className="mermaid-diagram" />
                )}
            </div>

            {/* Legend */}
            <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/30">
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="text-zinc-400">Pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-zinc-400">Running</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-zinc-400">Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-zinc-400">Failed</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Generate Mermaid diagram syntax from task list.
 */
function generateMermaidDiagram(tasks: Task[]): string {
    let diagram = "graph TD\n";

    // Add nodes with styling based on status
    for (const task of tasks) {
        const nodeId = sanitizeId(task.id);
        const label = task.description.substring(0, 30); // Truncate long labels
        const statusClass = getStatusClass(task.status);

        diagram += `    ${nodeId}["${label}"]:::${statusClass}\n`;
    }

    // Add edges (dependencies)
    for (const task of tasks) {
        const nodeId = sanitizeId(task.id);
        for (const depId of task.dependencies) {
            const depNodeId = sanitizeId(depId);
            diagram += `    ${depNodeId} --> ${nodeId}\n`;
        }
    }

    // Define status classes
    diagram += `
    classDef pending fill:#713f12,stroke:#ca8a04,stroke-width:2px
    classDef running fill:#14532d,stroke:#22c55e,stroke-width:2px
    classDef completed fill:#1e3a8a,stroke:#3b82f6,stroke-width:2px
    classDef failed fill:#7f1d1d,stroke:#ef4444,stroke-width:2px
`;

    return diagram;
}

/**
 * Sanitize task ID for Mermaid (alphanumeric + underscore only).
 */
function sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Get Mermaid class name based on task status.
 */
function getStatusClass(status: string): string {
    switch (status) {
        case "pending":
            return "pending";
        case "running":
            return "running";
        case "completed":
            return "completed";
        case "failed":
            return "failed";
        default:
            return "pending";
    }
}
