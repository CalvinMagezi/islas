"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@repo/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Check, AlertCircle, ExternalLink, Loader2, CheckCircle, XCircle, Radio } from "lucide-react";

export function DiscordSettings() {
  const settings = useQuery(api.functions.settings.getDiscordSettings);
  const updatePresence = useMutation(api.functions.settings.updateDiscordPresence);
  const setSetting = useMutation(api.functions.settings.set);
  const testConnection = useAction(api.functions.settings.testDiscordConnection);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    type: "idle" | "success" | "error";
    message?: string;
    botUser?: { username: string; discriminator: string };
  }>({ type: "idle" });

  // Local state for form
  const [botToken, setBotToken] = useState("");
  const [userId, setUserId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [enablePresence, setEnablePresence] = useState(false);
  const [presenceType, setPresenceType] = useState<"activity" | "custom-status">("activity");

  // Update local state when settings load
  useState(() => {
    if (settings) {
      if (settings.botToken) setBotToken(settings.botToken);
      if (settings.userId) setUserId(settings.userId);
      if (settings.channelId) setChannelId(settings.channelId);
      if (settings.webhookUrl) setWebhookUrl(settings.webhookUrl);
      setEnablePresence(settings.enablePresence);
      setPresenceType(settings.presenceType);
    }
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save bot credentials
      if (botToken) {
        await setSetting({ key: "discord_bot_token", value: botToken });
      }
      if (userId) {
        await setSetting({ key: "discord_user_id", value: userId });
      }
      if (channelId) {
        await setSetting({ key: "discord_channel_id", value: channelId });
      }
      if (webhookUrl) {
        await setSetting({ key: "discord_webhook_url", value: webhookUrl });
      }

      // Save presence settings
      await updatePresence({
        enablePresence,
        presenceType,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handlePresenceToggle = async (checked: boolean) => {
    setEnablePresence(checked);
    // Auto-save presence toggle
    try {
      await updatePresence({
        enablePresence: checked,
        presenceType,
      });
    } catch (err) {
      console.error("Failed to update presence:", err);
    }
  };

  const handleTestConnection = async () => {
    if (!botToken) {
      setConnectionStatus({
        type: "error",
        message: "Please enter a bot token first",
      });
      return;
    }

    setTesting(true);
    setConnectionStatus({ type: "idle" });

    try {
      const result = await testConnection({ botToken });

      if (result.success && result.botUser) {
        setConnectionStatus({
          type: "success",
          message: "Connected successfully!",
          botUser: result.botUser,
        });
      } else {
        setConnectionStatus({
          type: "error",
          message: result.error || "Failed to connect",
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Connection test failed";
      setConnectionStatus({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg glass">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Discord Integration</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect your agent to Discord for real-time status and notifications
          </p>
        </div>
      </div>

      {/* Presence Settings */}
      <div className="space-y-4 glass rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-xs font-medium">Online/Offline Presence</Label>
            <p className="text-[10px] text-muted-foreground">
              Show agent status in Discord
            </p>
          </div>
          <Switch
            checked={enablePresence}
            onCheckedChange={handlePresenceToggle}
          />
        </div>

        {enablePresence && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Presence Type</Label>
            <Select
              value={presenceType}
              onValueChange={(value: "activity" | "custom-status") =>
                setPresenceType(value)
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activity" className="text-xs">
                  Activity (Playing/Watching)
                </SelectItem>
                <SelectItem value="custom-status" className="text-xs">
                  Custom Status
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              {presenceType === "activity"
                ? "Shows status as '⚙️ Executing job' or '🟢 Idle'"
                : "Shows custom status message"}
            </p>
          </div>
        )}

        {enablePresence && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="text-[10px] space-y-1">
              <p className="font-medium">Status Updates</p>
              <ul className="list-disc list-inside space-y-0.5 opacity-90">
                <li>🟢 Online: Agent idle and ready</li>
                <li>🔴 DND: Agent executing a job</li>
                <li>⚪ Invisible: Agent offline</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Bot Credentials */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Bot Configuration</Label>
          <a
            href="https://discord.com/developers/applications"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            Discord Developer Portal
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="bot-token" className="text-xs text-muted-foreground">
                Bot Token
              </Label>
              {connectionStatus.type !== "idle" && (
                <div className="flex items-center gap-1.5">
                  {connectionStatus.type === "success" && (
                    <>
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="text-[10px] text-green-600 dark:text-green-400">
                        {connectionStatus.botUser
                          ? `${connectionStatus.botUser.username}#${connectionStatus.botUser.discriminator}`
                          : "Connected"}
                      </span>
                    </>
                  )}
                  {connectionStatus.type === "error" && (
                    <>
                      <XCircle className="h-3 w-3 text-red-500" />
                      <span className="text-[10px] text-red-600 dark:text-red-400">
                        {connectionStatus.message}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="bot-token"
                type="password"
                value={botToken}
                onChange={(e) => {
                  setBotToken(e.target.value);
                  setConnectionStatus({ type: "idle" });
                }}
                placeholder="MTk4NjIyNDgzN..."
                className="h-8 text-xs font-mono flex-1"
              />
              <Button
                onClick={handleTestConnection}
                disabled={testing || !botToken}
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs shrink-0"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Radio className="h-3 w-3 mr-1.5" />
                    Test
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-id" className="text-xs text-muted-foreground">
              Your Discord User ID
            </Label>
            <Input
              id="user-id"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="123456789012345678"
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Used for sending approval DMs
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-id" className="text-xs text-muted-foreground">
              Channel ID (Optional)
            </Label>
            <Input
              id="channel-id"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="987654321098765432"
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              For job event notifications
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="webhook-url" className="text-xs text-muted-foreground">
              Webhook URL (Optional)
            </Label>
            <Input
              id="webhook-url"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Alternative notification method
            </p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || !botToken || !userId}
          className="w-full h-8 text-xs"
          size="sm"
        >
          {saving ? (
            "Saving..."
          ) : saved ? (
            <>
              <Check className="h-3 w-3 mr-1.5" />
              Saved!
            </>
          ) : (
            "Save Configuration"
          )}
        </Button>
      </div>

      {/* Help Text */}
      <div className="text-[10px] text-muted-foreground space-y-1 p-3 rounded-md glass">
        <p className="font-medium">💡 Quick Start:</p>
        <ol className="list-decimal list-inside space-y-0.5 opacity-90">
          <li>Create a bot at Discord Developer Portal</li>
          <li>Copy the bot token and paste above</li>
          <li>Enable &quot;Presence Intent&quot; in bot settings</li>
          <li>Invite bot to your server with required permissions</li>
          <li>Toggle presence on and restart your agent</li>
        </ol>
      </div>
    </div>
  );
}
