export type QuestionCategory = "profile" | "fit" | "project" | "experience" | "skills" | "gaps" | "security" | "other";

export const questionGroups = [
  {
    id: "screening",
    label: "快速判断",
    questions: [
      "60 秒了解张倬玮。",
      "他为什么适合 AI 产品经理岗位？",
      "他的主要短板是什么？",
      "面试中最应该核实什么？",
    ],
  },
  {
    id: "projects",
    label: "项目与贡献",
    questions: [
      "哪个项目最能代表他的 AI 产品能力？",
      "他在 RAG 项目中的个人贡献是什么？",
      "他如何使用 AI 编程工具？",
      "公开项目是否有真实用户增长数据？",
    ],
  },
  {
    id: "experience",
    label: "经历与业务",
    questions: [
      "审计经历如何帮助他做 AI 产品？",
      "他的德勤 IT 审计实习做了什么？",
      "他的容诚审计实习做了什么？",
      "他的教育背景是什么？",
    ],
  },
  {
    id: "capabilities",
    label: "能力与边界",
    questions: [
      "他的核心技术能力有哪些？",
      "他如何处理隐私和企业数据？",
      "他会独立训练大模型吗？",
      "可以根据这些材料直接给出录用结论吗？",
    ],
  },
] as const;

export type QuestionGroupId = (typeof questionGroups)[number]["id"];

const followUpsByCategory: Record<QuestionCategory, readonly string[]> = {
  profile: [
    "他为什么适合 AI 产品经理岗位？",
    "哪个项目最能代表他的 AI 产品能力？",
    "他的主要短板是什么？",
  ],
  fit: [
    "哪个项目最能代表他的 AI 产品能力？",
    "他的主要短板是什么？",
    "面试中最应该核实什么？",
  ],
  project: [
    "他在 RAG 项目中的个人贡献是什么？",
    "他如何使用 AI 编程工具？",
    "公开项目是否有真实用户增长数据？",
  ],
  experience: [
    "审计经历如何帮助他做 AI 产品？",
    "他的德勤 IT 审计实习做了什么？",
    "他的容诚审计实习做了什么？",
  ],
  skills: [
    "他的核心技术能力有哪些？",
    "他如何处理隐私和企业数据？",
    "他会独立训练大模型吗？",
  ],
  gaps: [
    "面试中最应该核实什么？",
    "公开项目是否有真实用户增长数据？",
    "可以根据这些材料直接给出录用结论吗？",
  ],
  security: [
    "他如何处理隐私和企业数据？",
    "面试中最应该核实什么？",
    "可以根据这些材料直接给出录用结论吗？",
  ],
  other: [
    "60 秒了解张倬玮。",
    "他为什么适合 AI 产品经理岗位？",
    "面试中最应该核实什么？",
  ],
};

function normalizeQuestion(question: string) {
  return question.toLowerCase().replace(/[\s，。！？、：；,.!?:;（）()\-_]/g, "");
}

export function inferQuestionCategory(question: string): QuestionCategory {
  if (/项目|rag|agent|deepflow|贡献|ai\s*编程|用户增长|生产/.test(question.toLowerCase())) return "project";
  if (/匹配|岗位|适合|录用/.test(question)) return "fit";
  if (/实习|经历|审计|德勤|容诚|业务/.test(question)) return "experience";
  if (/技能|技术|模型|英语|证书|评测|隐私|企业数据/.test(question)) return "skills";
  if (/短板|不足|缺口|核实|风险|边界/.test(question)) return "gaps";
  if (/机密|提示词|忽略|编造|私人/.test(question)) return "security";
  if (/介绍|背景|教育|学校|张倬玮/.test(question)) return "profile";
  return "other";
}

export function getFollowUpQuestions(question: string, askedQuestions: readonly string[] = [], limit = 3) {
  const asked = new Set(askedQuestions.map(normalizeQuestion));
  const category = inferQuestionCategory(question);
  const fallback = questionGroups.flatMap((group) => group.questions);
  return [...followUpsByCategory[category], ...fallback]
    .filter((item, index, items) => items.indexOf(item) === index && !asked.has(normalizeQuestion(item)))
    .slice(0, limit);
}
