"use client";

export function LoadingSkeleton() {
  return (
    <div className="glass rounded-xl p-4 space-y-3 animate-float-up">
      <div className="h-4 w-3/4 rounded-md bg-muted/50 animate-shimmer" />
      <div className="h-4 w-1/2 rounded-md bg-muted/50 animate-shimmer [animation-delay:200ms]" />
      <div className="h-4 w-2/3 rounded-md bg-muted/50 animate-shimmer [animation-delay:400ms]" />
    </div>
  );
}
