"use client";

import { CaretDownIcon, ArrowUpRightIcon } from "@phosphor-icons/react";
import type { Source } from "@/lib/types";

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

interface EvidencePanelProps {
  answerIndex: number;
  sources: Source[];
  expanded: boolean;
  highlightedSourceId?: string | null;
  onExpandedChange: (expanded: boolean) => void;
  onSourceOpen: (sourceId: string) => void;
}

export function EvidencePanel({
  answerIndex,
  sources,
  expanded,
  highlightedSourceId,
  onExpandedChange,
  onSourceOpen,
}: EvidencePanelProps) {
  if (sources.length === 0) return null;
  const keySources = sources.slice(0, 2);

  return (
    <div className="sources">
      <details
        className="evidence-group"
        open={expanded}
        onToggle={(event) => onExpandedChange(event.currentTarget.open)}
      >
        <summary>
          <span className="evidence-summary-title">
            核验依据
            <small className="evidence-count">{sources.length}</small>
          </span>
          <span className="evidence-preview" aria-label="关键依据">
            {keySources.map((source, idx) => (
              <span key={source.id}>
                <em>{idx + 1}</em>
                {source.title}
              </span>
            ))}
            {sources.length > keySources.length && <small>+{sources.length - keySources.length}</small>}
          </span>
          <CaretDownIcon size={14} aria-hidden="true" />
        </summary>
        <div className="evidence-list">
          {sources.map((source, sourceIdx) => (
            <details
              id={`source-${answerIndex}-${source.id}`}
              className={`source-item${highlightedSourceId === source.id ? " is-highlighted" : ""}`}
              key={source.id}
              onToggle={(event) => event.currentTarget.open && onSourceOpen(source.id)}
            >
              <summary>
                <span className="source-summary-main">
                  <span className="source-index" aria-hidden="true">{sourceIdx + 1}</span>
                  <span className="source-title-text">{source.title}</span>
                </span>
                <span className="source-summary-meta">
                  <span className={`source-badge is-${source.verification}`}>
                    {verificationLabels[source.verification]}
                  </span>
                  <CaretDownIcon size={14} aria-hidden="true" />
                </span>
              </summary>
              <div className="source-detail">
                <dl className="source-facts">
                  <div><dt>验证方式</dt><dd>{verificationLabels[source.verification]}</dd></div>
                  {source.projectStatus && <div><dt>项目状态</dt><dd>{statusLabels[source.projectStatus]}</dd></div>}
                  <div><dt>可核验内容</dt><dd>{source.supports}</dd></div>
                  <div><dt>当前不能证明</dt><dd>{source.limitations}</dd></div>
                </dl>
                <div className="source-detail-footer">
                  <p className="source-checked">最后检查：{source.lastChecked}</p>
                  {source.url && (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      查看公开来源 <ArrowUpRightIcon size={13} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            </details>
          ))}
        </div>
      </details>
    </div>
  );
}
