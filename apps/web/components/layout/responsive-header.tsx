"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@/components/auth/user-button";
import { Settings, BookOpen, Bot, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { AgentStatusIndicator } from "@/components/layout/agent-status-indicator";
import appIcon from "@/app/icon.png";
import { cn } from "@/lib/utils";

interface ResponsiveHeaderProps {
  notificationPanelOpen: boolean;
  onToggleNotificationPanel: () => void;
  onOpenSettings: () => void;
}

const NAV_ITEMS = [
  { href: "/", label: "HQ", icon: Bot, match: (p: string) => p === "/" },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3, match: (p: string) => p === "/dashboard" },
  { href: "/notebooks", label: "Notebooks", icon: BookOpen, match: (p: string) => p.startsWith("/notebooks") },
];

export function ResponsiveHeader({
  notificationPanelOpen,
  onToggleNotificationPanel,
  onOpenSettings,
}: ResponsiveHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="glass-heavy sticky top-0 z-40 w-full border-b">
      <div className="flex h-13 items-center justify-between px-4 max-w-full">
        {/* Left: Logo */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <Image
              src={appIcon}
              alt="Islas"
              width={26}
              height={26}
              className="rounded-md shrink-0"
            />
            <h1 className="text-gradient-neon text-base font-bold tracking-tight hidden sm:block truncate font-display">
              Islas
            </h1>
          </Link>
        </div>

        {/* Center: Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-0.5 bg-muted/20 p-0.5 rounded-lg border border-border/40">
          {NAV_ITEMS.map((item) => {
            const isActive = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "h-7 gap-1.5 flex items-center px-3 rounded-md transition-all text-[12px] font-display tracking-wide",
                  isActive
                    ? "bg-background text-primary shadow-sm font-bold"
                    : "text-muted-foreground/60 hover:text-foreground"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <AgentStatusIndicator />
          <NotificationBell
            active={notificationPanelOpen}
            onClick={onToggleNotificationPanel}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            className="h-8 w-8 text-muted-foreground/60 hover:text-foreground"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>

          <div className="h-4 w-px bg-border/40 hidden md:block mx-0.5" />

          <UserButton />
        </div>
      </div>
    </header>
  );
}
