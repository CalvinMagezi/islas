"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api, Id } from "@repo/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Send, Bot, User, Loader2, Wrench, XCircle, Plus, MessageSquare,
  History, ChevronDown, ChevronUp, Shield, Zap, Brain, X,
  CheckCircle2, Clock, AlertTriangle, Compass, Navigation,
  CircleStop, CornerDownRight, Sparkles, Terminal, Wifi, WifiOff, UploadCloud,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { ResponsiveHeader } from "@/components/layout/responsive-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { useAgentWs } from "@/hooks/use-agent-ws";
import { DocumentUpload } from "@/components/chat/DocumentUpload";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const updateMobile = () => setIsMobile(mql.matches);
    updateMobile();
    mql.addEventListener("change", updateMobile);
    return () => mql.removeEventListener("change", updateMobile);
  }, [breakpoint]);
  return isMobile;
}

interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
}

interface ToolExecution {
  id: string;
  name: string;
  status: "running" | "complete" | "error";
  timestamp: number;
}

interface LogEvent {
  type: string;
  assistantMessageEvent?: {
    type: string;
    delta: string;
  };
  toolCall?: {
    name?: string;
    tool?: { name: string };
    arguments?: unknown;
  };
  toolResult?: unknown;
}

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  pending: { color: "text-muted-foreground", icon: Clock, label: "Queued" },
  running: { color: "text-neon-cyan", icon: Loader2, label: "Running" },
  waiting_for_user: { color: "text-neon-amber", icon: MessageSquare, label: "Waiting" },
  done: { color: "text-emerald-400", icon: CheckCircle2, label: "Done" },
  failed: { color: "text-destructive", icon: XCircle, label: "Failed" },
  cancelled: { color: "text-muted-foreground", icon: CircleStop, label: "Cancelled" },
};

const SECURITY_PROFILES = [
  { value: "minimal", label: "Minimal", description: "Read-only access" },
  { value: "standard", label: "Standard", description: "Read + write" },
  { value: "guarded", label: "Guarded", description: "With approval gates" },
  { value: "admin", label: "Admin", description: "Full access" },
] as const;

