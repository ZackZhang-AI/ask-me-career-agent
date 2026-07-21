"use client";

import { createContext, useContext } from "react";

export type ConversationCommand =
  | { id: number; type: "reset" }
  | { id: number; type: "ask"; question: string };

export type ConversationControl = {
  command: ConversationCommand | null;
  startNewConversation: () => void;
  enqueueQuestion: (question: string) => void;
};

export const ConversationControlContext = createContext<ConversationControl | null>(null);

export function useConversationControl() {
  const value = useContext(ConversationControlContext);
  if (!value) throw new Error("useConversationControl must be used inside AppFrame");
  return value;
}
