"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpIcon,
  ArrowUpRightIcon,
  CaretDownIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  GithubLogoIcon,
  HouseIcon,
  PhoneIcon,
  StopIcon,
} from "@phosphor-icons/react";
import { FormattedAnswer } from "./formatted-answer";
import { useConversationControl } from "./conversation-control";
import { featuredProjects, profile } from "@/lib/profile";
import { getBrowserSessionId } from "@/lib/client-session";
import { isNearScrollBottom, prepareQuestionMessages } from "@/lib/chat-session";
import {
  getFollowUpQuestions,
  inferQuestionCategory,
  questionGroups,
  type QuestionGroupId,
} from "@/lib/question-suggestions";
import type { AnswerCitation, ChatMessage, KnowledgeItem, ResponseStatus, Source } from "@/lib/types";

interface DisplayMessage extends ChatMessage {
  sources?: Source[];
  items?: KnowledgeItem[];
  mode?: "live" | "stable" | "demo" | "guardrail";
  responseStatus?: ResponseStatus;
  claimIds?: string[];
  sourceIds?: string[];
  citations?: AnswerCitation[];
  latencyMs?: number;
  followUpQuestions?: string[];
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

const feedbackReasons = [
  { id: "not_relevant", label: "答非所问" },
  { id: "not_specific", label: "不够具体" },
  { id: "repetitive", label: "内容重复" },
  { id: "missing_evidence", label: "证据不足" },
] as const;

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
  const [retryQuestion, setRetryQuestion] = useState("");
  const [activeQuestionGroup, setActiveQuestionGroup] = useState<QuestionGroupId>("screening");
  const [answerFeedback, setAnswerFeedback] = useState<Record<number, "helpful" | "not_helpful">>({});
  const [answerFeedbackReason, setAnswerFeedbackReason] = useState<Record<number, string>>({});
  const abortRef = useRef<AbortController | null>(null);
  const conversationEpochRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const shouldFollowRef = useRef(true);
  const handledCommandRef = useRef(0);
  const { command } = useConversationControl();

