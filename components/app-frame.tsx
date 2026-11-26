"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowSquareOutIcon,
  ArrowUpRightIcon,
  CaretRightIcon,
  CheckIcon,
  CompassIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  GithubLogoIcon,
  PhoneIcon,
  PlusIcon,
  ShieldCheckIcon,
  SidebarSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { capabilityNavigation } from "@/lib/capability-navigation";
import { profile } from "@/lib/profile";
import { ConversationHistoryList } from "./conversation-history-list";
import { ConversationControlContext, type ConversationCommand } from "./conversation-control";
import { useConversationHistory } from "./use-conversation-history";

const capabilityItemQuestions: Record<string, string> = {
  "SQL / Python 数据分析": "你的核心技术能力有哪些？",
  "指标与评测集设计": "AI Coding 评测的七维指标和硬门槛如何设计？",
  "风控 38 题与 OCR 盲测": "租车风控工作台是怎么做模型选型和兜底设计的？",
  "RAGAS 与 Badcase 分析": "你如何分析和归因 AI Coding 的 Bad Case？",
  "滴滴三方风控预审 SOP": "租车商家准入 AI 预审工作台具体做了什么？",
  "财务审计流程": "举一个审计问题转成产品的例子。",
  "IT 审计与日志核查": "你的 IT 审计日志抽查助手能做什么？",
  "企业数据与风险边界": "你对企业级 AI 场景有哪些理解？",
  "滴滴风控 / DiVA / 比价 Skill": "请介绍一下你在滴滴的 AI 产品经理实习。",
  "RAG 知识库系统": "你的 RAG 项目如何设计混合检索和引用溯源？",
  "Multi-Agent 工作流": "DeepFlow 体现了你哪些多 Agent 产品思考？",
  "Web 与桌面原型": "你有哪些可以直接演示的项目成果？",
  "AI 编程工具辅助": "你如何使用 AI 编程工具提升交付效率？",
};

