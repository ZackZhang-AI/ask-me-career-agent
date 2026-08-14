"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONVERSATION_HISTORY_KEY,
  parseConversationHistory,
  renameLocalConversation,
  upsertLocalConversation,
  type ConversationMessage,
  type LocalConversation,
} from "@/lib/conversation-history";

function writeHistory(history: readonly LocalConversation[]) {
  try {
    window.localStorage.setItem(CONVERSATION_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // 存储空间不足时不影响当前会话继续使用。
  }
}

export function useConversationHistory() {
  const [history, setHistory] = useState<LocalConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const historyRef = useRef<LocalConversation[]>([]);
  const activeIdRef = useRef<string | null>(null);

  const commit = useCallback((next: LocalConversation[]) => {
    historyRef.current = next;
    setHistory(next);
    writeHistory(next);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = parseConversationHistory(window.localStorage.getItem(CONVERSATION_HISTORY_KEY));
      historyRef.current = stored;
      setHistory(stored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setActive = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveConversationId(id);
  }, []);

  const persistConversation = useCallback((messages: readonly ConversationMessage[]) => {
    const id = activeIdRef.current ?? crypto.randomUUID();
    if (!activeIdRef.current) setActive(id);
    commit(upsertLocalConversation(historyRef.current, id, messages));
    return id;
  }, [commit, setActive]);

  const openConversation = useCallback((id: string) => {
    const conversation = historyRef.current.find((item) => item.id === id);
    if (!conversation) return null;
    setActive(id);
    return conversation;
  }, [setActive]);

  const startNewConversation = useCallback(() => setActive(null), [setActive]);

  const renameConversation = useCallback((id: string, title: string) => {
    commit(renameLocalConversation(historyRef.current, id, title));
  }, [commit]);

  const deleteConversation = useCallback((id: string) => {
    const wasActive = activeIdRef.current === id;
    commit(historyRef.current.filter((conversation) => conversation.id !== id));
    if (wasActive) setActive(null);
    return wasActive;
  }, [commit, setActive]);

  return {
    history,
    activeConversationId,
    persistConversation,
    openConversation,
    startNewConversation,
    renameConversation,
    deleteConversation,
  };
}