  useEffect(() => {
    if (!shouldFollowRef.current) return;
    const frame = requestAnimationFrame(() => messageEndRef.current?.scrollIntoView({ block: "end" }));
    return () => cancelAnimationFrame(frame);
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(async (question: string, fromSuggestion = false, retry = false) => {
    const clean = question.trim();
    if (!clean || loading) return;
    const sessionId = getBrowserSessionId();
    const conversationEpoch = conversationEpochRef.current;

    setInput("");
    setError("");
    setRetryQuestion("");
    setLoading(true);
    shouldFollowRef.current = true;
    const nextMessages = prepareQuestionMessages(messages, clean, retry) as DisplayMessage[];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    track(fromSuggestion ? "suggestion_clicked" : "question_sent", sessionId, "", { questionCategory: inferQuestionCategory(clean) });
    if (!retry && messages.some((message) => message.role === "user")) track("followup_sent", sessionId);

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
        if (conversationEpoch !== conversationEpochRef.current) {
          await reader.cancel();
          return;
        }
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
            citations: event.citations,
            followUpQuestions: event.followUpQuestions,
          };
          if (event.type === "delta") answer += event.content;
          if (event.type === "done") metadata = { ...metadata, responseStatus: event.responseStatus, latencyMs: event.latencyMs };
          if (event.type === "error") throw new Error(event.message);
          setMessages([...nextMessages, { role: "assistant", content: answer, ...metadata }]);
        }
      }
      track("answer_completed", sessionId, "", { ...metadata, questionCategory: inferQuestionCategory(clean) });
    } catch (caught) {
      if (conversationEpoch !== conversationEpochRef.current) return;
      setRetryQuestion(clean);
      if (caught instanceof Error && caught.name === "AbortError") {
        setError("回答未完整生成，已按你的操作停止。");
      } else {
        const message = caught instanceof Error ? caught.message : "出现未知错误，请重试。";
        setError(`回答未完整生成。${message}`);
        track("chat_error", sessionId, message);
      }
      setMessages((current) => current.filter((message) => message.content));
    } finally {
      if (conversationEpoch === conversationEpochRef.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [loading, messages]);

  const resetConversation = useCallback(() => {
    conversationEpochRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setInput("");
    setError("");
    setRetryQuestion("");
    setLoading(false);
    setActiveQuestionGroup("screening");
    setAnswerFeedback({});
    setAnswerFeedbackReason({});
    shouldFollowRef.current = true;
    window.history.replaceState(null, "", `${window.location.pathname}#top`);
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      document.getElementById("top")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    if (!command || handledCommandRef.current === command.id) return;
    if (command.type === "ask" && loading) return;
    const frame = requestAnimationFrame(() => {
      handledCommandRef.current = command.id;
      if (command.type === "reset") resetConversation();
      else void send(command.question, true);
    });
    return () => cancelAnimationFrame(frame);
  }, [command, loading, resetConversation, send]);

  function handleScroll() {
    const scroll = chatScrollRef.current;
    if (!scroll) return;
    shouldFollowRef.current = isNearScrollBottom(scroll.scrollHeight, scroll.scrollTop, scroll.clientHeight);
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
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant" && message.content);
  const followUpQuestions = latestAssistant?.followUpQuestions?.filter((question) => !askedQuestions.includes(question)).slice(0, 3)
    ?? (lastQuestion ? getFollowUpQuestions(lastQuestion, askedQuestions) : []);
  const hasCompletedAnswer = !error && messages.some((message) => message.role === "assistant" && message.content);

  return (
    <div className={`chat-shell ${isEmpty ? "is-empty" : "has-messages"}`}>
      {!isEmpty && (
        <button className="return-home" type="button" onClick={resetConversation}>
          <HouseIcon size={15} weight="bold" aria-hidden="true" />
          回到主页
        </button>
      )}
      <div className="chat-scroll" ref={chatScrollRef} onScroll={handleScroll}>
        {isEmpty ? (
          <div className="empty-state">
            <section className="welcome" aria-labelledby="chat-title">
              <div className="evidence-label"><CheckCircleIcon size={16} weight="fill" aria-hidden="true" /> 公开资料已更新</div>
              <h1 id="chat-title">我是{profile.name}的 AI Career Agent</h1>
              <p className="welcome-description">你可以向我了解他的教育经历、AI 项目、实习经验、能力优势等。</p>
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

            <section className="question-start" aria-labelledby="question-title">
              <h2 id="question-title">从您可能最关心的问题开始吧。</h2>
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
                    message.role === "assistant"
                      ? (
                          <FormattedAnswer
                            content={message.content}
                            citations={message.citations}
                            sources={message.sources}
                            onCitationClick={(sourceId) => {
                              const sourceElement = document.getElementById(`source-${index}-${sourceId}`) as HTMLDetailsElement | null;
                              if (!sourceElement) return;
                              sourceElement.open = true;
                              sourceElement.scrollIntoView({ behavior: "smooth", block: "center" });
                            }}
                          />
                        )
                      : <div className="message-content">{message.content}</div>
                  )}
                  {message.sources && message.sources.length > 0 && (
                    <div className="sources">
                      <p>进一步了解</p>
                      {message.sources.map((source) => (
                        <details
                          id={`source-${index}-${source.id}`}
                          key={source.id}
                          onToggle={(event) => event.currentTarget.open && track("source_opened", getBrowserSessionId(), source.id)}
                        >
                          <summary>
                            <span>{source.title}</span>
                            <CaretDownIcon size={15} aria-hidden="true" />
                          </summary>
                          <div className="source-detail">
                            <dl className="source-facts">
                              <div><dt>验证方式</dt><dd>{verificationLabels[source.verification]}</dd></div>
                              {source.projectStatus && <div><dt>项目状态</dt><dd>{statusLabels[source.projectStatus]}</dd></div>}
                              <div><dt>可核验内容</dt><dd>{source.supports}</dd></div>
                              <div><dt>当前不能证明</dt><dd>{source.limitations}</dd></div>
                            </dl>
                            <p className="source-checked">最后检查：{source.lastChecked}</p>
                            {source.url && <a href={source.url} target="_blank" rel="noreferrer">查看公开来源 <ArrowUpRightIcon size={14} aria-hidden="true" /></a>}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                  {message.role === "assistant" && message.content && message.responseStatus === "completed" && (
                    <div className="answer-feedback" aria-label="回答反馈">
                      <span>这个回答有帮助吗？</span>
                      <button
                        type="button"
                        aria-pressed={answerFeedback[index] === "helpful"}
                        onClick={() => {
                          setAnswerFeedback((current) => ({ ...current, [index]: "helpful" }));
                          track("answer_feedback", getBrowserSessionId(), "helpful");
                        }}
                      >有帮助</button>
                      <button
                        type="button"
                        aria-pressed={answerFeedback[index] === "not_helpful"}
                        onClick={() => {
                          setAnswerFeedback((current) => ({ ...current, [index]: "not_helpful" }));
                        }}
                      >需改进</button>
                      {answerFeedback[index] === "not_helpful" && (
                        <div className="feedback-reasons" aria-label="选择需要改进的原因">
                          {feedbackReasons.map((reason) => (
                            <button
                              key={reason.id}
                              type="button"
                              aria-pressed={answerFeedbackReason[index] === reason.id}
                              disabled={Boolean(answerFeedbackReason[index])}
                              onClick={() => {
                                setAnswerFeedbackReason((current) => ({ ...current, [index]: reason.id }));
                                track("answer_feedback", getBrowserSessionId(), reason.id);
                              }}
                            >{reason.label}</button>
                          ))}
                        </div>
                      )}
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
        {error && (
          <div className="chat-error" role="alert">
            <span>{error}</span>
            {retryQuestion && !loading && (
              <button type="button" onClick={() => void send(retryQuestion, false, true)}>重新生成</button>
            )}
          </div>
        )}
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