export function AppFrame({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [hasActiveMessages, setHasActiveMessages] = useState(false);
  const [openCapabilityIndex, setOpenCapabilityIndex] = useState<number | null>(null);
  const [copiedContact, setCopiedContact] = useState<"email" | "phone" | null>(null);
  const [conversationCommand, setConversationCommand] = useState<ConversationCommand | null>(null);
  const commandIdRef = useRef(0);
  const copyTimerRef = useRef<number | null>(null);

  const {
    history,
    activeConversationId,
    persistConversation,
    openConversation: readConversation,
    startNewConversation: clearActiveConversation,
    renameConversation,
    deleteConversation: removeConversation,
  } = useConversationHistory();

  useEffect(() => {
    if (!mobileDrawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileDrawerOpen]);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
  }, []);

  const startNewConversation = useCallback(() => {
    clearActiveConversation();
    setMobileDrawerOpen(false);
    commandIdRef.current += 1;
    setConversationCommand({ id: commandIdRef.current, type: "reset" });
  }, [clearActiveConversation]);

  const enqueueQuestion = useCallback((question: string) => {
    setMobileDrawerOpen(false);
    commandIdRef.current += 1;
    setConversationCommand({ id: commandIdRef.current, type: "ask", question });
  }, []);

  const openConversation = useCallback((id: string) => {
    const conversation = readConversation(id);
    if (!conversation) return;
    setMobileDrawerOpen(false);
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

  async function copyContactValue(kind: "email" | "phone", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedContact(kind);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedContact((current) => (current === kind ? null : current));
      }, 1_800);
    } catch {
      window.location.href = kind === "email" ? `mailto:${value}` : `tel:${value}`;
    }
  }

  const conversationControl = useMemo(() => ({
    command: conversationCommand,
    history,
    activeConversationId,
    hasActiveMessages,
    setHasActiveMessages,
    mobileDrawerOpen,
    setMobileDrawerOpen,
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
    hasActiveMessages,
    history,
    mobileDrawerOpen,
    openConversation,
    persistConversation,
    renameConversation,
    startNewConversation,
  ]);

  return (
    <ConversationControlContext.Provider value={conversationControl}>
      <main
        className={`app-shell${sidebarCollapsed ? " is-sidebar-collapsed" : ""}${mobileDrawerOpen ? " is-mobile-drawer-open" : ""}`}
        id="top"
      >
        {mobileDrawerOpen && (
          <div
            className="sidebar-backdrop"
            aria-hidden="true"
            onClick={() => setMobileDrawerOpen(false)}
          />
        )}

        <aside
          id="candidate-sidebar"
          className={`sidebar${sidebarCollapsed ? " is-collapsed" : ""}${mobileDrawerOpen ? " is-mobile-open" : ""}`}
          aria-label="候选人信息"
        >
          <div className="sidebar-header">
            <div className="sidebar-title-row">
              <a
                className="brand"
                href="#top"
                aria-label="Ask Me 首页"
                onClick={(event) => {
                  event.preventDefault();
                  startNewConversation();
                }}
              >
                <span className="brand-mark" aria-hidden="true">A</span>
                <span className="brand-copy">
                  <strong>Ask Me</strong>
                  <small>AI Career Agent</small>
                </span>
              </a>

              <button
                className="sidebar-toggle desktop-only-toggle"
                type="button"
                aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
                aria-controls="candidate-sidebar"
                aria-expanded={!sidebarCollapsed}
                title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
                onClick={() => setSidebarCollapsed((current) => !current)}
              >
                <SidebarSimpleIcon size={18} weight="bold" aria-hidden="true" />
              </button>

              <button
                className="sidebar-toggle mobile-drawer-close"
                type="button"
                aria-label="关闭侧边导航栏"
                onClick={() => setMobileDrawerOpen(false)}
              >
                <XIcon size={18} weight="regular" aria-hidden="true" />
              </button>
            </div>

            <button
              id="new-chat-button"
              className="new-chat"
              type="button"
              onClick={startNewConversation}
              aria-label="新对话"
              title={sidebarCollapsed ? "新对话" : undefined}
            >
              <PlusIcon size={17} weight="bold" aria-hidden="true" />
              <span className="new-chat-label">新对话</span>
            </button>
          </div>

          <div className="sidebar-scroll">
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
                {capabilityNavigation.map((capability, index) => {
                  const isOpen = openCapabilityIndex === index;
                  return (
                    <li className={`strength-item${isOpen ? " is-open" : ""}`} key={capability.title}>
                      <button
                        className="strength-trigger"
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`capability-panel-${index}`}
                        onClick={() => setOpenCapabilityIndex((current) => (current === index ? null : index))}
                      >
                        <span>{capability.title}</span>
                        <CaretRightIcon size={13} aria-hidden="true" />
                      </button>

                      {isOpen && (
                        <div
                          className="strength-panel"
                          id={`capability-panel-${index}`}
                          role="group"
                          aria-label={`${capability.title}二级能力`}
                        >
                          <p>{capability.summary}</p>
                          <ul className="strength-sublist">
                            {capability.items.map((item) => (
                              <li key={item}>
                                <button
                                  type="button"
                                  onClick={() => enqueueQuestion(capabilityItemQuestions[item] ?? capability.question)}
                                >
                                  <span>{item}</span>
                                  <ArrowUpRightIcon size={12} aria-hidden="true" />
                                </button>
                              </li>
                            ))}
                          </ul>
                          <button
                            className="strength-ask-all"
                            type="button"
                            onClick={() => enqueueQuestion(capability.question)}
                          >
                            <span>了解该方向全貌</span>
                            <ArrowUpRightIcon size={13} aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="sidebar-footer">
            <a
              href={profile.github}
              target="_blank"
              rel="noreferrer"
              data-track-event="project_opened"
              data-track-detail="github"
              aria-label="GitHub 项目"
              title={sidebarCollapsed ? "GitHub 项目" : undefined}
            >
              <GithubLogoIcon size={17} aria-hidden="true" />
              <span>GitHub 项目</span>
              <ArrowSquareOutIcon className="external-icon" size={15} aria-hidden="true" />
            </a>

            <a
              href={profile.portfolio}
              target="_blank"
              rel="noreferrer"
              data-track-event="project_opened"
              data-track-detail="portfolio"
              aria-label="个人作品集"
              title={sidebarCollapsed ? "个人作品集" : undefined}
            >
              <CompassIcon size={17} aria-hidden="true" />
              <span>个人作品集</span>
              <ArrowSquareOutIcon className="external-icon" size={15} aria-hidden="true" />
            </a>

            <button
              type="button"
              className="sidebar-footer-btn"
              data-track-event="contact_opened"
              data-track-detail="email"
              aria-label="发送邮件"
              title={sidebarCollapsed ? `复制邮箱：${profile.email}` : `点击复制邮箱：${profile.email}`}
              onClick={() => void copyContactValue("email", profile.email)}
            >
              {copiedContact === "email" ? (
                <CheckIcon size={17} weight="bold" aria-hidden="true" />
              ) : (
                <EnvelopeSimpleIcon size={17} aria-hidden="true" />
              )}
              <span>{copiedContact === "email" ? "已复制邮箱" : "发送邮件"}</span>
            </button>

            <button
              type="button"
              className="sidebar-footer-btn"
              data-track-event="contact_opened"
              data-track-detail="phone"
              aria-label="电话联系"
              title={sidebarCollapsed ? `复制电话：${profile.phone}` : `点击复制电话：${profile.phone}`}
              onClick={() => void copyContactValue("phone", profile.phone)}
            >
              {copiedContact === "phone" ? (
                <CheckIcon size={17} weight="bold" aria-hidden="true" />
              ) : (
                <PhoneIcon size={17} aria-hidden="true" />
              )}
              <span>{copiedContact === "phone" ? "已复制电话" : "电话联系"}</span>
            </button>

            <a
              href="/resume"
              aria-label="查看最新简历"
              title={sidebarCollapsed ? "查看最新简历" : undefined}
            >
              <FileTextIcon size={17} aria-hidden="true" />
              <span>查看最新简历</span>
            </a>

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
