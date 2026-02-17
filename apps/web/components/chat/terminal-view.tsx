"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Id } from "@repo/convex";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { Terminal as TerminalIcon, AlertCircle, Wifi, WifiOff } from "lucide-react";

interface TerminalViewProps {
    jobId: Id<"agentJobs"> | null;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export function TerminalView({ jobId }: TerminalViewProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const commandExecutedRef = useRef<boolean>(false);

    const [status, setStatus] = useState<ConnectionStatus>("disconnected");
    const [error, setError] = useState<string | null>(null);

    const createTerminalToken = useMutation(api.agent.createTerminalToken);
    const job = useQuery(api.agent.getJob, { jobId: jobId || undefined });

    // Initialize xterm.js
    useEffect(() => {
        if (!terminalRef.current || !jobId) return;

        // Create terminal instance
        const terminal = new Terminal({
            cursorBlink: true,
            fontSize: 13,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            theme: {
                background: "#0a0a0a",
                foreground: "#d4d4d8",
                cursor: "#22d3ee",
                selectionBackground: "#334155",
                black: "#18181b",
                red: "#ef4444",
                green: "#22c55e",
                yellow: "#eab308",
                blue: "#3b82f6",
                magenta: "#a855f7",
                cyan: "#22d3ee",
                white: "#f4f4f5",
                brightBlack: "#52525b",
                brightRed: "#f87171",
                brightGreen: "#4ade80",
                brightYellow: "#facc15",
                brightBlue: "#60a5fa",
                brightMagenta: "#c084fc",
                brightCyan: "#67e8f9",
                brightWhite: "#fafafa",
            },
            cols: 80,
            rows: 24,
        });

        // Add addons
        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(new WebLinksAddon());

        // Mount terminal
        terminal.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = terminal;
        fitAddonRef.current = fitAddon;

        // Setup resize observer for auto-fitting
        const observer = new ResizeObserver(() => {
            if (fitAddonRef.current && xtermRef.current) {
                try {
                    fitAddonRef.current.fit();
                } catch (_err) {
                    // Ignore resize errors during unmount
                }
            }
        });

        if (terminalRef.current) {
            observer.observe(terminalRef.current);
            resizeObserverRef.current = observer;
        }

        // Welcome message
        terminal.writeln("\x1b[1;36m╔════════════════════════════════════════════════════════╗\x1b[0m");
        terminal.writeln("\x1b[1;36m║              Islas Terminal (xterm.js)                 ║\x1b[0m");
        terminal.writeln("\x1b[1;36m╚════════════════════════════════════════════════════════╝\x1b[0m");
        terminal.writeln("");
        terminal.writeln("\x1b[33mConnecting to agent...\x1b[0m");
        terminal.writeln("");

        // Cleanup
        return () => {
            if (resizeObserverRef.current) {
                resizeObserverRef.current.disconnect();
            }
            terminal.dispose();
            xtermRef.current = null;
            fitAddonRef.current = null;
        };
    }, [jobId]);

    // Auto-connect on mount and when jobId/status changes
    useEffect(() => {
        if (!jobId || !xtermRef.current || status !== "disconnected") return;

        let isMounted = true;
        const connectTerminal = async () => {
            setStatus("connecting");
            setError(null);

            try {
                // 1. Request terminal token from Convex
                const { token } = await createTerminalToken({ jobId });
                if (!isMounted) return;

                // 2. Connect to agent WebSocket
                const wsUrl = `ws://localhost:5678?token=${token}`;
                const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setStatus("connected");
                if (xtermRef.current) {
                    xtermRef.current.writeln("\x1b[32m✓\x1b[0m Connected to Islas Agent");
                    xtermRef.current.writeln("");
                }

                // Request terminal creation
                const reqId = Math.random().toString(36).substring(7);
                ws.send(
                    JSON.stringify({
                        type: "req",
                        id: reqId,
                        method: "terminal.create",
                        params: {
                            jobId,
                            rows: xtermRef.current?.rows,
                            cols: xtermRef.current?.cols,
                        },
                    })
                );
            };

            ws.onmessage = (event) => {
                if (!xtermRef.current) return;

                // Binary frame: PTY output
                if (event.data instanceof Blob) {
                    event.data.arrayBuffer().then((buffer) => {
                        const data = new Uint8Array(buffer);
                        if (data.length < 36) return;
                        // Extract sessionId (first 36 bytes) and PTY output
                        const sessionId = new TextDecoder().decode(data.slice(0, 36));
                        const ptyOutput = new TextDecoder().decode(data.slice(36));

                        // Store sessionId on first PTY output
                        if (!sessionIdRef.current) {
                            sessionIdRef.current = sessionId;
                        }

                        // Write to terminal
                        if (xtermRef.current) {
                            xtermRef.current.write(ptyOutput);

                            // Auto-execute job instruction if present (once)
                            if (!commandExecutedRef.current && job && sessionIdRef.current) {
                                // Remove [TERMINAL] prefix if present
                                const instruction = job.instruction.replace("[TERMINAL] ", "").trim();

                                // Only auto-execute if it looks like a shell command
                                // (not empty and doesn't look like a natural language instruction)
                                if (
                                    instruction &&
                                    instruction.length < 200 &&
                                    !instruction.toLowerCase().startsWith("please") &&
                                    !instruction.toLowerCase().startsWith("can you")
                                ) {
                                    // Wait for shell prompt before executing
                                    // (Check if output contains common prompt patterns)
                                    if (
                                        ptyOutput.includes("$") ||
                                        ptyOutput.includes("#") ||
                                        ptyOutput.includes(">")
                                    ) {
                                        setTimeout(() => {
                                            if (ws.readyState === WebSocket.OPEN && sessionIdRef.current) {
                                                // Send command
                                                const command = instruction + "\n";
                                                const sessionIdBytes = new TextEncoder().encode(
                                                    sessionIdRef.current
                                                );
                                                const inputBytes = new TextEncoder().encode(command);
                                                const frame = new Uint8Array(
                                                    sessionIdBytes.length + inputBytes.length
                                                );
                                                frame.set(sessionIdBytes, 0);
                                                frame.set(inputBytes, sessionIdBytes.length);
                                                ws.send(frame.buffer);

                                                commandExecutedRef.current = true;
                                            }
                                        }, 500); // Small delay to ensure shell is ready
                                    }
                                }
                            }
                        }
                    });
                    return;
                }

                // Text frame: JSON-RPC
                try {
                    const msg = JSON.parse(event.data);

                    // Handle terminal.created event
                    if (msg.type === "event" && msg.event === "terminal.created") {
                        sessionIdRef.current = msg.payload.sessionId;
                    }

                    // Handle terminal.exit event
                    if (msg.type === "event" && msg.event === "terminal.exit") {
                        if (xtermRef.current) {
                            const exitCode = msg.payload.exitCode;
                            const color = exitCode === 0 ? "32" : "31";
                            xtermRef.current.writeln("");
                            xtermRef.current.writeln(
                                `\x1b[${color}m[Process exited with code ${exitCode}]\x1b[0m`
                            );
                        }
                    }
                } catch (_err) {
                    // Not JSON, ignore
                }
            };

            ws.onerror = (event) => {
                console.error("WebSocket error:", event);
                setStatus("error");
                setError("Connection error");
                if (xtermRef.current) {
                    xtermRef.current.writeln("\x1b[31m✗\x1b[0m Connection error");
                }
            };

            ws.onclose = () => {
                setStatus("disconnected");
                if (xtermRef.current) {
                    xtermRef.current.writeln("");
                    xtermRef.current.writeln("\x1b[33mDisconnected from agent\x1b[0m");
                }
            };

            // Handle terminal input
            if (xtermRef.current) {
                xtermRef.current.onData((data) => {
                    if (ws.readyState === WebSocket.OPEN && sessionIdRef.current) {
                        // Send as binary frame: [36-byte sessionId][input data]
                        const sessionIdBytes = new TextEncoder().encode(sessionIdRef.current);
                        const inputBytes = new TextEncoder().encode(data);
                        const frame = new Uint8Array(sessionIdBytes.length + inputBytes.length);
                        frame.set(sessionIdBytes, 0);
                        frame.set(inputBytes, sessionIdBytes.length);
                        ws.send(frame.buffer);
                    }
                });

                // Handle terminal resize
                xtermRef.current.onResize(({ rows, cols }) => {
                if (ws.readyState === WebSocket.OPEN && sessionIdRef.current) {
                    ws.send(
                        JSON.stringify({
                            type: "req",
                            id: Math.random().toString(36).substring(7),
                            method: "terminal.resize",
                            params: {
                                sessionId: sessionIdRef.current,
                                rows,
                                cols,
                            },
                        })
                    );
                }
            });
            }
        } catch (err: unknown) {
                if (!isMounted) return;
                console.error("Failed to connect terminal:", err);
                setStatus("error");
                const errorMessage = err instanceof Error ? err.message : "Unknown error";
                setError(errorMessage);
                if (xtermRef.current) {
                    xtermRef.current.writeln(`\x1b[31m✗\x1b[0m Failed to connect: ${errorMessage}`);
                }
            }
        };

        connectTerminal();

        return () => {
            isMounted = false;
        };
    }, [jobId, status, createTerminalToken]);

