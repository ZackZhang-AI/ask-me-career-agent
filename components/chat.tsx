"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  ArrowUpIcon,
  ArrowUpRightIcon,
  CaretDownIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  GithubLogoIcon,
  PhoneIcon,
  StopIcon,
} from "@phosphor-icons/react";
import { featuredProjects, profile } from "@/lib/profile";
import { getBrowserSessionId } from "@/lib/client-session";
import {
  getFollowUpQuestions,
  inferQuestionCategory,
  questionGroups,
  type QuestionGroupId,
} from "@/lib/question-suggestions";
import type { ChatMessage, KnowledgeItem, ResponseStatus, Source } from "@/lib/types";

interface DisplayMessage extends ChatMessage {
  sources?: Source[];
  items?: KnowledgeItem[];
  mode?: "live" | "stable" | "demo" | "guardrail";
  responseStatus?: ResponseStatus;
  claimIds?: string[];
  sourceIds?: string[];
  latencyMs?: number;
}

const verificationLabels = {
  externally_verified: "外部可定位",
  self_attested: "候选人确认",
  unverified: "尚未验证",
} as const;

const statusLabels = {
  completed: "已完成",
  in_progress: "进行中",
  planned: "规划中",
  archived: "已归档",
} as const;

function track(event: string, sessionId: string, detail = "", metadata: Partial<DisplayMessage> & { questionCategory?: string } = {}) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      sessionId,
      detail,
      responseStatus: metadata.responseStatus,
      claimIds: metadata.claimIds,
      sourceIds: metadata.sourceIds,
      latencyMs: metadata.latencyMs,
      questionCategory: metadata.questionCategory,
    }),
    keepalive: true,
  });
}

