"use client";

import Image from "next/image";
import type { UIMessage } from "@convex-dev/agent/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TextPart } from "./parts/text-part";
import { ToolCallPart } from "./parts/tool-call-part";
import { ReasoningPart } from "./parts/reasoning-part";
import { ToolResultPart } from "./tool-result-part";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import appIcon from "@/app/icon.png";

interface MessageRendererProps {
  message: UIMessage;
  onAction?: (prompt: string) => void;
}

export function MessageRenderer({ message, onAction }: MessageRendererProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "animate-float-up flex gap-3 px-3 sm:px-4 py-2",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      {isUser ? (
        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
          <AvatarFallback className="bg-primary/20 text-primary text-xs">
            <User className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="h-7 w-7 shrink-0 mt-0.5 rounded-full overflow-hidden ring-1 ring-primary/20">
          <Image
            src={appIcon}
            alt="Islas"
            width={28}
            height={28}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Message content */}
      <div
        className={cn(
          "flex min-w-0 max-w-[88%] sm:max-w-[80%] flex-col gap-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        {message.parts.map((part, i) => {
          const key = `${message.key}-part-${i}`;

          if (part.type === "text") {
            return (
              <div
                key={key}
                className={cn(
                  "rounded-2xl px-3.5 py-2.5",
                  isUser
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "glass rounded-bl-md",
                )}
              >
                <TextPart
                  text={part.text}
                  isStreaming={part.state === "streaming"}
                  isUser={isUser}
                />
              </div>
            );
          }

          if (part.type === "reasoning") {
            return <ReasoningPart key={key} text={part.text} />;
          }

          if (part.type.startsWith("tool-")) {
            const toolPart = part as {
              state: string;
              output?: unknown;
            };
            const toolName = part.type.replace("tool-", "");

            if (
              toolPart.state === "input-streaming" ||
              toolPart.state === "input-available"
            ) {
              return (
                <ToolCallPart
                  key={key}
                  toolName={toolName}
                  state={toolPart.state}
                />
              );
            }

            if (toolPart.state === "output-error") {
              return (
                <ToolCallPart
                  key={key}
                  toolName={toolName}
                  state="output-error"
                />
              );
            }

            if (toolPart.state === "output-available" && toolPart.output) {
              return (
                <ToolResultPart
                  key={key}
                  toolName={toolName}
                  result={toolPart.output}
                  state={toolPart.state}
                  onAction={onAction}
                />
              );
            }

            return null;
          }

          return null;
        })}
      </div>
    </div>
  );
}
