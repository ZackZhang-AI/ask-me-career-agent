"use client";

import { useCallback, useEffect, useRef } from "react";
import { StreamRevealController, type RevealScheduler } from "@/lib/stream-reveal";

function browserScheduler(): RevealScheduler {
  return {
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    isHidden: () => document.visibilityState !== "visible",
  };
}

export function useStreamReveal() {
  const controllerRef = useRef<StreamRevealController | null>(null);

  const startReveal = useCallback((onUpdate: (visibleText: string) => void) => {
    controllerRef.current?.cancel();
    controllerRef.current = new StreamRevealController({
      scheduler: browserScheduler(),
      reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      onUpdate,
    });
  }, []);

  const enqueueReveal = useCallback((value: string) => {
    controllerRef.current?.enqueue(value);
  }, []);

  const finishReveal = useCallback(() => controllerRef.current?.finish() ?? Promise.resolve(""), []);

  const cancelReveal = useCallback(() => {
    controllerRef.current?.cancel();
    controllerRef.current = null;
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") controllerRef.current?.flush();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      controllerRef.current?.cancel();
    };
  }, []);

  return { startReveal, enqueueReveal, finishReveal, cancelReveal };
}