export function Chat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeQuestionGroup, setActiveQuestionGroup] = useState<QuestionGroupId>("screening");
  const abortRef = useRef<AbortController | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(question: string, fromSuggestion = false) {
    const clean = question.trim();
    if (!clean || loading) return;
    const sessionId = getBrowserSessionId();

    setInput("");
    setError("");
    setLoading(true);
    const userMessage: DisplayMessage = { role: "user", content: clean };
    const nextMessages = [...messages, userMessage];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    track(fromSuggestion ? "suggestion_clicked" : "question_sent", sessionId, "", { questionCategory: inferQuestionCategory(clean) });
    if (messages.some((message) => message.role === "user")) track("followup_sent", sessionId);

    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          sessionId,
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "问答请求失败，请重试。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let metadata: Partial<DisplayMessage> = {};
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const rows = buffer.split("\n");
        buffer = rows.pop() ?? "";
        for (const row of rows) {
          if (!row.trim()) continue;
          const event = JSON.parse(row);
          if (event.type === "meta") metadata = {
            sources: event.sources,
            items: event.items,
            mode: event.mode,
            responseStatus: event.responseStatus,
            claimIds: event.claimIds,
            sourceIds: event.sourceIds,
          };
          if (event.type === "delta") answer += event.content;
          if (event.type === "done") metadata = { ...metadata, responseStatus: event.responseStatus, latencyMs: event.latencyMs };
          if (event.type === "error") throw new Error(event.message);
          setMessages([...nextMessages, { role: "assistant", content: answer, ...metadata }]);
        }
      }
      track("answer_completed", sessionId, "", { ...metadata, questionCategory: inferQuestionCategory(clean) });
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") {
        setError("已停止生成，你可以修改问题后重试。");
      } else {
        const message = caught instanceof Error ? caught.message : "出现未知错误，请重试。";
        setError(message);
        track("chat_error", sessionId, message);
      }
      setMessages((current) => current.filter((message) => message.content));
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  }

  const isEmpty = messages.length === 0;
  const activeQuestions = questionGroups.find((group) => group.id === activeQuestionGroup)?.questions ?? questionGroups[0].questions;
  const askedQuestions = messages.filter((message) => message.role === "user").map((message) => message.content);
  const lastQuestion = askedQuestions[askedQuestions.length - 1] ?? "";
  const followUpQuestions = lastQuestion ? getFollowUpQuestions(lastQuestion, askedQuestions) : [];
  const hasCompletedAnswer = messages.some((message) => message.role === "assistant" && message.content);

  return (
    <div className={`chat-shell ${isEmpty ? "is-empty" : "has-messages"}`}>
      <div className="chat-scroll">
        {isEmpty ? (
          <div className="empty-state">
            <section className="welcome" aria-labelledby="chat-title">
              <div className="evidence-label"><CheckCircleIcon size={16} weight="fill" aria-hidden="true" /> 公开资料已更新</div>
              <h1 id="chat-title">让证据先说话。</h1>
              <p>我是{profile.name}的 AI Career Agent。你可以向我了解并核实他的教育、经历、AI 项目、本人贡献和能力边界。</p>
              <div className="education-line" aria-label={`${profile.school}，985、211、双一流，${profile.major}，${profile.graduation}`}>
                <strong>{profile.school}</strong>
                <span className="school-tags" aria-label="学校标签">
                  {profile.schoolTags.map((tag) => <span key={tag}>{tag}</span>)}
                </span>
                <span className="education-detail">{profile.major}</span>
                <span className="education-detail">{profile.graduation}</span>
              </div>
              <nav className="mobile-contact" aria-label="联系方式">
                <a href={`mailto:${profile.email}`} data-track-event="contact_opened" data-track-detail="email"><EnvelopeSimpleIcon size={15} aria-hidden="true" />邮件</a>
                <a href={`tel:${profile.phone}`} data-track-event="contact_opened" data-track-detail="phone"><PhoneIcon size={15} aria-hidden="true" />电话</a>
                <a href={profile.github} target="_blank" rel="noreferrer" data-track-event="project_opened" data-track-detail="github"><GithubLogoIcon size={15} aria-hidden="true" />GitHub</a>
                <a href="/resume"><FileTextIcon size={15} aria-hidden="true" />简历</a>
              </nav>
            </section>

            <section className="project-proof" aria-labelledby="project-title">
              <div className="proof-heading">
                <h2 id="project-title">可直接核验的项目</h2>
                <a href={profile.github} target="_blank" rel="noreferrer" data-track-event="project_opened" data-track-detail="all-repositories"><GithubLogoIcon size={16} aria-hidden="true" />全部仓库</a>
              </div>
              <div className="project-grid">
                {featuredProjects.map((project) => (
                  <a className="project-link" href={project.url} target="_blank" rel="noreferrer" key={project.name} data-track-event="project_opened" data-track-detail={project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}>
                    <span className="project-status">{project.status}</span>
                    <strong>{project.name}</strong>
                    <p>{project.summary}</p>
                    <small>{project.stack}</small>
                    <ArrowUpRightIcon className="project-arrow" size={18} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </section>

            <section className="question-start" aria-labelledby="question-title">
              <h2 id="question-title">从招聘方最关心的问题开始</h2>
              <div className="question-groups" role="tablist" aria-label="问题分类">
                {questionGroups.map((group) => (
                  <button
                    id={`question-tab-${group.id}`}
                    key={group.id}
                    type="button"
                    role="tab"
                    aria-selected={activeQuestionGroup === group.id}
                    aria-controls="question-panel"
                    onClick={() => setActiveQuestionGroup(group.id)}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
              <div
                className="suggestions"
                id="question-panel"
                role="tabpanel"
                aria-labelledby={`question-tab-${activeQuestionGroup}`}
              >
                {activeQuestions.map((question) => (
                  <button key={question} type="button" onClick={() => void send(question, true)}>
                    <span>{question}</span>
                    <ArrowUpRightIcon size={17} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="messages" aria-live="polite">
            {messages.map((message, index) => (
              <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                {message.role === "assistant" && <span className="assistant-mark" aria-hidden="true">A</span>}
                <div className="message-body">
                  <p className={message.role === "user" ? "sr-only" : "message-role"}>
                    {message.role === "user" ? "你的问题" : "Ask Me"}
                  </p>
                  {message.role === "assistant" && !message.content ? (
                    <div className="skeleton" aria-label="正在生成回答">
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : (
                    <div className="message-content">{message.content}</div>
                  )}
                  {message.mode === "demo" && (
                    <p className="mode-note">当前为演示模式，回答来自本地公开知识库。</p>
                  )}
                  {message.mode === "stable" && (
                    <p className="mode-note">这是结构化证据约束的核心稳定回答，关键事实仍建议面试核实。</p>
                  )}
                  {message.sources && message.sources.length > 0 && (
                    <div className="sources">
                      <p>事实来源</p>
                      {message.sources.map((source) => (
                        <details
                          key={source.id}
                          onToggle={(event) => event.currentTarget.open && track("source_opened", getBrowserSessionId(), source.id)}
                        >
                          <summary>
                            <span>[{source.id}] {source.title}</span>
                            <CaretDownIcon size={15} aria-hidden="true" />
                          </summary>
                          <div className="source-detail">
                            <p>类型：{source.sourceType}</p>
                            <p>验证状态：{verificationLabels[source.verification]}</p>
                            {source.projectStatus && <p>项目状态：{statusLabels[source.projectStatus]}</p>}
                            <p>最后检查：{source.lastChecked}</p>
                            <p>支持事实：{source.supports}</p>
                            <p>证据边界：{source.limitations}</p>
                            {source.url && <a href={source.url} target="_blank" rel="noreferrer">查看公开来源 <ArrowUpRightIcon size={14} aria-hidden="true" /></a>}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
            <div ref={messageEndRef} />
          </div>
        )}
      </div>

      <div className="composer-dock">
        {hasCompletedAnswer && !loading && followUpQuestions.length > 0 && (
          <div className="contextual-suggestions" aria-label="根据上一问题推荐的追问">
            <span>接着了解</span>
            <div>
              {followUpQuestions.map((question) => (
                <button key={question} type="button" onClick={() => void send(question, true)}>{question}</button>
              ))}
            </div>
          </div>
        )}
        {error && <div className="chat-error" role="alert">{error}</div>}
        <form className="composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="question">向 Ask Me 提问</label>
          <textarea
            id="question"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            maxLength={500}
            rows={1}
            placeholder="询问经历、项目、能力或岗位匹配"
            disabled={loading}
          />
          {loading ? (
            <button
              type="button"
              className="send-button stop"
              onClick={() => abortRef.current?.abort()}
              aria-label="停止生成"
              title="停止生成"
            >
              <StopIcon size={16} weight="fill" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              className="send-button"
              disabled={!input.trim()}
              aria-label="发送问题"
              title="发送问题"
            >
              <ArrowUpIcon size={18} weight="bold" aria-hidden="true" />
            </button>
          )}
        </form>
        <p className="composer-note">AI 可能会出错。重要经历与数据请在面试中进一步核实。</p>
      </div>
    </div>
  );
}