    // Cleanup WebSocket on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                // Send terminal.kill before closing
                if (sessionIdRef.current) {
                    wsRef.current.send(
                        JSON.stringify({
                            type: "req",
                            id: Math.random().toString(36).substring(7),
                            method: "terminal.kill",
                            params: { sessionId: sessionIdRef.current },
                        })
                    );
                }
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    if (!jobId) return null;

    return (
        <div className="flex flex-col h-full bg-black/90 rounded-lg border border-zinc-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                    <TerminalIcon className="h-4 w-4 text-cyan-500" />
                    <span className="font-semibold text-zinc-100 text-sm">Islas Terminal</span>
                </div>
                <div className="flex items-center gap-2">
                    {status === "connected" && (
                        <>
                            <Wifi className="h-3 w-3 text-green-500" />
                            <span className="text-[10px] uppercase tracking-wider text-green-500">
                                Connected
                            </span>
                        </>
                    )}
                    {status === "connecting" && (
                        <>
                            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                            <span className="text-[10px] uppercase tracking-wider text-yellow-500">
                                Connecting
                            </span>
                        </>
                    )}
                    {status === "error" && (
                        <>
                            <AlertCircle className="h-3 w-3 text-red-500" />
                            <span className="text-[10px] uppercase tracking-wider text-red-500">Error</span>
                        </>
                    )}
                    {status === "disconnected" && (
                        <>
                            <WifiOff className="h-3 w-3 text-zinc-600" />
                            <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                                Disconnected
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Terminal */}
            <div ref={terminalRef} className="flex-1 overflow-hidden p-2" />

            {/* Error Display */}
            {error && (
                <div className="px-3 py-2 bg-red-500/10 border-t border-red-500/30">
                    <p className="text-xs text-red-400">{error}</p>
                </div>
            )}
        </div>
    );
}
