"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import type { Id, Doc } from "@repo/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
} from "lucide-react";

/** Generate a random API key with `chq_` prefix */
function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `chq_${hex}`;
}

/** SHA-256 hash a string in the browser */
async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function ApiKeyManager() {
  const keys = useQuery(api.functions.apiKeys.listKeys);
  const createKey = useMutation(api.functions.apiKeys.create);
  const revokeKey = useMutation(api.functions.apiKeys.revoke);

  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [revoking, setRevoking] = useState<Id<"apiKeys"> | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const plainKey = generateApiKey();
      const keyHash = await hashKey(plainKey);
      const prefix = plainKey.slice(0, 12); // "chq_" + 8 hex chars

      await createKey({ name: newKeyName.trim(), keyHash, prefix });
      setGeneratedKey(plainKey);
      setNewKeyName("");
    } finally {
      setCreating(false);
    }
  }, [newKeyName, createKey]);

  const handleCopy = useCallback(async () => {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedKey]);

  const handleDismissKey = useCallback(() => {
    setGeneratedKey(null);
    setShowCreate(false);
  }, []);

  const handleRevoke = useCallback(
    async (id: Id<"apiKeys">) => {
      setRevoking(id);
      try {
        await revokeKey({ id });
      } finally {
        setRevoking(null);
      }
    },
    [revokeKey],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-neon-cyan" />
          <h3 className="text-sm font-semibold">API Keys</h3>
        </div>
        {!showCreate && !generatedKey && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            New Key
          </Button>
        )}
      </div>

      {/* Generated key banner — shown once */}
      {generatedKey && (
        <div className="glass rounded-xl p-4 border-neon-cyan/30 neon-glow-cyan animate-float-up space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-neon-cyan" />
            <p className="text-xs font-medium text-neon-cyan">
              Key created — copy it now. It won&apos;t be shown again.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-xs font-mono text-foreground select-all break-all">
              {generatedKey}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <p>
              Paste this into <code className="text-[10px] bg-black/20 px-1 py-0.5 rounded">apps/agent/.env.local</code> as <code className="text-[10px] bg-black/20 px-1 py-0.5 rounded">ISLAS_API_KEY</code>
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleDismissKey}
          >
            I&apos;ve copied it
          </Button>
        </div>
      )}

      {/* Create form */}
      {showCreate && !generatedKey && (
        <div className="glass rounded-xl p-4 animate-float-up space-y-3">
          <p className="text-xs text-muted-foreground">
            Name your key so you can identify it later.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Claude Code Hook"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              autoFocus
            />
            <Button
              size="sm"
              className="h-8 shrink-0"
              onClick={handleGenerate}
              disabled={!newKeyName.trim() || creating}
            >
              {creating ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary-foreground" />
              ) : (
                "Generate"
              )}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setShowCreate(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Key list */}
      {!keys ? (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
        </div>
      ) : keys.length === 0 && !showCreate && !generatedKey ? (
        <div className="glass rounded-xl p-6 text-center">
          <Key className="mx-auto mb-2 h-6 w-6 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground/50">
            No API keys yet. Create one to connect Claude Code.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {keys.map((key: Doc<"apiKeys">) => (
            <div
              key={key._id}
              className="glass rounded-lg px-3 py-2.5 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{key.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <code className="text-[11px] font-mono text-muted-foreground/60">
                    {key.prefix}...
                  </code>
                  <span className="text-[10px] text-muted-foreground/40">
                    Created {formatDate(key.createdAt)}
                  </span>
                  {key.expiresAt && (
                    <span
                      className={`text-[10px] ${
                        key.expiresAt < Date.now()
                          ? "text-destructive"
                          : key.expiresAt < Date.now() + 7 * 24 * 60 * 60 * 1000
                            ? "text-orange-400"
                            : "text-muted-foreground/40"
                      }`}
                    >
                      {key.expiresAt < Date.now()
                        ? "Expired"
                        : `Expires ${formatDate(key.expiresAt)}`}
                    </span>
                  )}
                  {key.lastUsedAt && (
                    <span className="text-[10px] text-muted-foreground/30">
                      Last used {formatDate(key.lastUsedAt)}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => handleRevoke(key._id)}
                disabled={revoking === key._id}
                title="Revoke key"
              >
                {revoking === key._id ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-destructive" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}
