"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProcessingStage } from "@/lib/types";

const stageLabels: Record<ProcessingStage, string> = {
  understanding: "正在理解这道面试问题",
  checking_evidence: "正在核对相关经历与事实",
  writing_answer: "正在组织面试回答",
  reviewing_answer: "正在进行最终面试质量审校",
};

const longWaitLabels: Record<ProcessingStage, string> = {
  understanding: "仍在理解问题，马上进入经历匹配",
  checking_evidence: "仍在核对经历，避免混入不准确的信息",
  writing_answer: "仍在组织回答，首个安全片段生成后会立即显示",
  reviewing_answer: "仍在审校事实和表达，完成后再展示",
};

export function useThinkingStatus() {
  const [thinkingLabel, setThinkingLabel] = useState(stageLabels.understanding);
  const timersRef = useRef<number[]>([]);

  const clearThinkingTimers = useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  }, []);

  const updateThinkingStage = useCallback((stage: ProcessingStage) => {
    clearThinkingTimers();
    setThinkingLabel(stageLabels[stage]);
    timersRef.current = [window.setTimeout(() => setThinkingLabel(longWaitLabels[stage]), 6_000)];
  }, [clearThinkingTimers]);

  const startThinking = useCallback(() => {
    clearThinkingTimers();
    setThinkingLabel(stageLabels.understanding);
    timersRef.current = [
      window.setTimeout(() => setThinkingLabel(stageLabels.checking_evidence), 1_400),
      window.setTimeout(() => setThinkingLabel(stageLabels.writing_answer), 4_000),
      window.setTimeout(() => setThinkingLabel(longWaitLabels.writing_answer), 7_000),
    ];
  }, [clearThinkingTimers]);

  useEffect(() => clearThinkingTimers, [clearThinkingTimers]);

  return { thinkingLabel, startThinking, updateThinkingStage, clearThinkingTimers };
}
