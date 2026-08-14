import { getQualityReport } from "../lib/analytics.ts";

function requestedDays() {
  const index = process.argv.indexOf("--days");
  const value = index >= 0 ? Number(process.argv[index + 1]) : 7;
  if (!Number.isInteger(value) || value < 1 || value > 30) throw new Error("--days 只支持 1 到 30 的整数。");
  return value;
}

const report = await getQualityReport(requestedDays());
if (!report) {
  console.info("未配置 DATABASE_URL，匿名质量报告不可用。");
  process.exit(0);
}
console.info(JSON.stringify(report, null, 2));
