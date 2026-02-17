"use client";

import { createContext, useContext } from "react";

type ChatActionContextType = {
  sendMessage: (prompt: string) => void;
};

export const ChatActionContext = createContext<ChatActionContextType>({
  sendMessage: () => {},
});

export function useChatAction() {
  return useContext(ChatActionContext);
}
