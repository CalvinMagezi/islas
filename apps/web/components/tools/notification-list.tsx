"use client";

import { Badge } from "@/components/ui/badge";
import { Bell, ShieldAlert, Clock, CheckCircle2, Square, Info } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

const TYPE_ICON: Record<string, typeof Bell> = {
  permission_prompt: ShieldAlert,
  idle_prompt: Clock,
  auth_success: CheckCircle2,
  task_complete: CheckCircle2,
  stop: Square,
  info: Info,
};

const TYPE_COLOR: Record<string, string> = {
  permission_prompt: "text-orange-400",
  idle_prompt: "text-neon-blue",
  auth_success: "text-green-400",
  task_complete: "text-green-400",
  stop: "text-neon-purple",
  info: "text-neon-cyan",
};

export function NotificationList({ data }: ToolResultProps) {
  const { notifications = [], total, unread } = (data as { notifications?: Array<{ _id?: string; type: string; title?: string; message: string; read?: boolean; project?: string }>; total?: number; unread?: number }) || {};

  if (notifications.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center animate-float-up">
        <Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No notifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full animate-float-up">
      <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium px-1">
        {total ?? notifications.length} notifications
        {unread ? ` (${unread} unread)` : ""}
      </p>
      <div className="grid gap-1.5">
        {notifications.map((n, i: number) => {
          const Icon = TYPE_ICON[n.type] ?? Bell;
          const color = TYPE_COLOR[n.type] ?? "text-muted-foreground";
          return (
            <div
              key={n._id ?? i}
              className={`glass rounded-xl p-3 transition-all ${
                !n.read ? "border-l-2 border-l-neon-cyan" : ""
              }`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-start gap-2">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  {n.title && (
                    <p className="text-xs font-medium">{n.title}</p>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {n.message}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={`text-[10px] ${color}`}>
                      {n.type?.replace(/_/g, " ")}
                    </Badge>
                    {n.project && (
                      <Badge variant="outline" className="text-[10px]">
                        {n.project}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
