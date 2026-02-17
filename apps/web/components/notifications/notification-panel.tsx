"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import { Doc } from "@repo/convex";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2, Bell, CheckCheck } from "lucide-react";
import { NotificationCard } from "./notification-card";

export function NotificationPanel() {
  const notifications = useQuery(api.functions.notifications.list, {
    limit: 50,
  });
  const markAllRead = useMutation(api.functions.notifications.markAllRead);
  const clearAll = useMutation(api.functions.notifications.clearAll);

  const hasUnread = notifications?.some((n: Doc<"notifications">) => !n.read);
  const hasNotifications = notifications && notifications.length > 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h3 className="text-sm font-medium">Notifications</h3>
        <div className="flex items-center gap-1">
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => markAllRead({})}
              title="Mark all as read"
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
          {hasNotifications && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => clearAll({})}
              title="Clear all notifications"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 h-full">
        {!notifications ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Bell className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/50">
              No notifications yet
            </p>
          </div>
        ) : (
          <div className="divide-y pb-4">
            {notifications.map((notification: Doc<"notifications">) => (
              <NotificationCard
                key={notification._id}
                notification={notification}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
