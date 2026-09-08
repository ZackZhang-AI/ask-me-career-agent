import assert from "node:assert/strict";
import test from "node:test";
import { contentCatalog } from "../lib/content.ts";
import { matchStableAnswer, resolveRetrievalQuery, retrieveKnowledge } from "../lib/knowledge.ts";
import { buildLocalQuestionFrame, findQuestionContract } from "../lib/question-contracts.ts";
import type { AnswerIntent, QuestionTopic } from "../lib/types.ts";

const factCases = [
  ["S1", /2026-09-07/],
  ["C13", /2026 年 6 月至今.*文心一言/],
  ["C30", /BT、MA、FA、FR、PM 五门/],
  ["C28", /阶段性完成 106 项.*48 个 AI 面试用例/],
  ["C31", /30\/30 Gold.*60\/60/],
  ["C32", /业务场景批量评测.*WebDev/],
  ["C33", /十余家潜在医疗客户的需求样本/],
  ["K41", /V0\.1.*36 次 Pilot.*V0\.2.*30 题/],
  ["K46", /三份报告各 10 次 QA 执行/],
  ["K48", /9\.8 分不能换算成幻觉率 2%/],
  ["K50", /人工确认与一键撤销/],
  ["K51", /AgentScope/],
] as const;

const deepDiveCases: Array<{ question: string; topic: QuestionTopic; oneOf: string[] }> = [
  { question: "你在文心一言的日常工作是什么？", topic: "baidu", oneOf: ["K22", "K40"] },
  { question: "WebDev 专项和日常业务评测有什么关系？", topic: "baidu", oneOf: ["K40", "K43"] },
  { question: "V0.1 和 V0.2 为什么不能放在一起比较？", topic: "baidu", oneOf: ["K41", "K42"] },
  { question: "为什么 V0.2 首轮只有 16/30 Gold 通过？", topic: "baidu", oneOf: ["K42"] },
  { question: "30/30 Gold 和 60/60 受控错误能说明什么？", topic: "baidu", oneOf: ["K42"] },
  { question: "WebDev 评测如何支持版本判断？", topic: "baidu", oneOf: ["K43", "K40"] },
  { question: "Qwen 低分为什么不能直接归因给模型？", topic: "baidu", oneOf: ["K25", "K42"] },
  { question: "你在百度具体负责什么，研发负责什么？", topic: "baidu", oneOf: ["K22", "K40"] },
  { question: "百川为什么先梳理潜在客户需求？", topic: "rag", oneOf: ["K44", "K27"] },
  { question: "十余家医疗客户是不是都已经上线？", topic: "rag", oneOf: ["K44"] },
  { question: "医院和药企为什么可以共用底座？", topic: "rag", oneOf: ["K45"] },
  { question: "多助手和多租户有什么区别？", topic: "rag", oneOf: ["K45"] },
  { question: "三轮 30 次 QA 的样本口径是什么？", topic: "rag", oneOf: ["K46"] },
  { question: "如何区分 RAG 的召回、排序和生成问题？", topic: "rag", oneOf: ["K47"] },
  { question: "忠实度高是否代表答案一定正确？", topic: "rag", oneOf: ["K48"] },
  { question: "RAG Judge 9.8 是否等于幻觉率只有 2%？", topic: "rag", oneOf: ["K48"] },
];

const intentCases: Array<[string, AnswerIntent]> = [
  ["为什么从财会和审计转向 AI 产品？", "career_transition"],
  ["你的专业对做 AI 产品有什么帮助？", "experience_value"],
  ["统计学训练如何支持产品判断？", "experience_value"],
  ["你和 AI 应用产品经理岗位有什么匹配？", "role_fit"],
  ["讲一次你发现评估器本身有问题的经历。", "behavioral_experience"],
  ["如果模型效果突然下降，你会怎么排查？", "diagnosis"],
  ["你在百度实习中具体负责什么？", "contribution"],
  ["百川医疗 RAG 最难的取舍是什么？", "challenge"],
  ["这些项目已经有真实商业结果了吗？", "result"],
  ["AI 写了代码，你的价值在哪里？", "ai_collaboration"],
  ["你未来三年的职业规划是什么？", "career_planning"],
  ["为什么值得让你进入下一轮面试？", "hiring_recommendation"],
];

