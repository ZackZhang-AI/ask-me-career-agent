"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  GithubLogoIcon,
  HouseIcon,
  PhoneIcon,
  SparkleIcon,
  StopIcon,
} from "@phosphor-icons/react";
import { AnswerActions } from "./answer-actions";
import { EvidencePanel } from "./evidence-panel";
import { FormattedAnswer } from "./formatted-answer";
import { useConversationControl } from "./conversation-control";
import { featuredProjects, profile } from "@/lib/profile";
import { getBrowserSessionId } from "@/lib/client-session";
import { isNearScrollBottom, prepareQuestionMessages, presetRevealChunks } from "@/lib/chat-session";
import type { ConversationMessage } from "@/lib/conversation-history";
import {
  getHrFollowUpQuestions,
  inferQuestionCategory,
  questionGroups,
  type QuestionGroupId,
} from "@/lib/question-suggestions";
import type { PresetAnswerPacket } from "@/lib/types";

interface ChatProps {
  presetAnswers: PresetAnswerPacket[];
}

const feedbackReasons = [
  { id: "not_relevant", label: "答非所问" },
  { id: "not_specific", label: "不够具体" },
  { id: "repetitive", label: "内容重复" },
  { id: "missing_evidence", label: "证据不足" },
] as const;

const PRESET_REVEAL_INTERVAL_MS = 26;
const PRESET_THINKING_MS = 420;

function waitFor(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function track(event: string, sessionId: string, detail = "", metadata: Partial<ConversationMessage> & { questionCategory?: string } = {}) {
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
      firstTokenLatencyMs: metadata.firstTokenLatencyMs,
      deliveryPath: metadata.deliveryPath,
      contractId: metadata.contractId,
      questionCategory: metadata.questionCategory,
    }),
    keepalive: true,
  });
}

