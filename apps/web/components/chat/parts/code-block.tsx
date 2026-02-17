"use client";

import { Check, Copy, Terminal } from "lucide-react";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CodeBlockProps extends React.HTMLAttributes<HTMLPreElement> {
    language?: string;
    value?: string;
}

export function CodeBlock({ className, children, ...props }: CodeBlockProps) {
    const [isCopied, setIsCopied] = useState(false);
    const preRef = useRef<HTMLPreElement>(null);

    const handleCopy = async () => {
        if (!preRef.current) return;
        await navigator.clipboard.writeText(preRef.current.innerText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <div className="relative group my-2 rounded-lg border border-border bg-muted/40 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-muted/20">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Terminal className="h-3.5 w-3.5" />
                    <span className="font-mono">Code</span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={handleCopy}
                >
                    {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
            </div>
            <pre
                ref={preRef}
                className={cn(
                    "max-h-80 overflow-y-auto overflow-x-auto p-4 text-xs font-mono",
                    className
                )}
                {...props}
            >
                {children}
            </pre>
        </div>
    );
}
