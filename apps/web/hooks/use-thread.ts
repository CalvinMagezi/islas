"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/convex";

export type ThreadFilter = "active" | "archived";

export function useThread() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ThreadFilter>("active");

  // @ts-ignore — TS2589: deep type instantiation in generated Convex API
  const threads = useQuery(api.chat.listThreads, { status: filter }) ?? [];
  // @ts-ignore — TS2589
  const createThreadMutation = useMutation(api.chat.createThread);
  // @ts-ignore — TS2589
  const archiveThreadMutation = useMutation(api.chat.archiveThread);
  // @ts-ignore — TS2589
  const softDeleteThreadMutation = useMutation(api.chat.softDeleteThread);
  // @ts-ignore — TS2589
  const restoreThreadMutation = useMutation(api.chat.restoreThread);

  const createThread = useCallback(async () => {
    const newThreadId = await createThreadMutation();
    setThreadId(newThreadId);
    return newThreadId;
  }, [createThreadMutation]);

  const switchThread = useCallback((id: string) => {
    setThreadId(id);
  }, []);

  const archiveThread = useCallback(
    async (id: string) => {
      await archiveThreadMutation({ threadId: id });
      if (threadId === id) setThreadId(null);
    },
    [archiveThreadMutation, threadId],
  );

  const deleteThread = useCallback(
    async (id: string) => {
      await softDeleteThreadMutation({ threadId: id });
      if (threadId === id) setThreadId(null);
    },
    [softDeleteThreadMutation, threadId],
  );

  const restoreThread = useCallback(
    async (id: string) => {
      await restoreThreadMutation({ threadId: id });
    },
    [restoreThreadMutation],
  );

  return {
    threadId,
    threads,
    filter,
    setFilter,
    createThread,
    switchThread,
    archiveThread,
    deleteThread,
    restoreThread,
    setThreadId,
  };
}
