"use client";

import { useEffect, useRef } from "react";
import { getBrowserSessionId } from "@/lib/client-session";

type FunnelEvent =
  | "page_viewed"
  | "summary_viewed"
  | "project_opened"
  | "resume_opened"
  | "contact_opened";

function track(event: FunnelEvent, detail = "") {
  const targetType = event === "project_opened" ? "project" : event === "contact_opened" && ["email", "phone"].includes(detail) ? detail : undefined;
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, sessionId: getBrowserSessionId(), targetType, targetId: detail }),
    keepalive: true,
  });
}

export function InteractionTracker() {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      track("page_viewed");
      track("summary_viewed");
    }

    function onClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-track-event]") : null;
      if (!target) return;
      const eventName = target.dataset.trackEvent as FunnelEvent | undefined;
      if (eventName) track(eventName, target.dataset.trackDetail);
    }

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, []);

  return null;
}
