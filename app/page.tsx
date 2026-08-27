import {
  FileTextIcon,
} from "@phosphor-icons/react/dist/ssr";
import { AppFrame } from "@/components/app-frame";
import { Chat } from "@/components/chat";
import { InteractionTracker } from "@/components/interaction-tracker";
import { buildHomepagePresetAnswers } from "@/lib/preset-answers";
import { profile } from "@/lib/profile";

export default function Home() {
  const presetAnswers = buildHomepagePresetAnswers();
  return (
    <AppFrame>
      <InteractionTracker />
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
          <a className="resume-link" href="/resume">
            <span>查看最新简历</span>
            <FileTextIcon size={15} aria-hidden="true" />
          </a>
        </header>
        <Chat presetAnswers={presetAnswers} />
      </section>
    </AppFrame>
  );
}
