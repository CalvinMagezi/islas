"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useMutation } from "convex/react";
import { ResponsiveHeader } from "@/components/layout/responsive-header";
import { ThreadSidebar } from "./thread-sidebar";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { ChatActionContext } from "@/hooks/use-chat-action";
import { useThread } from "@/hooks/use-thread";
import { api } from "@repo/convex";
import { optimisticallySendMessage } from "@convex-dev/agent/react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sparkles } from "lucide-react";
import appIcon from "@/app/icon.png";
// NewspaperSidebar removed - consolidated into notebooks

import { NotificationPanel } from "@/components/notifications/notification-panel";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ResourceSidebar } from "@/components/chat/resource-sidebar";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    // Avoid immediate setState by wrapping in a timer or checking matches conditionally
    // But setting it once on mount is generally okay for hydration if we don't care about SSR mismatch
    // For Next.js, we should handle this carefully.
    const updateMobile = () => setIsMobile(mql.matches);
    updateMobile();
    mql.addEventListener("change", updateMobile);
    return () => mql.removeEventListener("change", updateMobile);
  }, [breakpoint]);
  return isMobile;
}

export function ChatLayout() {
  const isMobile = useIsMobile();
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [resourceSidebarOpen, setResourceSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    threadId,
    threads,
    filter,
    setFilter,
    createThread,
    switchThread,
    archiveThread,
    deleteThread,
    restoreThread,
  } = useThread();

  const sendMessageMutation = useMutation(
    api.chat.sendMessage,
  ).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listThreadMessages),
  );

  const handleToggleSidebar = useCallback(() => {
    if (isMobile) {
      setMobileSidebarOpen((prev) => !prev);
    } else {
      setDesktopSidebarOpen((prev) => !prev);
    }
  }, [isMobile]);

  const handleToggleNotificationPanel = useCallback(() => {
    setNotificationPanelOpen((prev) => !prev);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleNewThread = useCallback(async () => {
    await createThread();
  }, [createThread]);

  const handleEnsureThread = useCallback(async (): Promise<string> => {
    if (threadId) return threadId;
    return createThread();
  }, [threadId, createThread]);

  const handleAction = useCallback(
    async (prompt: string) => {
      const tid = threadId ?? (await createThread());
      await sendMessageMutation({ threadId: tid, prompt });
    },
    [threadId, createThread, sendMessageMutation],
  );

  // Newspaper functionality removed - consolidated into notebooks

  const handleSelectThread = useCallback(
    (id: string) => {
      switchThread(id);
      setMobileSidebarOpen(false);
    },
    [switchThread],
  );

  const sidebarContent = (
    <ThreadSidebar
      threads={threads}
      activeThreadId={threadId}
      filter={filter}
      onSelectThread={handleSelectThread}
      onNewThread={handleNewThread}
      onSetFilter={setFilter}
      onArchiveThread={archiveThread}
      onDeleteThread={deleteThread}
      onRestoreThread={restoreThread}
    />
  );

  return (
    <ChatActionContext.Provider value={{ sendMessage: handleAction }}>
      <div className="flex h-dvh flex-col bg-background bg-grid-pattern pb-14 md:pb-0">
        <ResponsiveHeader
          notificationPanelOpen={notificationPanelOpen}
          onToggleNotificationPanel={handleToggleNotificationPanel}
          onOpenSettings={handleOpenSettings}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar — inline, no overlay */}
          {!isMobile && desktopSidebarOpen && sidebarContent}

          {/* Mobile sidebar — Sheet with overlay */}
          {isMobile && (
            <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
              <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                {sidebarContent}
              </SheetContent>
            </Sheet>
          )}

          <div className="flex flex-1 flex-col min-w-0">
            {threadId ? (
              <>
                <MessageList threadId={threadId} onAction={handleAction} />
                <ChatInput
                  threadId={threadId}
                  onEnsureThread={handleEnsureThread}
                />
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
                <div className="flex flex-col items-center gap-4 animate-float-up">
                  <div className="relative">
                    <Image
                      src={appIcon}
                      alt="Islas"
                      width={80}
                      height={80}
                      className="rounded-2xl neon-glow-cyan"
                    />
                    <div className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h2 className="text-gradient-neon text-2xl font-bold tracking-tight">
                      Islas
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                      Your personal AI agent hub. Ask anything, or try a command below.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {/* Featured action - Notebook */}
                    <button
                      onClick={() => handleAction("Create a new notebook")}
                      className="glass rounded-full px-4 py-1.5 text-xs flex items-center gap-1.5 bg-gradient-to-r from-neon-cyan/10 to-neon-purple/10 text-foreground transition-all hover:neon-glow-cyan border border-neon-cyan/30"
                    >
                      <span>📚</span>
                      Create Notebook
                    </button>
                    {[
                      "Create a new note",
                      "Show my dashboard",
                      "Draft a project plan",
                      "Search my notebooks",
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleAction(suggestion)}
                        className="glass rounded-full px-4 py-1.5 text-xs text-muted-foreground transition-all hover:text-foreground hover:neon-glow-cyan"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-full max-w-2xl mt-4">
                  <ChatInput
                    threadId={null}
                    onEnsureThread={handleEnsureThread}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notification Panel - Desktop */}
          {!isMobile && notificationPanelOpen && (
            <div className="w-80 border-l bg-sidebar animate-slide-in-right">
              <NotificationPanel />
            </div>
          )}

          {/* Notification Panel - Mobile */}
          {isMobile && (
            <Sheet open={notificationPanelOpen} onOpenChange={setNotificationPanelOpen}>
              <SheetContent side="right" className="w-80 p-0" showCloseButton={false}>
                <SheetTitle className="sr-only">Notifications</SheetTitle>
                <NotificationPanel />
              </SheetContent>
            </Sheet>
          )}

          {/* Resource Sidebar - Mobile */}
          {isMobile && (
            <Sheet open={resourceSidebarOpen} onOpenChange={setResourceSidebarOpen}>
              <SheetContent side="right" className="w-80 p-0" showCloseButton={false}>
                <SheetTitle className="sr-only">Notebooks</SheetTitle>
                <ResourceSidebar onSelectInternalLink={(link) => {
                  handleAction(link);
                  setResourceSidebarOpen(false);
                }} />
              </SheetContent>
            </Sheet>
          )}

          {/* Resource Sidebar - Desktop */}
          {!isMobile && resourceSidebarOpen && (
            <ResourceSidebar onSelectInternalLink={handleAction} />
          )}

          {/* Newspaper sidebar removed - consolidated into notebooks */}

        </div>

        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <MobileBottomNav
            _onToggleHistory={handleToggleSidebar}
            onOpenSettings={handleOpenSettings}
            _isHistoryOpen={mobileSidebarOpen}
          />
        )}

        {/* Settings Dialog */}
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    </ChatActionContext.Provider>
  );
}

