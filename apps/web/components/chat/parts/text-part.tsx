"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";

interface TextPartProps {
  text: string;
  isStreaming?: boolean;
  isUser?: boolean;
}

export function TextPart({ text, isStreaming, isUser }: TextPartProps) {
  if (!text) return null;

  if (isUser) {
    return (
      <div className="text-sm whitespace-pre-wrap">
        {text}
      </div>
    );
  }

  return (
    <div className={cn("prose-chat max-w-none")}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => (
            <CodeBlock>{children}</CodeBlock>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match && !String(children).includes("\n");

            if (isInline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }

            return (
              <code className={cn(className, "block min-w-full")} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {text}
      </Markdown>
      {isStreaming && (
        <span className="ml-0.5 inline-block h-4 w-[3px] rounded-full bg-primary animate-cursor-blink" />
      )}
    </div>
  );
}
