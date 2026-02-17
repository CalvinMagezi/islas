"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Menu, MessageSquare, BookOpen, Settings, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  notificationPanelOpen?: boolean;
  onToggleNotificationPanel?: () => void;
  onOpenSettings?: () => void;
  unreadCount?: number;
}

export function MobileNav({
  onToggleNotificationPanel,
  onOpenSettings,
  unreadCount = 0,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  const navItems = [
    {
      title: "Chat",
      href: "/",
      icon: MessageSquare,
      description: "AI chat interface",
    },
    {
      title: "Notebooks",
      href: "/notebooks",
      icon: BookOpen,
      description: "Notes archive",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-left text-xl font-bold">
            Islas
          </SheetTitle>
        </SheetHeader>

        <div className="mt-8 flex flex-col gap-2">
          {/* Navigation Items */}
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">{item.title}</span>
                  <span
                    className={cn(
                      "text-xs",
                      active
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {item.description}
                  </span>
                </div>
              </Link>
            );
          })}

          <Separator className="my-4" />

          {/* Actions */}
          <div className="space-y-2">
            {onToggleNotificationPanel && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-4 py-3 h-auto"
                onClick={() => {
                  onToggleNotificationPanel();
                  setOpen(false);
                }}
              >
                <div className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <span className="font-medium">Notifications</span>
              </Button>
            )}

            {onOpenSettings && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-4 py-3 h-auto"
                onClick={() => {
                  onOpenSettings();
                  setOpen(false);
                }}
              >
                <Settings className="h-5 w-5" />
                <span className="font-medium">Settings</span>
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
