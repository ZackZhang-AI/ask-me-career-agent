"use client";

import {
  ArrowClockwiseIcon,
  ArrowsInLineHorizontalIcon,
  BookOpenTextIcon,
  CheckIcon,
  CopyIcon,
} from "@phosphor-icons/react";

interface AnswerActionsProps {
  copied: boolean;
  evidenceExpanded: boolean;
  hasEvidence: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onCondense: () => void;
  onToggleEvidence: () => void;
}

export function AnswerActions({
  copied,
  evidenceExpanded,
  hasEvidence,
  onCopy,
  onRegenerate,
  onCondense,
  onToggleEvidence,
}: AnswerActionsProps) {
  const actions = [
    {
      label: copied ? "已复制" : "复制回答",
      shortLabel: copied ? "已复制" : "复制",
      icon: copied ? CheckIcon : CopyIcon,
      pressed: copied,
      onClick: onCopy,
    },
    {
      label: "重新回答",
      shortLabel: "重试",
      icon: ArrowClockwiseIcon,
      pressed: false,
      onClick: onRegenerate,
    },
    {
      label: "精简一点",
      shortLabel: "精简",
      icon: ArrowsInLineHorizontalIcon,
      pressed: false,
      onClick: onCondense,
    },
    {
      label: evidenceExpanded ? "收起证据" : "展开证据",
      shortLabel: evidenceExpanded ? "收起依据" : "依据",
      icon: BookOpenTextIcon,
      pressed: evidenceExpanded,
      disabled: !hasEvidence,
      onClick: onToggleEvidence,
    },
  ];

  return (
    <div className="answer-actions" role="group" aria-label="回答操作">
      {actions.map(({ label, shortLabel, icon: Icon, pressed, onClick, disabled = false }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          title={label}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon size={14} weight={pressed ? "bold" : "regular"} aria-hidden="true" />
          <span>{shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
