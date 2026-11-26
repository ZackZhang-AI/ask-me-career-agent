"use client";

import {
  ArrowClockwiseIcon,
  ArrowsInLineHorizontalIcon,
  ArrowsOutSimpleIcon,
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
      icon: copied ? CheckIcon : CopyIcon,
      pressed: copied,
      onClick: onCopy,
    },
    {
      label: "重新回答",
      icon: ArrowClockwiseIcon,
      pressed: false,
      onClick: onRegenerate,
    },
    {
      label: "精简一点",
      icon: ArrowsInLineHorizontalIcon,
      pressed: false,
      onClick: onCondense,
    },
    {
      label: evidenceExpanded ? "收起证据" : "展开证据",
      icon: ArrowsOutSimpleIcon,
      pressed: evidenceExpanded,
      disabled: !hasEvidence,
      onClick: onToggleEvidence,
    },
  ];

  return (
    <div className="answer-actions" role="group" aria-label="回答操作">
      {actions.map(({ label, icon: Icon, pressed, onClick, disabled = false }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          title={label}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon size={17} weight={pressed ? "bold" : "regular"} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
