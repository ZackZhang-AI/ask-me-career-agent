export const feedbackImprovementInstructions = {
  not_relevant: "重新识别原问题的提问动作和核心对象，首段直接回应，不调用无关项目。",
  not_specific: "补充最相关的真实经历、本人行动、关键取舍和判断依据，不增加未记录事实。",
  repetitive: "避开最近已经使用的故事和结论，改用互补证据，并让本轮带来新的判断。",
  missing_evidence: "优先展开可核验的公开依据，明确事实与推演边界，不用泛泛表述替代证据。",
} as const;

export type FeedbackImprovementReason = keyof typeof feedbackImprovementInstructions;

export function isFeedbackImprovementReason(value: unknown): value is FeedbackImprovementReason {
  return typeof value === "string" && value in feedbackImprovementInstructions;
}
