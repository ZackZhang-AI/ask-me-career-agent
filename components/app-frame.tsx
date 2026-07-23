"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowSquareOutIcon,
  CaretRightIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  GithubLogoIcon,
  PhoneIcon,
  PlusIcon,
  ShieldCheckIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";
import { capabilityNavigation } from "@/lib/capability-navigation";
import { profile } from "@/lib/profile";
import { ConversationHistoryList } from "./conversation-history-list";
import { ConversationControlContext, type ConversationCommand } from "./conversation-control";
import { useConversationHistory } from "./use-conversation-history";

const publicLinks = [
  { label: "GitHub 项目", href: profile.github, icon: GithubLogoIcon, external: true, event: "project_opened", target: "github" },
  { label: "发送邮件", href: `mailto:${profile.email}`, icon: EnvelopeSimpleIcon, event: "contact_opened", target: "email" },
  { label: "电话联系", href: `tel:${profile.phone}`, icon: PhoneIcon, event: "contact_opened", target: "phone" },
  { label: "查看最新简历", href: "/resume", icon: FileTextIcon, event: undefined, target: undefined },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversationCommand, setConversationCommand] = useState<ConversationCommand | null>(null);
  const commandIdRef = useRef(0);
  const {
    history,
    activeConversationId,
    persistConversation,
    openConversation: readConversation,
    startNewConversation: clearActiveConversation,
    renameConversation,
    deleteConversation: removeConversation,
  } = useConversationHistory();

  const startNewConversation = useCallback(() => {
    clearActiveConversation();
    commandIdRef.current += 1;
    setConversationCommand({ id: commandIdRef.current, type: "reset" });
  }, [clearActiveConversation]);

  const enqueueQuestion = useCallback((question: string) => {
    commandIdRef.current += 1;
    setConversationCommand({ id: commandIdRef.current, type: "ask", question });
  }, []);

  const openConversation = useCallback((id: string) => {
    const conversation = readConversation(id);
    if (!conversation) return;
    commandIdRef.current += 1;
    setConversationCommand({
      id: commandIdRef.current,
      type: "load",
      conversationId: conversation.id,
      messages: conversation.messages,
    });
  }, [readConversation]);

  const deleteConversation = useCallback((id: string) => {
    const wasActive = removeConversation(id);
    if (!wasActive) return;
    commandIdRef.current += 1;
    setConversationCommand({ id: commandIdRef.current, type: "reset" });
  }, [removeConversation]);

  const conversationControl = useMemo(() => ({
    command: conversationCommand,
    history,
    activeConversationId,
    startNewConversation,
    enqueueQuestion,
    openConversation,
    renameConversation,
    deleteConversation,
    persistConversation,
  }), [
    activeConversationId,
    conversationCommand,
    deleteConversation,
    enqueueQuestion,
    history,
    openConversation,
    persistConversation,
    renameConversation,
    startNewConversation,
  ]);

  return (
    <ConversationControlContext.Provider value={conversationControl}>
      <main className={`app-shell${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`} id="top">
        <aside id="candidate-sidebar" className={`sidebar${sidebarCollapsed ? " is-collapsed" : ""}`} aria-label="候选人信息">
          <div className="sidebar-header">
          <div className="sidebar-title-row">
            <a className="brand" href="#top" aria-label="Ask Me 首页">
              <span className="brand-mark" aria-hidden="true">A</span>
              <span className="brand-copy">
                <strong>Ask Me</strong>
                <small>AI Career Agent</small>
              </span>
            </a>
            <button
              className="sidebar-toggle"
              type="button"
              aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
              aria-controls="candidate-sidebar"
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
              onClick={() => setSidebarCollapsed((current) => !current)}
            >
              <SidebarSimpleIcon size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>

          <button className="new-chat" type="button" onClick={startNewConversation} aria-label="新对话" title={sidebarCollapsed ? "新对话" : undefined}>
            <PlusIcon size={17} weight="bold" aria-hidden="true" />
            <span className="new-chat-label">新对话</span>
          </button>
          </div>

          <ConversationHistoryList
            conversations={history}
            activeConversationId={activeConversationId}
            onOpen={openConversation}
            onRename={renameConversation}
            onDelete={deleteConversation}
          />

          <section className="sidebar-section" aria-labelledby="profile-label">
          <p className="sidebar-label" id="profile-label">快速了解</p>
          <div className="profile-summary">
            <span className="profile-avatar" aria-hidden="true">张</span>
            <div className="profile-copy">
              <strong>{profile.name}</strong>
              <p>{profile.role}</p>
            </div>
          </div>
          <ul className="strength-nav">
            {capabilityNavigation.map((capability, index) => (
              <li className="strength-item" key={capability.title}>
                <button
                  className="strength-trigger"
                  type="button"
                  aria-describedby={`capability-${index}`}
                  onClick={() => enqueueQuestion(capability.question)}
                >
                  <span>{capability.title}</span>
                  <CaretRightIcon size={13} aria-hidden="true" />
                </button>
                <div className="strength-flyout" id={`capability-${index}`} role="group" aria-label={`${capability.title}二级能力`}>
                  <strong>{capability.title}</strong>
                  <p>{capability.summary}</p>
                  <ul>
                    {capability.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
          </section>

          <div className="sidebar-footer">
          {publicLinks.map(({ label, href, icon: Icon, external, event, target }) => (
            <a
              key={label}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              data-track-event={event}
              data-track-detail={target}
              aria-label={label}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
              {external && <ArrowSquareOutIcon className="external-icon" size={15} aria-hidden="true" />}
            </a>
          ))}
          <div className="privacy-note">
            <ShieldCheckIcon size={17} aria-hidden="true" />
            <p>仅基于候选人公开资料回答；对话记录只保存在此浏览器</p>
          </div>
          </div>
        </aside>

        {children}
      </main>
    </ConversationControlContext.Provider>
  );
}
