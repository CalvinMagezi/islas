"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Key, BarChart3, Settings, MessageSquare } from "lucide-react";
import { ApiKeyManager } from "./api-key-manager";
import { UsageDashboard } from "./usage-dashboard";
import { DiscordSettings } from "./discord-settings";

const TABS = [
  { key: "api-keys", label: "API Keys", icon: Key },
  { key: "usage", label: "Usage", icon: BarChart3 },
  { key: "discord", label: "Discord", icon: MessageSquare },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("api-keys");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-heavy max-w-lg p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Settings className="h-4 w-4 text-muted-foreground/50" />
          <DialogTitle className="text-xs font-display font-bold uppercase tracking-widest text-muted-foreground">Settings</DialogTitle>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 mx-5 mb-3 bg-muted/20 rounded-lg p-0.5 border border-border/30">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-display tracking-wider uppercase transition-all ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground font-bold"
                  : "text-muted-foreground/50 hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <tab.icon className="h-3 w-3" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[60vh] px-5 pb-5">
          {activeTab === "api-keys" && <ApiKeyManager />}
          {activeTab === "usage" && <UsageDashboard />}
          {activeTab === "discord" && <DiscordSettings />}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
