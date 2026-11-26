import { AppFrame } from "@/components/app-frame";
import { Chat } from "@/components/chat";
import { ChatTopbar } from "@/components/chat-topbar";
import { InteractionTracker } from "@/components/interaction-tracker";
import { buildHomepagePresetAnswers } from "@/lib/preset-answers";

export default function Home() {
  const presetAnswers = buildHomepagePresetAnswers();
  return (
    <AppFrame>
      <InteractionTracker />
      <section className="conversation-panel" id="ask" aria-labelledby="chat-title">
        <ChatTopbar />
        <Chat presetAnswers={presetAnswers} />
      </section>
    </AppFrame>
  );
}
