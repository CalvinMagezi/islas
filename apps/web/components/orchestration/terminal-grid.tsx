"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal as TerminalIcon, Maximize2, Minimize2 } from "lucide-react";
import { Id } from "@repo/convex";
import type { Terminal } from "@xterm/xterm";

interface Task {
    id: string;
    description: string;
    status: "pending" | "running" | "completed" | "failed";
    terminalId?: string;
}

interface TerminalSession {
    sessionId: string;
    status: "starting" | "running" | "exited" | "error";
    exitCode?: number;
}

interface TerminalGridProps {
    _jobId: Id<"agentJobs">;
    tasks: Task[];
    sessions: TerminalSession[];
}

export function TerminalGrid({ _jobId, tasks, sessions }: TerminalGridProps) {
    const [fullscreenTerminal, setFullscreenTerminal] = useState<string | null>(null);

    // Auto-select grid size based on task count
    const autoGridSize: "2x2" | "3x3" | "4x4" =
        tasks.length <= 4 ? "2x2" :
        tasks.length <= 9 ? "3x3" :
        "4x4";

    const [gridSize, setGridSize] = useState<"2x2" | "3x3" | "4x4">(autoGridSize);

    // Filter tasks that have terminals
    const tasksWithTerminals = tasks.filter((t) => t.terminalId);

    const gridClasses = {
        "2x2": "grid-cols-2 grid-rows-2",
        "3x3": "grid-cols-3 grid-rows-3",
        "4x4": "grid-cols-4 grid-rows-4",
    };

    if (fullscreenTerminal) {
        const task = tasks.find((t) => t.terminalId === fullscreenTerminal);
        return (
            <div className="h-full flex flex-col bg-zinc-950">
                <FullscreenTerminal
                    task={task!}
                    _session={sessions.find((s) => s.sessionId === fullscreenTerminal)}
                    onClose={() => setFullscreenTerminal(null)}
                />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Grid Controls */}
            <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                    {tasksWithTerminals.length} Active Terminal{tasksWithTerminals.length !== 1 ? "s" : ""}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Grid:</span>
                    {(["2x2", "3x3", "4x4"] as const).map((size) => (
                        <button
                            key={size}
                            onClick={() => setGridSize(size)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                                gridSize === size
                                    ? "bg-cyan-500 text-white"
                                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                            }`}
                        >
                            {size}
                        </button>
                    ))}
                </div>
            </div>

            {/* Terminal Grid */}
            <div className={`flex-1 grid ${gridClasses[gridSize]} gap-2 p-2 bg-zinc-950 overflow-hidden`}>
                {tasksWithTerminals.length > 0 ? (
                    tasksWithTerminals.map((task) => {
                        const session = sessions.find((s) => s.sessionId === task.terminalId);
                        return (
                            <TerminalCell
                                key={task.id}
                                task={task}
                                _session={session}
                                onFullscreen={() => setFullscreenTerminal(task.terminalId!)}
                            />
                        );
                    })
                ) : (
                    <div className="col-span-full flex items-center justify-center text-zinc-500">
                        <div className="text-center">
                            <TerminalIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No terminals running yet</p>
                            <p className="text-xs mt-1">Terminals will appear as tasks start executing</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function TerminalCell({
    task,
    _session,
    onFullscreen,
}: {
    task: Task;
    _session?: TerminalSession;
    onFullscreen: () => void;
}) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<{ term: Terminal; fitAddon: any } | null>(null);
    const [wsConnected, setWsConnected] = useState(false);

    useEffect(() => {
        if (!terminalRef.current || !task.terminalId) return;

        // Lazy load xterm
        import("@xterm/xterm").then(({ Terminal }) => {
            import("@xterm/addon-fit").then(({ FitAddon }) => {
                const term = new Terminal({
                    cursorBlink: true,
                    fontSize: 11, // Smaller for grid view
                    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
                    theme: {
                        background: "#09090b",
                        foreground: "#f4f4f5",
                        cursor: "#06b6d4",
                        black: "#18181b",
                        red: "#ef4444",
                        green: "#22c55e",
                        yellow: "#eab308",
                        blue: "#3b82f6",
                        magenta: "#a855f7",
                        cyan: "#06b6d4",
                        white: "#f4f4f5",
                        brightBlack: "#52525b",
                        brightRed: "#f87171",
                        brightGreen: "#4ade80",
                        brightYellow: "#facc15",
                        brightBlue: "#60a5fa",
                        brightMagenta: "#c084fc",
                        brightCyan: "#22d3ee",
                        brightWhite: "#fafafa",
                    },
                    scrollback: 1000,
                    convertEol: true,
                });

                const fitAddon = new FitAddon();
                term.loadAddon(fitAddon);

                term.open(terminalRef.current!);
                fitAddon.fit();

                xtermRef.current = { term, fitAddon };

                // Connect WebSocket to agent
                connectTerminalWebSocket(task.terminalId!, term, setWsConnected);

                // Auto-resize on container changes
                const resizeObserver = new ResizeObserver(() => {
                    fitAddon.fit();
                });
                resizeObserver.observe(terminalRef.current!);

                return () => {
                    resizeObserver.disconnect();
                    term.dispose();
                };
            });
        });
    }, [task.terminalId]);

    const statusColor = {
        pending: "border-yellow-500/30",
        running: "border-green-500/30",
        completed: "border-blue-500/30",
        failed: "border-red-500/30",
    };

    return (
        <div
            className={`relative bg-zinc-900 border-2 ${statusColor[task.status]} rounded-lg overflow-hidden flex flex-col`}
        >
            {/* Terminal Header */}
            <div className="px-2 py-1 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <TerminalIcon className="h-3 w-3 text-cyan-500 flex-shrink-0" />
                    <span className="text-xs font-medium text-zinc-300 truncate">
                        {task.id}
                    </span>
                    {wsConnected && (
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                    )}
                </div>
                <button
                    onClick={onFullscreen}
                    className="p-1 hover:bg-zinc-800 rounded transition-colors flex-shrink-0"
                    title="Fullscreen"
                >
                    <Maximize2 className="h-3 w-3 text-zinc-500" />
                </button>
            </div>

            {/* Terminal Content */}
            <div ref={terminalRef} className="flex-1 overflow-hidden" />
        </div>
    );
}

function FullscreenTerminal({
    task,
    _session,
    onClose,
}: {
    task: Task;
    _session?: TerminalSession;
    onClose: () => void;
}) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const [wsConnected, setWsConnected] = useState(false);

    useEffect(() => {
        if (!terminalRef.current || !task.terminalId) return;

        import("@xterm/xterm").then(({ Terminal }) => {
            import("@xterm/addon-fit").then(({ FitAddon }) => {
                const term = new Terminal({
                    cursorBlink: true,
                    fontSize: 14,
                    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
                    theme: {
                        background: "#09090b",
                        foreground: "#f4f4f5",
                        cursor: "#06b6d4",
                    },
                });

                const fitAddon = new FitAddon();
                term.loadAddon(fitAddon);
                term.open(terminalRef.current!);
                fitAddon.fit();

                connectTerminalWebSocket(task.terminalId!, term, setWsConnected);

                const resizeObserver = new ResizeObserver(() => fitAddon.fit());
                resizeObserver.observe(terminalRef.current!);

                return () => {
                    resizeObserver.disconnect();
                    term.dispose();
                };
            });
        });
    }, [task.terminalId]);

    return (
        <>
            <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <TerminalIcon className="h-4 w-4 text-cyan-500" />
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-100">{task.id}</h3>
                        <p className="text-xs text-zinc-500">{task.description}</p>
                    </div>
                    {wsConnected && (
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    )}
                </div>
                <button
                    onClick={onClose}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors flex items-center gap-2"
                >
                    <Minimize2 className="h-3 w-3" />
                    Exit Fullscreen
                </button>
            </div>
            <div ref={terminalRef} className="flex-1" />
        </>
    );
}

/**
 * Connect xterm.js to the agent's WebSocket server.
 */
function connectTerminalWebSocket(
    sessionId: string,
    term: Terminal,
    setConnected: (connected: boolean) => void
) {
    const ws = new WebSocket("ws://localhost:5678");

    ws.onopen = () => {
        setConnected(true);
        term.writeln("\x1b[36m✓ Connected to Islas Agent\x1b[0m");
    };

    ws.onmessage = (event) => {
        if (event.data instanceof Blob) {
            event.data.arrayBuffer().then((buffer) => {
                const data = new Uint8Array(buffer);
                if (data.length < 36) return;

                const msgSessionId = new TextDecoder().decode(data.slice(0, 36));
                if (msgSessionId === sessionId) {
                    const ptyData = new TextDecoder().decode(data.slice(36));
                    term.write(ptyData);
                }
            });
        }
    };

    ws.onerror = () => {
        setConnected(false);
        term.writeln("\x1b[31m✗ Connection error\x1b[0m");
    };

    ws.onclose = () => {
        setConnected(false);
        term.writeln("\x1b[33m✗ Disconnected from agent\x1b[0m");
    };

    // Send input to PTY
    term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
            const sessionIdBuffer = new TextEncoder().encode(sessionId);
            const dataBuffer = new TextEncoder().encode(data);
            const combined = new Uint8Array(sessionIdBuffer.length + dataBuffer.length);
            combined.set(sessionIdBuffer, 0);
            combined.set(dataBuffer, sessionIdBuffer.length);
            ws.send(combined);
        }
    });
}
