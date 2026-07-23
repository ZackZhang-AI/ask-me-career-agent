export type QuestionCategory = "profile" | "fit" | "project" | "experience" | "skills" | "gaps" | "security" | "other";
export type HrFollowUpKind = "evidence" | "retrospective" | "fit";

export interface HrFollowUpSuggestion {
  kind: HrFollowUpKind;
  label: string;
  question: string;
}

export const questionGroups = [
  {
    id: "screening",
    label: "快速判断",
    questions: [
      "请介绍一下你自己。",
      "你为什么适合 AI 产品经理岗位？",
      "哪个项目最能代表你的 AI 产品能力？",
      "你在代表项目中负责哪些核心工作？",
    ],
  },
  {
    id: "projects",
    label: "项目与贡献",
    questions: [
      "哪个项目最能代表你的 AI 产品能力？",
      "你如何把业务问题转化为 AI 产品方案？",
      "你在代表项目中负责哪些核心工作？",
      "你如何评估并改进 AI 产品效果？",
    ],
  },
  {
    id: "experience",
    label: "经历与业务",
    questions: [
      "应用统计学背景如何帮助你做 AI 产品？",
      "审计经历如何帮助你做 AI 产品？",
      "你的实习经历沉淀了哪些可迁移能力？",
      "你的教育与项目经历形成了怎样的能力组合？",
    ],
  },
  {
    id: "capabilities",
    label: "能力亮点",
    questions: [
      "你的核心技术能力有哪些？",
      "你在数据分析与 AI 评测方面有哪些实践？",
      "你对企业级 AI 场景有哪些理解？",
      "你如何使用 AI 编程工具提升交付效率？",
    ],
  },
] as const;

export type QuestionGroupId = (typeof questionGroups)[number]["id"];

const followUpsByCategory: Record<QuestionCategory, readonly string[]> = {
  profile: [
    "他为什么适合 AI 产品经理岗位？",
    "哪个项目最能代表他的 AI 产品能力？",
    "他最值得面试官关注的三项优势是什么？",
  ],
  fit: [
    "哪个项目最能代表他的 AI 产品能力？",
    "他能为 AI 产品团队带来什么价值？",
    "他如何把业务问题转化为 AI 产品方案？",
  ],
  project: [
    "他在代表项目中负责哪些核心工作？",
    "他如何评估并改进 AI 产品效果？",
    "他如何把业务问题转化为 AI 产品方案？",
  ],
  experience: [
    "他的实习经历沉淀了哪些可迁移能力？",
    "审计经历如何帮助他做 AI 产品？",
    "应用统计学背景如何帮助他做 AI 产品？",
  ],
  skills: [
    "他在数据分析与 AI 评测方面有哪些实践？",
    "他对企业级 AI 场景有哪些理解？",
    "他如何使用 AI 编程工具提升交付效率？",
  ],
  gaps: [
    "他最值得面试官关注的三项优势是什么？",
    "哪个项目最能代表他的 AI 产品能力？",
    "他能为 AI 产品团队带来什么价值？",
  ],
  security: [
    "他对企业级 AI 场景有哪些理解？",
    "他如何使用 AI 编程工具提升交付效率？",
    "他在数据分析与 AI 评测方面有哪些实践？",
  ],
  other: [
    "60 秒了解张倬玮。",
    "他为什么适合 AI 产品经理岗位？",
    "哪个项目最能代表他的 AI 产品能力？",
  ],
};

const evergreenRecruiterQuestions = [
  "他最能胜任哪些 AI 产品工作？",
  "他的统计学背景能怎样支持产品决策？",
  "他如何把审计经验迁移到企业 AI 场景？",
  "他有哪些可以直接演示的项目成果？",
  "RAG 项目体现了他哪些产品方法？",
  "DeepFlow 体现了他哪些多 Agent 产品思考？",
  "他如何定义并验收 AI 产品效果？",
  "他在需求分析和方案设计方面有哪些实践？",
  "他如何平衡原型速度与交付质量？",
  "他适合从哪些业务场景开始创造价值？",
  "他与技术团队协作时可以承担哪些职责？",
  "他的经历形成了哪些差异化能力组合？",
] as const;

const explorationQuestionsByCategory: Record<QuestionCategory, readonly string[]> = {
  profile: [
    "RAG 项目体现了他哪些产品方法？",
    "他在数据分析与 AI 评测方面有哪些实践？",
  ],
  fit: [
    "审计经历如何帮助他做 AI 产品？",
    "DeepFlow 体现了他哪些多 Agent 产品思考？",
  ],
  project: [
    "审计经历如何帮助他做 AI 产品？",
    "他的统计学背景能怎样支持产品决策？",
    "他为什么适合 AI 产品经理岗位？",
  ],
  experience: [
    "RAG 项目体现了他哪些产品方法？",
    "DeepFlow 体现了他哪些多 Agent 产品思考？",
  ],
  skills: [
    "他有哪些可以直接演示的项目成果？",
    "审计经历如何帮助他做 AI 产品？",
  ],
  gaps: [
    "他最值得面试官关注的三项优势是什么？",
    "哪个项目最能代表他的 AI 产品能力？",
  ],
  security: [
    "他对企业级 AI 场景有哪些理解？",
    "哪个项目最能代表他的 AI 产品能力？",
  ],
  other: [
    "哪个项目最能代表他的 AI 产品能力？",
    "他的实习经历沉淀了哪些可迁移能力？",
  ],
};

