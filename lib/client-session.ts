const SESSION_KEY = "ask-me-session";

export function getBrowserSessionId() {
  if (typeof window === "undefined") return "server-render";
  const stored = window.sessionStorage.getItem(SESSION_KEY);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (stored) {
    document.cookie = `${SESSION_KEY}=${encodeURIComponent(stored)}; Path=/; Max-Age=1800; SameSite=Lax${secure}`;
    return stored;
  }
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, created);
  document.cookie = `${SESSION_KEY}=${encodeURIComponent(created)}; Path=/; Max-Age=1800; SameSite=Lax${secure}`;
  return created;
}