const THINKING_LEVELS = [
  { value: "off", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Med" },
  { value: "high", label: "High" },
] as const;

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [steerInput, setSteerInput] = useState("");
  const [showSteerInput, setShowSteerInput] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // Advanced job options
  const [securityProfile, setSecurityProfile] = useState<string>("standard");
  const [thinkingLevel, setThinkingLevel] = useState<string>("medium");
  const [priority, setPriority] = useState(50);

  // WebSocket chat state (fast path when agent is connected)
  const [wsMessages, setWsMessages] = useState<Message[]>([]);
  const [wsStreamingText, setWsStreamingText] = useState("");
  const [wsActiveTool, setWsActiveTool] = useState<string | null>(null);
  const [wsError, setWsError] = useState<string | null>(null);

  const agent = useAgentWs({
    onDelta: (text) => setWsStreamingText(text),
    onFinal: (text) => {
      setWsMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "agent", content: text, timestamp: Date.now() },
      ]);
      setWsStreamingText("");
      setWsActiveTool(null);
    },
    onError: (message) => {
      setWsError(message);
      setWsStreamingText("");
      setWsActiveTool(null);
    },
    onToolEvent: (name, status) => {
      setWsActiveTool(status === "start" ? name : null);
    },
  });

  // True when using WebSocket mode (agent connected, no active Convex job selected)
  const isWsMode = agent.connected && !activeJobId;

  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  const createJob = useMutation(api.agent.createJob);
  const sendMessageToJob = useMutation(api.agent.sendMessageToJob);
  const cancelJob = useMutation(api.agent.cancelJob);
  const steerJob = useMutation(api.agent.steerJob);

  const userJobs = useQuery(api.agent.listUserJobs, {});
  const jobLogs = useQuery(
    api.agent.getJobLogs,
    activeJobId ? { jobId: activeJobId as Id<"agentJobs"> } : "skip"
  );
  const currentJob = useQuery(
    api.agent.getJob,
    activeJobId ? { jobId: activeJobId as Id<"agentJobs"> } : "skip"
  );
  const workerStatus = useQuery(api.agent.getWorkerStatus, {});

  const allMessages = useMemo(() => {
    const history = currentJob?.conversationHistory || [];
    const formattedHistory: Message[] = history.map((m, i: number) => ({
      id: `history-${i}-${m.timestamp}`,
      role: m.role as "user" | "agent",
      content: m.content,
      timestamp: m.timestamp,
    }));

    if (currentJob?.streamingText) {
      const lastTimestamp = formattedHistory.length > 0
        ? formattedHistory[formattedHistory.length - 1].timestamp
        : Date.now();

      formattedHistory.push({
        id: "streaming",
        role: "agent",
        content: currentJob.streamingText,
        timestamp: lastTimestamp + 1,
      });
    }

    return formattedHistory.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.id.localeCompare(b.id);
    });
  }, [currentJob]);

  const activeTools = useMemo(() => {
    if (!jobLogs) return [];
    const tools: ToolExecution[] = [];
    jobLogs.forEach((log) => {
      try {
        const event = JSON.parse(log.content) as LogEvent;
        if (log.type === "tool_execution_start") {
          const toolName = event.toolCall?.tool?.name || event.toolCall?.name || "tool";
          tools.push({ id: log._id, name: toolName, status: "running", timestamp: log.timestamp });
        }
        if (log.type === "tool_execution_end") {
          const runningTool = tools.findLast(t => t.status === "running");
          if (runningTool) runningTool.status = "complete";
        }
      } catch { }
    });
    return tools.filter(t => t.status === "running");
  }, [jobLogs]);

  // Build WS display messages (with streaming partial)
  const wsDisplayMessages = useMemo(() => {
    const msgs = [...wsMessages];
    if (wsStreamingText) {
      msgs.push({
        id: "ws-streaming",
        role: "agent",
        content: wsStreamingText,
        timestamp: Date.now(),
      });
    }
    return msgs;
  }, [wsMessages, wsStreamingText]);

  // Pick the right message source based on mode
  const displayMessages = isWsMode ? wsDisplayMessages : allMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, activeTools, wsActiveTool]);

  const handleNewChat = useCallback(() => {
    setActiveJobId(null);
    setInput("");
    setIsSidebarOpen(false);
    setShowSteerInput(false);
    // Clear WS chat state for a fresh conversation
    setWsMessages([]);
    setWsStreamingText("");
    setWsActiveTool(null);
    setWsError(null);
    // Reset the WS session so the LLM starts fresh
    if (agent.connected) {
      agent.reset();
    }
  }, [agent]);

  const handleSelectJob = useCallback((id: string) => {
    setActiveJobId(id);
    setIsSidebarOpen(false);
    setShowSteerInput(false);
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || sendingRef.current) return;
    sendingRef.current = true;

    const text = input.trim();
    setInput("");
    setWsError(null);

    try {
      // If viewing a Convex job that's waiting for user, send to that job
      if (activeJobId && currentJob && currentJob.status === "waiting_for_user") {
        await sendMessageToJob({
          jobId: activeJobId as Id<"agentJobs">,
          message: text,
        });
        return;
      }

      // Fast path: WebSocket mode (agent connected, not viewing a specific job)
      if (isWsMode) {
        // Add user message to local state immediately (optimistic)
        setWsMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", content: text, timestamp: Date.now() },
        ]);
        await agent.send(text);
        return;
      }

      // Fallback: Convex job queue (existing behavior)
      const jobId = await createJob({
        instruction: text,
        type: "interactive",
        initialHistory: currentJob?.conversationHistory || [],
        securityProfile: securityProfile as "minimal" | "standard" | "guarded" | "admin",
        thinkingLevel: thinkingLevel as "off" | "minimal" | "low" | "medium" | "high" | "xhigh",
        priority,
      });

      setActiveJobId(jobId as unknown as string);
    } finally {
      sendingRef.current = false;
    }
  }, [input, createJob, sendMessageToJob, activeJobId, currentJob, securityProfile, thinkingLevel, priority, isWsMode, agent]);

  const handleCancel = useCallback(async () => {
    if (!activeJobId) return;
    await cancelJob({ jobId: activeJobId as Id<"agentJobs"> });
  }, [activeJobId, cancelJob]);

  const handleSteer = useCallback(async () => {
    if (!activeJobId || !steerInput.trim()) return;
    await steerJob({ jobId: activeJobId as Id<"agentJobs">, message: steerInput.trim() });
    setSteerInput("");
    setShowSteerInput(false);
  }, [activeJobId, steerInput, steerJob]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isJobThinking = activeJobId && currentJob &&
    (currentJob.status === "pending" || currentJob.status === "running");
  const isThinking = isWsMode ? agent.busy : isJobThinking;
  const isFailed = isWsMode ? !!wsError : currentJob?.status === "failed";
  const isWaitingForUser = currentJob?.status === "waiting_for_user";
  const isActive = isThinking || isWaitingForUser || (isWsMode && agent.busy);
  const isDone = currentJob?.status === "done";

  // Job sidebar with rich status
  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <h2 className="font-display text-xs font-bold tracking-wider uppercase text-muted-foreground">History</h2>
        <Button variant="ghost" size="icon" onClick={handleNewChat} title="New Chat" className="h-7 w-7">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
        {userJobs?.map((job) => {
          const status = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
          const StatusIcon = status.icon;
          const isSelected = activeJobId === job._id;

          return (
            <button
              key={job._id}
              onClick={() => handleSelectJob(job._id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all group relative",
                isSelected
                  ? "bg-primary/8 border border-primary/15"
                  : "hover:bg-muted/40 border border-transparent"
              )}
            >
              <div className="flex items-start gap-2.5">
                <StatusIcon className={cn(
                  "h-3.5 w-3.5 shrink-0 mt-0.5",
                  status.color,
                  job.status === "running" && "animate-spin"
                )} />
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "truncate text-[13px] leading-snug",
                    isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                  )}>
                    {job.instruction}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground/50 font-display">
                      {formatTimeAgo(job.createdAt)}
                    </span>
                    {job.stats && (
                      <span className="text-[10px] text-muted-foreground/40 font-display">
                        {formatCost(job.stats.cost)}
                      </span>
                    )}
                    {job.securityProfile && job.securityProfile !== "standard" && (
                      <span className={cn(
                        "text-[9px] font-display uppercase tracking-wider px-1 py-0.5 rounded",
                        job.securityProfile === "admin" ? "bg-destructive/10 text-destructive" :
                          job.securityProfile === "minimal" ? "bg-blue-500/10 text-blue-400" :
                            "bg-amber-500/10 text-amber-400"
                      )}>
                        {job.securityProfile}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
        {(!userJobs || userJobs.length === 0) && (
          <div className="flex flex-col items-center py-12 gap-2">
            <Terminal className="h-6 w-6 text-muted-foreground/20" />
            <p className="text-[11px] text-muted-foreground/40 font-display">No jobs yet</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden flex-col">
      <ResponsiveHeader
        notificationPanelOpen={notificationPanelOpen}
        onToggleNotificationPanel={() => setNotificationPanelOpen(!notificationPanelOpen)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <aside className={cn(
            "flex flex-col border-r border-border/50 transition-all duration-300 bg-sidebar/30",
            isSidebarOpen ? "w-72" : "w-0 overflow-hidden border-none"
          )}>
            {SidebarContent}
          </aside>
        )}

        {/* Mobile Sidebar (Sheet) */}
        {isMobile && (
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetContent side="left" className="w-72 p-0 flex flex-col" showCloseButton={false}>
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              {SidebarContent}
            </SheetContent>
          </Sheet>
        )}

        {/* Main Content Area */}
        <main className="flex flex-1 flex-col relative overflow-hidden bg-dot-pattern">
          {/* Header Action Bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-background/60 backdrop-blur-sm sticky top-0 z-10">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="h-8 gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <History className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">History</span>
            </Button>

            <div className="h-4 w-px bg-border/40 mx-0.5" />

            {/* Connection status pill */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* WebSocket indicator (primary) */}
              <div className="relative flex items-center justify-center">
                <span className={cn(
                  "h-2 w-2 rounded-full",
                  agent.connected ? (agent.busy ? "bg-amber-400" : "bg-emerald-400") :
                    workerStatus?.status === "online" ? "bg-emerald-400/50" :
                      "bg-muted-foreground/30"
                )} />
                {agent.connected && !agent.busy && (
                  <span className="absolute h-2 w-2 rounded-full bg-emerald-400 animate-heartbeat-ring" />
                )}
              </div>
              <span className="text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground/60 truncate">
                {agent.connected
                  ? (agent.busy ? "Thinking" : "Connected")
                  : workerStatus?.status === "online"
                    ? workerStatus?.metadata?.folderName || "Online"
                    : "Offline"}
              </span>
              {agent.connected && (
                <Wifi className="h-3 w-3 text-emerald-400/60" />
              )}
              {!agent.connected && (
                <WifiOff className="h-3 w-3 text-muted-foreground/30" />
              )}
            </div>

            {/* Active controls */}
            {isActive && (
              <div className="flex items-center gap-1.5">
                {/* Steer / Cancel only for Convex jobs */}
                {!isWsMode && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSteerInput(!showSteerInput)}
                      className="h-7 text-[10px] font-display uppercase tracking-wider gap-1 text-muted-foreground hover:text-neon-amber"
                      title="Send steering message"
                    >
                      <Navigation className="h-3 w-3" />
                      <span className="hidden sm:inline">Steer</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancel}
                      className="h-7 text-[10px] font-display uppercase tracking-wider gap-1 text-muted-foreground hover:text-destructive"
                      title="Cancel job"
                    >
                      <CircleStop className="h-3 w-3" />
                      <span className="hidden sm:inline">Cancel</span>
                    </Button>
                  </>
                )}
                {/* Abort for WS mode */}
                {isWsMode && agent.busy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => agent.abort()}
                    className="h-7 text-[10px] font-display uppercase tracking-wider gap-1 text-muted-foreground hover:text-destructive"
                    title="Abort current response"
                  >
                    <CircleStop className="h-3 w-3" />
                    <span className="hidden sm:inline">Abort</span>
                  </Button>
                )}
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
              className="h-8 text-[10px] font-display uppercase tracking-wider font-bold gap-1.5 text-muted-foreground/50 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </div>

          {/* Steering input bar */}
          {showSteerInput && isActive && (
            <div className="flex items-center gap-2 px-4 py-2 bg-neon-amber/5 border-b border-neon-amber/20 animate-float-up">
              <Navigation className="h-3.5 w-3.5 text-neon-amber shrink-0" />
              <input
                type="text"
                value={steerInput}
                onChange={(e) => setSteerInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSteer(); }}
                placeholder="Send course correction to running job..."
                className="flex-1 bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none font-display text-xs"
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleSteer}
                disabled={!steerInput.trim()}
                className="h-7 text-[10px] font-display uppercase tracking-wider bg-neon-amber/20 text-neon-amber hover:bg-neon-amber/30 border-0"
              >
                Send
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => setShowSteerInput(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth scrollbar-thin">
            <div className="mx-auto max-w-3xl space-y-6">
              {/* Empty State */}
              {displayMessages.length === 0 && !isThinking && (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-700">
                  <div className="relative mb-8">
                    <div className="p-5 rounded-3xl bg-primary/5 border border-primary/10 animate-glow-breathe">
                      <Sparkles className="h-12 w-12 text-primary/40" />
                    </div>
                  </div>

                  <h2 className="mb-2 text-xl font-bold tracking-tight text-foreground">
                    What should HQ work on?
                  </h2>
                  <p className="max-w-sm text-sm text-muted-foreground/60 leading-relaxed mb-8">
                    Your local agent can execute commands, edit files, search notes, and manage projects.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                    {[
                      { text: "What are my active projects?", icon: Compass },
                      { text: "Help me refactor this component", icon: Wrench },
                      { text: "Search my notes for API docs", icon: Brain },
                      { text: "Create a new landing page", icon: Sparkles },
                    ].map(({ text, icon: Icon }) => (
                      <button
                        key={text}
                        className="flex items-center gap-3 text-left text-[13px] py-3 px-4 rounded-xl border border-border/50 bg-card/50 hover:bg-primary/5 hover:border-primary/20 hover:text-primary transition-all group"
                        onClick={() => { setInput(text); }}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                        <span>{text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {displayMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3.5 animate-in fade-in slide-in-from-bottom-2 duration-400",
                    message.role === "user" ? "flex-row-reverse" : ""
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-raised border border-border/50"
                    )}
                  >
                    {message.role === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>

                  <Card
                    className={cn(
                      "max-w-[85%] px-4 py-3.5 shadow-sm transition-all",
                      message.role === "user"
                        ? "bg-primary/6 border-primary/15"
                        : "bg-card/60 backdrop-blur-sm border-border/40"
                    )}
                  >
                    {message.role === "agent" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted/80 prose-pre:p-3.5 prose-pre:rounded-lg prose-pre:border prose-pre:border-border/40 prose-code:font-mono prose-code:text-[13px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                        {(message.id === "streaming" || message.id === "ws-streaming") && (
                          <span className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 -mb-0.5 animate-cursor-blink rounded-sm" />
                        )}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed font-medium">
                        {message.content}
                      </div>
                    )}
                  </Card>
                </div>
              ))}

              {/* Tool activity (Convex jobs) */}
              {!isWsMode && activeTools.map((tool) => (
                <div key={tool.id} className="flex gap-3.5 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/5 border border-primary/10">
                    <Wrench className="h-4 w-4 text-primary/50" />
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/40 bg-muted/15 px-4 py-2.5 text-xs backdrop-blur-sm">
                    <Loader2 className="h-3 w-3 animate-spin text-primary/60" />
                    <span className="font-display text-[11px] tracking-wide text-muted-foreground">
                      <span className="text-foreground/80 font-bold">{tool.name}</span>
                    </span>
                  </div>
                </div>
              ))}

              {/* Tool activity (WebSocket) */}
              {isWsMode && wsActiveTool && (
                <div className="flex gap-3.5 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/5 border border-primary/10">
                    <Wrench className="h-4 w-4 text-primary/50" />
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/40 bg-muted/15 px-4 py-2.5 text-xs backdrop-blur-sm">
                    <Loader2 className="h-3 w-3 animate-spin text-primary/60" />
                    <span className="font-display text-[11px] tracking-wide text-muted-foreground">
                      <span className="text-foreground/80 font-bold">{wsActiveTool}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Thinking indicator */}
              {isThinking && !wsStreamingText && !wsActiveTool && activeTools.length === 0 && (
                <div className="flex gap-3.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/8 border border-primary/15">
                    <Bot className="h-4 w-4 text-primary/60" />
                  </div>
                  <div className="flex items-center gap-2 py-2">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-typing-dot" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-typing-dot" style={{ animationDelay: "0.2s" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-typing-dot" style={{ animationDelay: "0.4s" }} />
                    </div>
                    <span className="text-[11px] font-display text-muted-foreground/50 tracking-wide ml-1">
                      {isWsMode ? "THINKING" : currentJob?.status === "pending" ? "QUEUED" : "THINKING"}
                    </span>
                  </div>
                </div>
              )}

              {/* Failed state */}
              {isFailed && (
                <div className="flex gap-3.5 animate-in fade-in">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex flex-col gap-2.5 flex-1">
                    <div className="rounded-xl border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive/80">
                      {isWsMode && wsError
                        ? wsError
                        : "Task failed. The agent encountered an error."}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit h-8 rounded-lg px-3 border-destructive/20 hover:bg-destructive/8 text-xs font-display uppercase tracking-wider"
                      onClick={() => {
                        setWsError(null);
                        if (input || currentJob?.instruction) handleSend();
                      }}
                    >
                      <CornerDownRight className="h-3 w-3 mr-1.5" />
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              {/* Done state with stats */}
              {isDone && currentJob?.stats && (
                <div className="flex gap-3.5 animate-in fade-in">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/15">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="glass rounded-xl px-4 py-3 animate-scale-in">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-display text-muted-foreground/60">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {currentJob.stats.tokens.total.toLocaleString()} tokens
                      </span>
                      <span className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        {currentJob.stats.toolCalls} tools
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-emerald-400">{formatCost(currentJob.stats.cost)}</span>
                      </span>
                      {currentJob.createdAt && currentJob.updatedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(currentJob.updatedAt - currentJob.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-8" />
            </div>
          </div>

          {/* Input Interface */}
          <div className="border-t border-border/40 bg-background/70 backdrop-blur-md">
            {/* Advanced Options Panel */}
            {showAdvanced && (
              <div className="px-4 py-3 border-b border-border/30 animate-float-up">
                <div className="mx-auto max-w-3xl flex flex-wrap items-center gap-4">
                  {/* Security Profile */}
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <div className="flex gap-0.5 bg-muted/30 rounded-lg p-0.5">
                      {SECURITY_PROFILES.map((sp) => (
                        <button
                          key={sp.value}
                          onClick={() => setSecurityProfile(sp.value)}
                          title={sp.description}
                          className={cn(
                            "px-2.5 py-1 text-[10px] font-display uppercase tracking-wider rounded-md transition-all",
                            securityProfile === sp.value
                              ? "bg-primary/15 text-primary font-bold"
                              : "text-muted-foreground/50 hover:text-muted-foreground"
                          )}
                        >
                          {sp.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Thinking Level */}
                  <div className="flex items-center gap-2">
                    <Brain className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <div className="flex gap-0.5 bg-muted/30 rounded-lg p-0.5">
                      {THINKING_LEVELS.map((tl) => (
                        <button
                          key={tl.value}
                          onClick={() => setThinkingLevel(tl.value)}
                          className={cn(
                            "px-2.5 py-1 text-[10px] font-display uppercase tracking-wider rounded-md transition-all",
                            thinkingLevel === tl.value
                              ? "bg-neon-purple/15 text-neon-purple font-bold"
                              : "text-muted-foreground/50 hover:text-muted-foreground"
                          )}
                        >
                          {tl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <span className="text-[10px] font-display text-muted-foreground/50 uppercase tracking-wider">P{priority}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={priority}
                      onChange={(e) => setPriority(Number(e.target.value))}
                      className="w-20 h-1 accent-primary"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Input row */}
            <div className="p-4 pb-6 md:pb-4">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="mx-auto flex max-w-3xl gap-2.5 items-end"
              >
                {/* Toggle Advanced */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className={cn(
                    "h-[48px] w-[48px] rounded-xl shrink-0 transition-all",
                    showAdvanced ? "bg-primary/10 text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
                  )}
                  title="Job options"
                >
                  {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>

                <div className="flex-1 relative group">
                  {showUpload && <DocumentUpload onClose={() => setShowUpload(false)} />}
                  <div className="absolute left-1.5 top-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowUpload(!showUpload)}
                      className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Upload Financial Document"
                    >
                      <UploadCloud className="w-4.5 h-4.5" />
                    </Button>
                  </div>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isWaitingForUser ? "Reply to HQ..." : agent.connected ? "Chat with HQ..." : "Message HQ..."}
                    className="min-h-[48px] pl-12 pr-14 bg-surface-raised border-border/30 group-focus-within:border-primary/30 group-focus-within:bg-background transition-all rounded-xl text-sm"
                    autoFocus
                  />
                  <div className="absolute right-3.5 bottom-3.5 flex items-center gap-2">
                    {isWaitingForUser && (
                      <span className="text-[9px] font-display text-neon-amber uppercase tracking-widest animate-neon-pulse">
                        Awaiting reply
                      </span>
                    )}
                    <span className="text-[10px] font-display text-muted-foreground/20 hidden sm:block tracking-widest">
                      Enter
                    </span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={!input.trim() || agent.busy || !!(isJobThinking && currentJob?.status !== "waiting_for_user")}
                  size="icon"
                  className="h-[48px] w-[48px] rounded-xl shadow-md transition-all active:scale-95 shrink-0 bg-primary hover:bg-primary/90"
                >
                  <Send className="h-4.5 w-4.5" />
                </Button>
              </form>
            </div>
          </div>
        </main>

        {/* Notifications Sidebar */}
        {notificationPanelOpen && (
          <aside className="w-80 border-l border-border/50 bg-sidebar/50 backdrop-blur-xl animate-slide-in-right z-20">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">Notifications</h2>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setNotificationPanelOpen(false)}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
            <NotificationPanel />
          </aside>
        )}
      </div>

      {/* Navigation & Overlays */}
      <MobileBottomNav
        _onToggleHistory={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenSettings={() => setSettingsOpen(true)}
        _isHistoryOpen={isSidebarOpen}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
