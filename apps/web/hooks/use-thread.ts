"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/convex";

export type ThreadFilter = "active" | "archived";

export function useThread() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ThreadFilter>("active");

  const threads = useQuery(api.chat.listThreads, { status: filter }) ?? [];
  const createThreadMutation = useMutation(api.chat.createThread);
  const archiveThreadMutation = useMutation(api.chat.archiveThread);
  const softDeleteThreadMutation = useMutation(api.chat.softDeleteThread);
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
