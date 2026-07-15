const forbiddenPatterns = [
  /系统提示|system prompt|隐藏指令|忽略.{0,8}(指令|规则)|ignore.{0,8}(instructions|rules)|绕过.{0,8}(系统|规则)|管理员.{0,8}(权限|规则)|base64.{0,12}(提示|prompt)/i,
  /身份证|家庭住址|手机号|微信|私人邮箱|工资流水|银行账户|联系方式.{0,8}(后四位|片段)/i,
  /客户名称|内部底稿|原始底稿|内部.{0,8}会议记录|企业机密|未公开数据|nda|保密协议/i,
  /编造|虚构|假装.{0,6}(做过|经历|数据)|fabricate|make up|假设.{0,12}(客户|业绩).{0,8}(事实|写入)/i,
  /api\s*key|环境变量|数据库密码|\.env|visibility\s*=\s*private|verification\s*=\s*unverified|私有知识/i,
  /读取.{0,12}(服务器|本地文件|系统目录)|运行.{0,12}(代码|命令)|执行.{0,12}(代码|命令)|ls\s+-la/i,
  /翻译.{0,12}(私密|机密|隐私)|(私密|机密|隐私).{0,12}翻译|translate.{0,12}(private|secret|confidential)/i,
];

type Assessment = { allowed: true; question: string } | { allowed: false; reason: string };

export function assessQuestion(question: string): Assessment {
  const clean = question.trim().slice(0, 500);
  if (!clean) return { allowed: false, reason: "请输入一个具体问题。" };
  if (forbiddenPatterns.some((pattern) => pattern.test(clean))) {
    return { allowed: false, reason: "这个问题涉及隐私、保密信息或要求绕过事实边界，我不能回答。你可以改问公开项目、能力证据或面试待核实问题。" };
  }
  return { allowed: true, question: clean };
}

export function redactForLog(text: string) {
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, "[phone]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[secret]")
    .slice(0, 200);
}
