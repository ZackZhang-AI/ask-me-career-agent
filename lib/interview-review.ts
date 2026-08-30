import { z } from "zod";
import type { AnswerPlan } from "./types";

const failedDimensionsSchema = z.array(z.enum([
    "relevance",
    "candidate_voice",
    "evidence_fidelity",
    "interview_persuasion",
    "oral_naturalness",
    "follow_up_resilience",
    "reasoning_boundary",
  ])).max(7);

export const interviewReviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("pass"), failedDimensions: failedDimensionsSchema }),
  z.object({ decision: z.literal("rewrite"), revisedAnswer: z.string().min(40).max(4_000), failedDimensions: failedDimensionsSchema }),
  z.object({ decision: z.literal("reject"), failedDimensions: failedDimensionsSchema }),
]);

export type InterviewReview = z.infer<typeof interviewReviewSchema>;

export function buildReviewPrompt(question: string, candidate: string, plan: AnswerPlan, localTriggers: string[]) {
  return `你是正式面试回答的最终审校员。你只能返回结构化结果，不能解释审校过程。

原问题：${question}
候选回答：${candidate}
本题意图：${plan.intent}
题型：${plan.questionFamily}
事实风险：${plan.factRisk}
回答策略：${plan.answerStrategy}
回答模式：${plan.questionMode}
目标岗位：${plan.targetRole ?? "未指定"}
必须覆盖：${plan.mustInclude.join("；") || "直接回答问题"}
允许事实：${plan.allowedFacts.join("；")}
本地检查问题：${localTriggers.join("；") || "无"}

逐项检查：
1. relevance：第一段直接回答原问题，讨论对象和提问动作一致。
2. candidate_voice：像候选人在正式面试中自然作答，使用第一人称，不像资料摘要或系统说明。
3. evidence_fidelity：没有新增事件、数字、组织、用户反馈、任职范围或结果。
4. interview_persuasion：回答有明确判断、相关经历或方法，以及可迁移价值。
5. oral_naturalness：表达自然、有层次，不机械套模板或堆砌栏目。
6. follow_up_resilience：关键说法能够被后续追问，不使用空泛口号。
7. reasoning_boundary：假设题明确是处理思路，不冒充已经发生的经历。
8. 题型完整性：行为题使用真实 STAR 并准确交代结果边界；情景题有目标、约束、取舍和验证；产品题覆盖用户、问题、最小方案、指标、风险和迭代；业务题覆盖目标、用户链路、关键变量、指标和验证；估算题声明假设并保持计算一致。
9. 边界自然度：未记录个人事实不编造；时效问题明确无法核验实时事实后给出分析框架；不要出现模型、RAG、门禁、证据 ID 等系统措辞。

只有全部通过才能 decision=pass。可以在不新增事实的前提下修好时，decision=rewrite 并给出完整 revisedAnswer；事实不足、明显答非所问且无法可靠修复时 decision=reject。`;
}
