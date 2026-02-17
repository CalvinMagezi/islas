"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

interface NotificationBellProps {
  active: boolean;
  onClick: () => void;
}

export function NotificationBell({ active, onClick }: NotificationBellProps) {
  const unreadCount = useQuery(api.functions.notifications.unreadCount);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={`relative h-8 w-8 text-muted-foreground hover:text-foreground ${
        active ? "bg-primary/10 text-primary" : ""
      }`}
      title="Notifications"
    >
      <Bell className="h-4 w-4" />
      {(unreadCount ?? 0) > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-cyan px-1 text-[10px] font-bold text-black">
          {unreadCount! > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  );
}
