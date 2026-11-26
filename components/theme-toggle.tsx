"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "@phosphor-icons/react";

export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "ask-me-theme";
const THEME_CHANGE_EVENT = "ask-me-theme-change";

function readResolvedTheme(): ResolvedTheme {
  if (typeof document === "undefined") return "light";
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeTheme(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  media.addEventListener("change", onStoreChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
    media.removeEventListener("change", onStoreChange);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<ResolvedTheme>(
    subscribeTheme,
    readResolvedTheme,
    () => "light",
  );

  function toggleTheme() {
    const next: ResolvedTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // 存储受限时仅在当前页面会话生效。
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  const nextLabel = theme === "dark" ? "切换为暖纸亮色主题" : "切换为暖墨暗色主题";

  return (
    <button
      id="theme-toggle"
      className="topbar-icon-btn theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      suppressHydrationWarning
    >
      {theme === "dark" ? (
        <SunIcon size={16} weight="regular" aria-hidden="true" />
      ) : (
        <MoonIcon size={16} weight="regular" aria-hidden="true" />
      )}
    </button>
  );
}
