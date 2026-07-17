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
    summary: "企业级文档问答系统，覆盖解析、混合检索、引用溯源与 RAGAS 评测。",
    stack: "FastAPI / Vue 3 / Milvus / RAGAS",
    url: "https://github.com/ZackZhang-AI/RAG-Knowledge-Base-System",
    status: "已完成公开仓库",
  },
  {
    name: "DeepFlow",
    summary: "多 Agent 深度研究工作台，覆盖计划、人审、检索、分析和报告生成。",
    stack: "FastAPI / Next.js / Multi-Agent / RAG",
    url: "https://github.com/ZackZhang-AI/DeepFlow",
    status: "已完成公开仓库",
  },
  {
    name: "Thirty-Minute Brain",
    summary: "本地优先的桌面上下文检索工具，帮助快速恢复最近工作现场。",
    stack: "Tauri / React / Rust / SQLite FTS5",
    url: "https://github.com/ZackZhang-AI/thirty-minute-brain",
    status: "已完成公开仓库",
  },
] as const;
