import { normalizeInterviewQuestion } from "../lib/question-normalization";

export const reviewedInterviewAnswerVersion = "2026-09-08.1";

/**
 * Reviewed interview-script bindings. Full answer copy remains in qa.ts so the
 * fast path, citations and dynamic evidence layer share one source of truth.
 */
const reviewedBindings = [
  { stableAnswerId: "A01", aliases: ["请用60秒介绍张倬玮", "60秒了解张倬玮", "请介绍一下你自己", "做个自我介绍"] },
  { stableAnswerId: "A02", aliases: ["你为什么适合AI产品经理岗位", "为什么选择你来做这个岗位", "如果入职你能为团队做什么"] },
  { stableAnswerId: "A07", aliases: ["你如何使用AI编程工具", "AI编程占比多少", "AI写了代码你的价值在哪里"] },
  { stableAnswerId: "A25", aliases: ["请介绍一下你的百度AI产品经理实习", "介绍一下你的百度实习", "你在百度实习期间主要做了什么"] },
  { stableAnswerId: "A28", aliases: ["你在百度实习中具体负责什么", "你在百度实习中具体负责了什么", "你在百度实习中具体负责了哪些工作", "你在百度实习中的个人贡献是什么", "百度实习你具体做了什么"] },
  { stableAnswerId: "A29", aliases: ["你如何分析和归因AI Coding的Bad Case", "模型评测发现问题后你怎么归因"] },
  { stableAnswerId: "A30", aliases: ["你如何证明自动评测结果可信", "Evaluator Agent的评分可靠吗"] },
  { stableAnswerId: "A31", aliases: ["请介绍一下你的RAG知识库项目", "介绍一下医疗RAG项目"] },
  { stableAnswerId: "A35", aliases: ["请介绍一下你的百川智能实习", "介绍一下你的百川实习"] },
  { stableAnswerId: "A36", aliases: ["你的实习和项目是如何串联起来的", "你的经历是怎么串联起来的", "为什么做这些项目"] },
] as const;

const reviewedAnswerByQuestion = new Map(
  reviewedBindings.flatMap((binding) => binding.aliases.map((alias) => [normalizeInterviewQuestion(alias), binding.stableAnswerId] as const)),
);

export function matchReviewedInterviewAnswerId(question: string) {
  return reviewedAnswerByQuestion.get(normalizeInterviewQuestion(question));
}
