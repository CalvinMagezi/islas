"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Square,
  Info,
  X,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@repo/convex";
import type { Id } from "@repo/convex";

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Bell; color: string; label: string }
> = {
  permission_prompt: {
    icon: ShieldAlert,
    color: "text-orange-400",
    label: "Permission",
  },
  idle_prompt: {
    icon: Clock,
    color: "text-neon-blue",
    label: "Waiting",
  },
  auth_success: {
    icon: CheckCircle2,
    color: "text-green-400",
    label: "Auth",
  },
  task_complete: {
    icon: CheckCircle2,
    color: "text-green-400",
    label: "Complete",
  },
  stop: {
    icon: Square,
    color: "text-neon-purple",
    label: "Stopped",
  },
  info: {
    icon: Info,
    color: "text-neon-cyan",
    label: "Info",
  },
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface NotificationCardProps {
  notification: {
    _id: Id<"notifications">;
    _creationTime: number;
    type: string;
    message: string;
    title?: string;
    project?: string;
    read: boolean;
  };
}

export function NotificationCard({ notification }: NotificationCardProps) {
  const markAsRead = useMutation(api.functions.notifications.markAsRead);
  const dismiss = useMutation(api.functions.notifications.dismiss);

  const config = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.info;
  const Icon = config.icon;

  return (
    <div
      className={`group relative flex gap-3 rounded-lg p-3 transition-all hover:bg-accent/50 ${
        !notification.read ? "bg-primary/5" : ""
      }`}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-neon-cyan" />
      )}

      <div className={`mt-0.5 shrink-0 ${config.color}`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        {notification.title && (
          <p className="text-xs font-medium truncate">{notification.title}</p>
        )}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-[10px] ${config.color} border-current/30 bg-current/10`}
          >
            {config.label}
          </Badge>
          {notification.project && (
            <Badge variant="outline" className="text-[10px]">
              {notification.project}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground/50 ml-auto">
            {timeAgo(notification._creationTime)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => markAsRead({ id: notification._id })}
            title="Mark as read"
          >
            <CheckCircle2 className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => dismiss({ id: notification._id })}
          title="Dismiss"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
