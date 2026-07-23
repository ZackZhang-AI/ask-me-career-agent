"use client";

import { createContext, useContext } from "react";
import type { ConversationMessage, LocalConversation } from "@/lib/conversation-history";

export type ConversationCommand =
  | { id: number; type: "reset" }
  | { id: number; type: "ask"; question: string }
  | { id: number; type: "load"; conversationId: string; messages: ConversationMessage[] };

export type ConversationControl = {
  command: ConversationCommand | null;
  history: LocalConversation[];
  activeConversationId: string | null;
  startNewConversation: () => void;
  enqueueQuestion: (question: string) => void;
  openConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  persistConversation: (messages: readonly ConversationMessage[]) => string;
};

export const ConversationControlContext = createContext<ConversationControl | null>(null);

export function useConversationControl() {
  const value = useContext(ConversationControlContext);
  if (!value) throw new Error("useConversationControl must be used inside AppFrame");
  return value;
}
