"use client";

import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  FileTextIcon,
  ListIcon,
} from "@phosphor-icons/react";
import { profile } from "@/lib/profile";
import { useConversationControl } from "./conversation-control";
import { ThemeToggle } from "./theme-toggle";

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
          <span className="brand-mark" aria-hidden="true">Z</span>
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
          <strong>{profile.englishName}</strong>
          <span className="brand-dot" aria-hidden="true">●</span>
          <span>AI 分身 · 公开资料问答</span>
        </div>
      </div>

      <div className="topbar-actions">
        <a
          id="topbar-portfolio-link"
          className="portfolio-topbar-link"
          href={profile.portfolio}
          target="_blank"
          rel="noreferrer"
          data-track-event="project_opened"
          data-track-detail="portfolio"
        >
          <span>个人作品集</span>
          <ArrowUpRightIcon size={13} aria-hidden="true" />
        </a>

        <ThemeToggle />

        <a id="topbar-resume-link" className="resume-link" href="/resume">
          <FileTextIcon size={15} aria-hidden="true" />
          <span className="resume-label-desktop">查看最新简历</span>
          <span className="resume-label-mobile">简历</span>
        </a>
      </div>
    </header>
  );
}