export const recommendationQuestionCandidates = [...new Set([
  ...questionGroups.flatMap((group) => group.questions),
  ...Object.values(followUpsByCategory).flat(),
  ...evergreenRecruiterQuestions,
  ...Object.values(explorationQuestionsByCategory).flat(),
])];

function toCandidatePerspective(question: string) {
  return question
    .replace(/^最难的产品取舍是什么/, "你在这个项目中最关键的产品取舍是什么")
    .replace(/^如果给他一个/, "如果给你一个")
    .replace(/^给他一个/, "给你一个")
    .replace(/他的/g, "你的")
    .replace(/帮助他/g, "帮助你")
    .replace(/体现了他/g, "体现了你")
    .replace(/^他/, "你");
}

function normalizeQuestion(question: string) {
  return toCandidatePerspective(question).toLowerCase().replace(/[\s，。！？、：；,.!?:;（）()\-_]/g, "");
}

export function inferQuestionCategory(question: string): QuestionCategory {
  if (/项目|rag|agent|deepflow|贡献|核心工作|产品方案|ai\s*编程|用户增长|生产/.test(question.toLowerCase())) return "project";
  if (/匹配|岗位|适合|录用|优势|团队价值|带来什么价值/.test(question)) return "fit";
  if (/实习|经历|审计|德勤|容诚|业务/.test(question)) return "experience";
  if (/技能|技术|模型|英语|证书|评测|评估|效果|隐私|企业数据|企业级/.test(question)) return "skills";
  if (/短板|不足|缺口|核实|风险|边界/.test(question)) return "gaps";
  if (/机密|提示词|忽略|编造|私人/.test(question)) return "security";
  if (/介绍|背景|教育|学校|张倬玮/.test(question)) return "profile";
  return "other";
}

export function getFollowUpQuestions(
  question: string,
  askedQuestions: readonly string[] = [],
  limit = 3,
  preferredQuestions: readonly string[] = [],
) {
  const seen = new Set(askedQuestions.map(normalizeQuestion));
  const category = inferQuestionCategory(question);
  const selected: string[] = [];

  function addQuestions(candidates: readonly string[], target: number) {
    if (selected.length >= target) return;
    for (const candidate of candidates) {
      const item = toCandidatePerspective(candidate);
      const normalized = normalizeQuestion(item);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      selected.push(item);
      if (selected.length >= target) break;
    }
  }

  const contractedPreferred = preferredQuestions.filter((item) => findQuestionContract(item));
  addQuestions(contractedPreferred, Math.min(2, limit));

  const currentContract = findQuestionContract(question);
  addQuestions(recommendedContractQuestions(currentContract?.id, askedQuestions, limit * 3), limit);

  // 旧题池仅作为兼容输入，只有已经建立稳定回答契约的题目才能进入推荐区。
  const legacyCandidates = [
    ...followUpsByCategory[category],
    ...explorationQuestionsByCategory[category],
    ...recommendationQuestionCandidates,
  ].filter((item) => findQuestionContract(item));
  addQuestions(legacyCandidates, limit);

  return selected;
}

const hrFollowUpIntents: Array<{
  kind: HrFollowUpKind;
  label: string;
  matcher: RegExp;
  fallbacks: readonly string[];
}> = [
  {
    kind: "evidence",
    label: "证据追问",
    matcher: /评估|效果|负责|贡献|证据|核验|演示|数据/,
    fallbacks: [
      "你如何评估并改进 AI 产品效果？",
      "你在代表项目中负责哪些核心工作？",
      "哪个项目最能代表你的 AI 产品能力？",
    ],
  },
  {
    kind: "retrospective",
    label: "项目复盘",
    matcher: /转化|改进|取舍|复盘|核心工作|项目/,
    fallbacks: [
      "你如何把业务问题转化为 AI 产品方案？",
      "你在代表项目中负责哪些核心工作？",
      "你如何评估并改进 AI 产品效果？",
    ],
  },
  {
    kind: "fit",
    label: "岗位匹配",
    matcher: /适合|岗位|价值|胜任|优势|团队/,
    fallbacks: [
      "你为什么适合 AI 产品经理岗位？",
      "请介绍一下你自己。",
      "哪个项目最能代表你的 AI 产品能力？",
    ],
  },
];

export function getHrFollowUpQuestions(
  question: string,
  askedQuestions: readonly string[] = [],
  preferredQuestions: readonly string[] = [],
): HrFollowUpSuggestion[] {
  const seen = new Set(askedQuestions.map(normalizeQuestion));
  const used = new Set<string>();
  const candidates = getFollowUpQuestions(question, askedQuestions, 9, preferredQuestions);

  return hrFollowUpIntents.flatMap((intent): HrFollowUpSuggestion[] => {
    const pool = [
      ...candidates.filter((candidate) => intent.matcher.test(candidate)),
      ...intent.fallbacks.map(toCandidatePerspective),
      ...candidates,
    ];
    const selected = pool.find((candidate) => {
      const normalized = normalizeQuestion(candidate);
      return normalized && !seen.has(normalized) && !used.has(normalized) && Boolean(findQuestionContract(candidate));
    });
    if (!selected) return [];
    used.add(normalizeQuestion(selected));
    return [{ kind: intent.kind, label: intent.label, question: selected }];
  });
}
import { findQuestionContract, recommendedContractQuestions } from "./question-contracts";
