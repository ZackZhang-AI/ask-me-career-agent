import {
  ArrowSquareOutIcon,
  FileTextIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Chat } from "@/components/chat";
import { strengths } from "@/lib/knowledge";

const publicLinks = [
  ["简历", process.env.NEXT_PUBLIC_RESUME_URL],
  ["项目", process.env.NEXT_PUBLIC_PROJECT_URL],
  ["联系我", process.env.NEXT_PUBLIC_CONTACT_URL],
].filter((item): item is [string, string] => Boolean(item[1]));

export default function Home() {
  return (
    <main className="app-shell" id="top">
      <aside className="sidebar" aria-label="候选人信息">
        <div className="sidebar-header">
          <a className="brand" href="#top" aria-label="Ask Me 首页">
            <span className="brand-mark" aria-hidden="true">A</span>
            <span>
              <strong>Ask Me</strong>
              <small>AI Career Agent</small>
            </span>
          </a>

          <a className="new-chat" href="#ask">
            <PlusIcon size={17} weight="bold" aria-hidden="true" />
            新对话
          </a>
        </div>

        <section className="sidebar-section" aria-labelledby="profile-label">
          <p className="sidebar-label" id="profile-label">快速了解</p>
          <div className="profile-summary">
            <span className="profile-avatar" aria-hidden="true">张</span>
            <div>
              <strong>张倬玮</strong>
              <p>AI 产品经理候选人</p>
            </div>
          </div>
          <ul className="strength-nav">
            {strengths.map((strength) => (
              <li key={strength.title}>
                <a href="#ask">{strength.title}</a>
              </li>
            ))}
          </ul>
        </section>

        <div className="sidebar-footer">
          {publicLinks.map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer">
              <FileTextIcon size={17} aria-hidden="true" />
              <span>{label}</span>
              <ArrowSquareOutIcon className="external-icon" size={15} aria-hidden="true" />
            </a>
          ))}
          <div className="privacy-note">
            <ShieldCheckIcon size={17} aria-hidden="true" />
            <p>仅基于候选人维护的公开资料回答</p>
          </div>
        </div>
      </aside>

      <section className="conversation-panel" id="ask" aria-labelledby="chat-title">
        <header className="chat-topbar">
          <a className="mobile-brand" href="#top" aria-label="Ask Me 首页">
            <span className="brand-mark" aria-hidden="true">A</span>
            <strong>Ask Me</strong>
          </a>
          <div className="chat-context">
            <strong>张倬玮</strong>
            <span>公开资料问答</span>
          </div>
          {publicLinks[0] && (
            <a className="resume-link" href={publicLinks[0][1]} target="_blank" rel="noreferrer">
              查看简历
              <ArrowSquareOutIcon size={15} aria-hidden="true" />
            </a>
          )}
        </header>
        <Chat />
      </section>
    </main>
  );
}
