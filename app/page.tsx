import {
  ArrowSquareOutIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  GithubLogoIcon,
  PhoneIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Chat } from "@/components/chat";
import { strengths } from "@/lib/knowledge";
import { profile } from "@/lib/profile";

const resumeRequest = `mailto:${profile.email}?subject=${encodeURIComponent("索取张倬玮最新版简历")}`;

const publicLinks = [
  { label: "GitHub 项目", href: profile.github, icon: GithubLogoIcon, external: true },
  { label: "发送邮件", href: `mailto:${profile.email}`, icon: EnvelopeSimpleIcon },
  { label: "电话联系", href: `tel:${profile.phone}`, icon: PhoneIcon },
  { label: "获取最新简历", href: resumeRequest, icon: FileTextIcon },
];

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
              <strong>{profile.name}</strong>
              <p>{profile.role}</p>
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
          {publicLinks.map(({ label, href, icon: Icon, external }) => (
            <a key={label} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
              {external && <ArrowSquareOutIcon className="external-icon" size={15} aria-hidden="true" />}
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
            <strong>{profile.name}</strong>
            <span>公开资料问答</span>
          </div>
          <a className="resume-link" href={resumeRequest}>
            <span>获取最新简历</span>
            <EnvelopeSimpleIcon size={15} aria-hidden="true" />
          </a>
        </header>
        <Chat />
      </section>
    </main>
  );
}