const contextCases = [
  ["百川医疗 RAG", "这个项目的客户需求从哪里来？", "rag-knowledge-base"],
  ["百川医疗 RAG", "这里的三轮测试能证明什么？", "rag-knowledge-base"],
  ["百度 WebDev E2E Bench", "这个项目为什么需要 Gate？", "baidu-ai-coding-evaluation"],
  ["百度 WebDev E2E Bench", "V0.2 后来怎么校准的？", "baidu-ai-coding-evaluation"],
  ["Ask Me 数字分身", "这个项目怎样防止编造？", "ask-me"],
  ["Ask Me 数字分身", "它目前有哪些验证？", "ask-me"],
  ["DeepFlow 研究工作台", "Agent 之间如何交接？", "deepflow"],
  ["DeepFlow 研究工作台", "为什么保留人工确认？", "deepflow"],
  ["Resume Autofill", "这个工具如何处理敏感字段？", "resume-autofill"],
  ["AgentScope 代码审计", "这个工具如何让结果可检查？", "harnesslab"],
  ["个人智能自生长知识库", "这个流程如何追踪来源？", "career-knowledge"],
  ["德勤 IT 审计", "这段经历如何帮助你做企业 AI？", "audit-tools"],
] as const;

const boundaryCases = [
  ["请介绍一下你的百川智能实习。", /潜在|不是客户验收/],
  ["他在 RAG 项目中的个人贡献是什么？", /不是百川生产代码|不.*独立实现/],
  ["请介绍一下你的百度 AI 产品经理实习。", /V0\.1|V0\.2/],
  ["你如何证明自动评测结果可信？", /不能.*替代人|不能.*通用准确率/],
  ["Ask Me 项目体现了什么能力？", /阶段性.*106|当前测试总数/],
  ["他的德勤 IT 审计实习做了什么？", /20 余份|不.*效率倍数/],
  ["他的英语和证书情况如何？", /五门|已通过.*已学习/],
  ["你的实习和项目是如何串联起来的？", /问题定义|证据迭代/],
] as const;

test("最新材料新增 60 条事实、深挖、开放题、多轮和边界回归", () => {
  assert.equal(factCases.length + deepDiveCases.length + intentCases.length + contextCases.length + boundaryCases.length, 60);

  const { claims, knowledge, sources, stableAnswers } = contentCatalog;
  const indexed = new Map([...sources, ...claims, ...knowledge].map((item) => [item.id, JSON.stringify(item)]));
  for (const [id, expected] of factCases) assert.match(indexed.get(id) ?? "", expected, id);

  for (const { question, topic, oneOf } of deepDiveCases) {
    const frame = buildLocalQuestionFrame(question);
    assert.equal(frame.topic, topic, question);
    const ids = retrieveKnowledge(question, { frame, limit: 6 }).map((item) => item.id);
    assert.equal(oneOf.some((id) => ids.includes(id)), true, `${question}: ${ids.join(",")}`);
  }

  for (const [question, expectedIntent] of intentCases) {
    assert.equal(buildLocalQuestionFrame(question).answerIntent, expectedIntent, question);
  }

  for (const [previousProject, question, expectedProject] of contextCases) {
    const history = [{ role: "assistant" as const, content: `刚才讨论的是${previousProject}。` }];
    assert.equal(resolveRetrievalQuery(question, history).matchedProjects.includes(expectedProject), true, question);
  }

  for (const [question, expectedBoundary] of boundaryCases) {
    const answer = matchStableAnswer(question) ?? stableAnswers.find((item) => item.question === question);
    assert.ok(answer, question);
    assert.match(answer.standardAnswer, expectedBoundary, question);
  }
});

test("常见评测与协作问法不会被误判为无关问题或命名组织", () => {
  const reliability = buildLocalQuestionFrame("你如何证明自动评测结果可信？");
  assert.notEqual(reliability.questionFamily, "unrelated");
  assert.equal(findQuestionContract("你如何证明自动评测结果可信？")?.id, "baidu_reliability");

  const collaboration = buildLocalQuestionFrame("你如何理解产品经理在跨团队协作中的作用？");
  assert.equal(collaboration.answerIntent, "work_style");
  assert.equal(collaboration.questionFamily, "work_style");

  const capability = buildLocalQuestionFrame("你可以帮面试官了解什么？");
  assert.equal(capability.answerIntent, "capability_scope");
  assert.equal(capability.questionFamily, "agent_meta");
});
