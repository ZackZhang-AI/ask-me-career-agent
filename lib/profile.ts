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
    summary: "百川医疗 RAG 业务场景的脱敏重构，已跑通知识入库、Dense Retrieval、Rerank、来源片段、短期记忆与自动评测。",
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
    name: "AgentScope",
    summary: "AI Agent 黑匣子回放器，追踪工具调用、延迟与错误，支持安全 Fork、运行对比与确定性评测。",
    stack: "Next.js / TypeScript / PostgreSQL / Playwright",
    url: "https://github.com/ZackZhang-AI/HarnessLab",
    status: "公开仓库，线上可演示",
  },
] as const;
