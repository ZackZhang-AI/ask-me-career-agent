"use client";

import { useState } from "react";
import {
  CheckIcon,
  PencilSimpleIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { LocalConversation } from "@/lib/conversation-history";

interface ConversationHistoryListProps {
  conversations: LocalConversation[];
  activeConversationId: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationHistoryList({
  conversations,
  activeConversationId,
  onOpen,
  onRename,
  onDelete,
}: ConversationHistoryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (conversations.length === 0) return null;

  function beginRename(conversation: LocalConversation) {
    setDeletingId(null);
    setEditingId(conversation.id);
    setEditingTitle(conversation.title);
  }

  function finishRename() {
    if (editingId && editingTitle.trim()) onRename(editingId, editingTitle);
    setEditingId(null);
    setEditingTitle("");
  }

  return (
    <section className="history-section" aria-labelledby="history-label">
      <p className="sidebar-label" id="history-label">最近对话</p>
      <div className="history-list">
        {conversations.map((conversation) => (
          <div
            className={`history-item${activeConversationId === conversation.id ? " is-active" : ""}`}
            key={conversation.id}
          >
            {editingId === conversation.id ? (
              <form
                className="history-rename"
                onSubmit={(event) => {
                  event.preventDefault();
                  finishRename();
                }}
              >
                <input
                  autoFocus
                  value={editingTitle}
                  maxLength={60}
                  aria-label="重命名对话"
                  onChange={(event) => setEditingTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setEditingId(null);
                  }}
                />
                <button type="submit" aria-label="保存名称" title="保存名称">
                  <CheckIcon size={14} weight="bold" />
                </button>
              </form>
            ) : deletingId === conversation.id ? (
              <div className="history-confirm" role="group" aria-label={`确认删除 ${conversation.title}`}>
                <span>确认删除？</span>
                <button
                  type="button"
                  aria-label="确认删除"
                  title="确认删除"
                  onClick={() => {
                    onDelete(conversation.id);
                    setDeletingId(null);
                  }}
                >
                  <CheckIcon size={14} weight="bold" />
                </button>
                <button type="button" aria-label="取消删除" title="取消删除" onClick={() => setDeletingId(null)}>
                  <XIcon size={14} weight="bold" />
                </button>
              </div>
            ) : (
              <>
                <button
                  className="history-open"
                  type="button"
                  title={conversation.title}
                  onClick={() => onOpen(conversation.id)}
                >
                  <span>{conversation.title}</span>
                </button>
                <div className="history-actions">
                  <button type="button" aria-label={`重命名 ${conversation.title}`} title="重命名" onClick={() => beginRename(conversation)}>
                    <PencilSimpleIcon size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`删除 ${conversation.title}`}
                    title="删除"
                    onClick={() => {
                      setEditingId(null);
                      setDeletingId(conversation.id);
                    }}
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
