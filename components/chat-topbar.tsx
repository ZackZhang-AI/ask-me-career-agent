"use client";

import {
  ArrowLeftIcon,
  FileTextIcon,
  ListIcon,
} from "@phosphor-icons/react";
import { profile } from "@/lib/profile";
import { useConversationControl } from "./conversation-control";

export function ChatTopbar() {
  const {
    hasActiveMessages,
    mobileDrawerOpen,
    setMobileDrawerOpen,
    startNewConversation,
  } = useConversationControl();

  return (
    <header className="chat-topbar">
      <div className="topbar-left">
        <button
          id="mobile-drawer-toggle"
          className="topbar-icon-btn mobile-menu-toggle"
          type="button"
          aria-label="打开侧边导航栏"
          aria-controls="candidate-sidebar"
          aria-expanded={mobileDrawerOpen}
          onClick={() => setMobileDrawerOpen(true)}
        >
          <ListIcon size={18} weight="regular" aria-hidden="true" />
        </button>

        <a
          className="mobile-brand"
          href="#top"
          aria-label="Ask Me 首页"
          onClick={(event) => {
            event.preventDefault();
            startNewConversation();
          }}
        >
          <span className="brand-mark" aria-hidden="true">A</span>
          <strong>Ask Me</strong>
        </a>

        {hasActiveMessages && (
          <button
            id="return-home-button"
            className="return-home"
            type="button"
            onClick={startNewConversation}
          >
            <ArrowLeftIcon size={14} weight="bold" aria-hidden="true" />
            <span>回到主页</span>
          </button>
        )}

        <div className="chat-context">
          <strong>{profile.name}</strong>
          <span>公开资料问答</span>
        </div>
      </div>

      <a id="topbar-resume-link" className="resume-link" href="/resume">
        <span>查看最新简历</span>
        <FileTextIcon size={16} aria-hidden="true" />
      </a>
    </header>
  );
}
