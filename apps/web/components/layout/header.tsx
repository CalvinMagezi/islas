"use client";

import Image from "next/image";
import Link from "next/link";
import { UserButton } from "@/components/auth/user-button";
import { Plus, PanelLeftClose, PanelLeft, Settings, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import appIcon from "@/app/icon.png";

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewThread: () => void;
  notificationPanelOpen: boolean;
  onToggleNotificationPanel: () => void;
  onOpenSettings: () => void;
}

export function Header({
  sidebarOpen,
  onToggleSidebar,
  onNewThread,
  notificationPanelOpen,
  onToggleNotificationPanel,
  onOpenSettings,
}: HeaderProps) {
  return (
    <header className="glass-heavy sticky top-0 z-40 flex h-14 items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </Button>
        <div className="flex items-center gap-2">
          <Image
            src={appIcon}
            alt="Islas"
            width={28}
            height={28}
            className="rounded-md"
          />
          <h1 className="text-gradient-neon text-lg font-bold tracking-tight hidden sm:block">
            Islas
          </h1>
        </div>
      </div>

      {/* Center Navigation */}
      <div className="flex items-center gap-3">
        <Link href="/notebooks">
          <Button
            variant="ghost"
            className="h-8 gap-2 text-muted-foreground hover:text-foreground"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Notebooks</span>
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell
          active={notificationPanelOpen}
          onClick={onToggleNotificationPanel}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <div className="h-4 w-px bg-border/50 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewThread}
          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-primary/10"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <UserButton />
      </div>
    </header>
  );
}