export function Chat({ presetAnswers }: ChatProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryQuestion, setRetryQuestion] = useState("");
  const [activeQuestionGroup, setActiveQuestionGroup] = useState<QuestionGroupId>("screening");
  const [answerFeedback, setAnswerFeedback] = useState<Record<number, "helpful" | "not_helpful">>({});
  const [answerFeedbackReason, setAnswerFeedbackReason] = useState<Record<number, string>>({});
  const [copiedAnswer, setCopiedAnswer] = useState<number | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<Record<number, boolean>>({});
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState("正在检索相关经历与项目证据");
  const abortRef = useRef<AbortController | null>(null);
  const thinkingTimersRef = useRef<number[]>([]);
  const conversationEpochRef = useRef(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const shouldFollowRef = useRef(true);
  const handledCommandRef = useRef(0);
  const { command, persistConversation } = useConversationControl();

  const clearThinkingTimers = useCallback(() => {
    for (const timer of thinkingTimersRef.current) window.clearTimeout(timer);
    thinkingTimersRef.current = [];
  }, []);

  useEffect(() => {
    if (!shouldFollowRef.current) return;
    const frame = requestAnimationFrame(() => messageEndRef.current?.scrollIntoView({ block: "end" }));
    return () => cancelAnimationFrame(frame);
  }, [messages]);

  useEffect(() => () => {
    clearThinkingTimers();
    abortRef.current?.abort();
  }, [clearThinkingTimers]);

  const send = useCallback(async (
    question: string,
    fromSuggestion = false,
    retry = false,
    baseMessages?: ConversationMessage[],
  ) => {
    const clean = question.trim();
    if (!clean || loading) return;
    const currentMessages = baseMessages ?? messages;
    const sessionId = getBrowserSessionId();
    const conversationEpoch = conversationEpochRef.current;
    const startedAt = performance.now();

    setInput("");
    setError("");
    setRetryQuestion("");
    setLoading(true);
    shouldFollowRef.current = true;
    setShowScrollToLatest(false);
    setThinkingLabel("正在检索相关经历与项目证据");
    clearThinkingTimers();
    thinkingTimersRef.current = [
      window.setTimeout(() => setThinkingLabel("正在组织正式面试回答"), 1_400),
      window.setTimeout(() => setThinkingLabel("正在核验事实与表达"), 4_000),
    ];
    const nextMessages = baseMessages
      ? [...baseMessages, { role: "user" as const, content: clean }]
      : prepareQuestionMessages(currentMessages, clean, retry) as ConversationMessage[];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    persistConversation(nextMessages);
    track(fromSuggestion ? "suggestion_clicked" : "question_sent", sessionId, "", { questionCategory: inferQuestionCategory(clean) });
    if (!retry && currentMessages.some((message) => message.role === "user")) track("followup_sent", sessionId);

    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const preset = !retry && currentMessages.length === 0
        ? presetAnswers.find((answer) => answer.question === clean)
        : undefined;
      if (preset) {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const chunks = reduceMotion ? [preset.content] : presetRevealChunks(preset.content);
        await waitFor(PRESET_THINKING_MS, abort.signal);
        if (conversationEpoch !== conversationEpochRef.current) return;
        let answer = chunks[0] ?? preset.content;
        const streamingMetadata: Partial<ConversationMessage> = {
          mode: preset.mode,
          claimIds: preset.claimIds,
          sourceIds: preset.sourceIds,
          contractId: preset.contractId,
          deliveryPath: "preset",
          firstTokenLatencyMs: Math.round(performance.now() - startedAt),
        };
        setMessages([...nextMessages, { role: "assistant", content: answer, ...streamingMetadata }]);
        for (const chunk of chunks.slice(1)) {
          await waitFor(PRESET_REVEAL_INTERVAL_MS, abort.signal);
          if (conversationEpoch !== conversationEpochRef.current) return;
          answer += chunk;
          setMessages([...nextMessages, { role: "assistant", content: answer, ...streamingMetadata }]);
        }
        const completedMetadata: Partial<ConversationMessage> = {
          ...streamingMetadata,
          sources: preset.sources,
          responseStatus: preset.responseStatus,
          citations: preset.citations,
          followUpQuestions: preset.followUpQuestions,
          latencyMs: Math.round(performance.now() - startedAt),
        };
        const completedMessages = [...nextMessages, { role: "assistant" as const, content: answer, ...completedMetadata }];
        setMessages(completedMessages);
        persistConversation(completedMessages);
        track("answer_completed", sessionId, "", { ...completedMetadata, questionCategory: inferQuestionCategory(clean) });
        return;
      }

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
      let metadata: Partial<ConversationMessage> = {};
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
          if (event.type === "delta") {
            if (!answer) metadata = {
              ...metadata,
              deliveryPath: "api",
              firstTokenLatencyMs: Math.round(performance.now() - startedAt),
            };
            answer += event.content;
          }
          if (event.type === "done") metadata = { ...metadata, responseStatus: event.responseStatus, latencyMs: event.latencyMs };
          if (event.type === "error") throw new Error(event.message);
          setMessages([...nextMessages, { role: "assistant", content: answer, ...metadata }]);
        }
      }
      const completedMessages = [...nextMessages, { role: "assistant" as const, content: answer, ...metadata }];
      setMessages(completedMessages);
      persistConversation(completedMessages);
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
      setMessages((current) => {
        const completed = current.filter((message) => message.content);
        persistConversation(completed);
        return completed;
      });
    } finally {
      if (conversationEpoch === conversationEpochRef.current) {
        clearThinkingTimers();
        setLoading(false);
        abortRef.current = null;
      }
    }
  }, [clearThinkingTimers, loading, messages, persistConversation, presetAnswers]);

  const resetConversation = useCallback(() => {
    conversationEpochRef.current += 1;
    clearThinkingTimers();
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
    setCopiedAnswer(null);
    setExpandedEvidence({});
    setShowScrollToLatest(false);
    shouldFollowRef.current = true;
    window.history.replaceState(null, "", `${window.location.pathname}#top`);
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      document.getElementById("top")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [clearThinkingTimers]);

  const loadConversation = useCallback((storedMessages: ConversationMessage[]) => {
    conversationEpochRef.current += 1;
    clearThinkingTimers();
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages(storedMessages);
    setInput("");
    setError("");
    setRetryQuestion("");
    setLoading(false);
    setAnswerFeedback({});
    setAnswerFeedbackReason({});
    setCopiedAnswer(null);
    setExpandedEvidence({});
    setShowScrollToLatest(false);
    shouldFollowRef.current = true;
    requestAnimationFrame(() => messageEndRef.current?.scrollIntoView({ block: "end" }));
  }, [clearThinkingTimers]);

  useEffect(() => {
    if (!command || handledCommandRef.current === command.id) return;
    if (command.type === "ask" && loading) return;
    const frame = requestAnimationFrame(() => {
      handledCommandRef.current = command.id;
      if (command.type === "reset") resetConversation();
      else if (command.type === "load") loadConversation(command.messages);
      else void send(command.question, true);
    });
    return () => cancelAnimationFrame(frame);
  }, [command, loading, loadConversation, resetConversation, send]);

  function handleScroll() {
    const scroll = chatScrollRef.current;
    if (!scroll) return;
    const nearBottom = isNearScrollBottom(scroll.scrollHeight, scroll.scrollTop, scroll.clientHeight);
    shouldFollowRef.current = nearBottom;
    setShowScrollToLatest(!nearBottom);
  }

  function scrollToLatest() {
    shouldFollowRef.current = true;
    setShowScrollToLatest(false);
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  async function copyAnswer(index: number, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedAnswer(index);
      window.setTimeout(() => setCopiedAnswer((current) => current === index ? null : current), 1_600);
    } catch {
      setError("复制失败，请选中文字后手动复制。");
    }
  }

  function answerQuestionContext(answerIndex: number) {
    for (let index = answerIndex - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === "user") {
        return {
          question: messages[index].content,
          baseMessages: messages.slice(0, index),
        };
      }
    }
    return null;
  }

  function regenerateAnswer(answerIndex: number) {
    const context = answerQuestionContext(answerIndex);
    if (!context) return;
    void send(context.question, false, true, context.baseMessages);
  }

  function condenseAnswer(answerIndex: number) {
    const baseMessages = messages.slice(0, answerIndex + 1);
    void send("请把上一条回答精简为 3 个重点，保留结论和关键证据。", true, false, baseMessages);
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
  const followUpQuestions = lastQuestion
    ? getHrFollowUpQuestions(lastQuestion, askedQuestions, latestAssistant?.followUpQuestions)
    : [];
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
              <article
                className={`message ${message.role}${message.role === "assistant" && message.content && !message.responseStatus ? " streaming" : ""}`}
                key={`${message.role}-${index}`}
              >
                {message.role === "assistant" && <span className="assistant-mark" aria-hidden="true">A</span>}
                <div className="message-body">
                  <p className={message.role === "user" ? "sr-only" : "message-role"}>
                    {message.role === "user" ? "你的问题" : "Ask Me"}
                  </p>
                  {message.role === "assistant" && !message.content ? (
                    <div className="thinking-state" role="status" aria-live="polite">
                      <span className="thinking-indicator" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                      <span>{thinkingLabel}</span>
                    </div>
                  ) : (
                    message.role === "assistant"
                      ? (
                          <FormattedAnswer
                            content={message.content}
                            citations={message.citations}
                            sources={message.sources}
                            onCitationClick={(sourceId) => {
                              setExpandedEvidence((current) => ({ ...current, [index]: true }));
                              requestAnimationFrame(() => {
                                const sourceElement = document.getElementById(`source-${index}-${sourceId}`) as HTMLDetailsElement | null;
                                if (!sourceElement) return;
                                sourceElement.open = true;
                                sourceElement.scrollIntoView({ behavior: "smooth", block: "center" });
                              });
                            }}
                          />
                        )
                      : <div className="message-content">{message.content}</div>
                  )}
                  {message.role === "assistant" && message.content && message.responseStatus && (
                    <AnswerActions
                      copied={copiedAnswer === index}
                      evidenceExpanded={Boolean(expandedEvidence[index])}
                      hasEvidence={Boolean(message.sources?.length)}
                      onCopy={() => void copyAnswer(index, message.content)}
                      onRegenerate={() => regenerateAnswer(index)}
                      onCondense={() => condenseAnswer(index)}
                      onToggleEvidence={() => setExpandedEvidence((current) => ({
                        ...current,
                        [index]: !current[index],
                      }))}
                    />
                  )}
                  {message.sources && message.sources.length > 0 && (
                    <EvidencePanel
                      answerIndex={index}
                      sources={message.sources}
                      expanded={Boolean(expandedEvidence[index])}
                      onExpandedChange={(expanded) => setExpandedEvidence((current) => ({
                        ...current,
                        [index]: expanded,
                      }))}
                      onSourceOpen={(sourceId) => track("source_opened", getBrowserSessionId(), sourceId)}
                    />
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
          <section className="contextual-suggestions" aria-labelledby="follow-up-title">
            <div className="contextual-suggestions-heading">
              <span className="contextual-suggestions-icon" aria-hidden="true">
                <SparkleIcon size={15} weight="fill" />
              </span>
              <span>
                <strong id="follow-up-title">继续了解张倬玮</strong>
                <small>从证据、复盘和岗位匹配继续追问</small>
              </span>
            </div>
            <div className="contextual-suggestions-list">
              {followUpQuestions.map((suggestion) => (
                <button key={suggestion.kind} type="button" onClick={() => void send(suggestion.question, true)}>
                  <small>{suggestion.label}</small>
                  <span>{suggestion.question}</span>
                  <ArrowUpRightIcon size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
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
      {showScrollToLatest && !isEmpty && (
        <button
          className="scroll-to-latest"
          type="button"
          aria-label="回到最新回答"
          title="回到最新回答"
          onClick={scrollToLatest}
        >
          <ArrowDownIcon size={17} weight="bold" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
