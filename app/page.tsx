import { Chat } from "@/components/chat";
import { strengths } from "@/lib/knowledge";

const publicLinks = [
  ["简历", process.env.NEXT_PUBLIC_RESUME_URL],
  ["项目", process.env.NEXT_PUBLIC_PROJECT_URL],
  ["联系我", process.env.NEXT_PUBLIC_CONTACT_URL],
].filter((item): item is [string, string] => Boolean(item[1]));

export default function Home() {
  return (
    <main>
      <header className="site-nav" aria-label="主导航">
        <a className="wordmark" href="#top">Ask Me <span>张倬玮 AI Career Agent</span></a>
        <nav>
          {publicLinks.map(([label, href]) => <a key={label} href={href}>{label}</a>)}
          <a href="#ask">开始提问</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker">面向 AI 产品招聘场景</p>
          <h1>认识张倬玮，<br />不只通过一页简历。</h1>
          <p className="lede">询问他的经历、项目、AI 产品能力、优势、短板和岗位匹配证据。回答只基于候选人维护的公开资料，不代替招聘决策。</p>
          <div className="hero-actions">
            <a className="button primary" href="#ask">向 Agent 提问</a>
            {publicLinks[0] && <a className="button secondary" href={publicLinks[0][1]}>查看简历</a>}
          </div>
        </div>
        <aside className="positioning" aria-label="候选人能力定位">
          <p className="position-label">能力交叉点</p>
          <p className="position-value">Data × Business × AI × Product × Execution</p>
          <p className="position-note">以数据和业务理解为底座，把 AI 产品想法转化为可运行、可评测的原型。</p>
        </aside>
      </section>

      <section className="strengths" aria-labelledby="strength-title">
        <div className="section-heading">
          <p className="kicker">10 秒摘要</p>
          <h2 id="strength-title">三个值得继续深挖的差异点</h2>
        </div>
        <ol className="strength-list">
          {strengths.map((strength, index) => (
            <li key={strength.title}>
              <span className="strength-index">0{index + 1}</span>
              <div><h3>{strength.title}</h3><p>{strength.description}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="ask-section" id="ask" aria-labelledby="ask-title">
        <div className="section-heading ask-heading">
          <p className="kicker">公开资料问答</p>
          <h2 id="ask-title">从你真正关心的问题开始</h2>
          <p>所有事实性回答都附带来源和验证边界。涉及未知、隐私或诱导编造时，Agent 会明确拒答。</p>
        </div>
        <Chat />
      </section>

      <footer>
        <p>Ask Me 只呈现经筛选的公开资料。请在面试中继续核实关键事实。</p>
        <a href="#top">返回顶部</a>
      </footer>
    </main>
  );
}
