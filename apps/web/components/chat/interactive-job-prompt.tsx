"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Id } from "@repo/convex";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface InteractiveJobPromptProps {
  jobId: Id<"agentJobs">;
  className?: string;
}

export function InteractiveJobPrompt({ jobId, className }: InteractiveJobPromptProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const job = useQuery(api.agent.getJob, { jobId });
  const sendMessage = useMutation(api.agent.sendMessageToJob);

  if (!job || job.status !== "waiting_for_user") {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSubmitting(true);

    try {
      await sendMessage({
        jobId,
        message: message.trim(),
      });

      setMessage("");
      toast.success("Response sent");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send response");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Agent's question/prompt
  const agentQuestion = job.streamingText || "The agent is waiting for your input...";

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <MessageSquare className="h-4 w-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-amber-500 mb-1">
            Agent is waiting for your response
          </h4>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">
            {agentQuestion}
          </p>
        </div>
      </div>

      {/* Response form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your response..."
          className="min-h-20 resize-none bg-background/50 border-amber-500/20 focus:border-amber-500/40"
          disabled={isSubmitting}
          autoFocus
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {job.workerId && (
              <span className="font-mono">Worker: {job.workerId.slice(0, 8)}</span>
            )}
          </span>

          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !message.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-black"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Send Response
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Conversation history preview */}
      {job.conversationHistory && job.conversationHistory.length > 0 && (
        <div className="pt-3 border-t border-amber-500/20">
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              View conversation ({job.conversationHistory.length} messages)
            </summary>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {job.conversationHistory.slice(-5).map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-2 rounded text-xs",
                    msg.role === "user"
                      ? "bg-primary/10 border-l-2 border-primary/30"
                      : "bg-muted/30 border-l-2 border-muted-foreground/30"
                  )}
                >
                  <div className="font-medium mb-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {msg.role}
                  </div>
                  <div className="whitespace-pre-wrap line-clamp-3">
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
