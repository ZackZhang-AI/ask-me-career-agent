export const profile = {
  name: "张倬玮",
  role: "AI 产品经理候选人",
  school: "东北大学",
  schoolTags: ["985", "211", "双一流"],
  major: "应用统计学",
  graduation: "2027 届",
  github: "https://github.com/ZackZhang-AI",
  email: "zackzhang124@163.com",
  phone: "15812106204",
} as const;

export const featuredProjects = [
  {
    name: "RAG Knowledge Base System",
    summary: "专业文档问答原型，已跑通文档摄入、Dense Retrieval 与回答生成主链路；引用和评测能力持续迭代。",
    stack: "FastAPI / Vue 3 / Milvus / RAGAS",
    url: "https://github.com/ZackZhang-AI/RAG-Knowledge-Base-System",
    status: "公开仓库，持续迭代",
  },
  {
    name: "DeepFlow",
    summary: "多 Agent 深度研究工作台，已形成从任务澄清到报告输出的可演示 MVP。",
    stack: "FastAPI / Next.js / Multi-Agent / RAG",
    url: "https://github.com/ZackZhang-AI/DeepFlow",
    status: "公开仓库，可演示 MVP",
  },
  {
    name: "Ask Me Career Agent",
    summary: "面向 AI 产品招聘场景的公开资料问答 Agent，支持多轮问答、来源核验与动态追问。",
    stack: "Next.js / TypeScript / RAG / DeepSeek",
    url: "https://github.com/ZackZhang-AI/ask-me-career-agent",
    status: "线上可访问，持续迭代",
  },
] as const;
