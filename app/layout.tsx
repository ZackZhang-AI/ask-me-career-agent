import type { Metadata } from "next";
import {
  Bodoni_Moda,
  Geist_Mono,
  Manrope,
  Noto_Sans_SC,
  Noto_Serif_SC,
} from "next/font/google";
import "./globals.css";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-bodoni",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-manrope",
});

const notoSerifSc = Noto_Serif_SC({
  weight: ["500", "600"],
  preload: false,
  display: "swap",
  variable: "--font-noto-serif",
});

const notoSansSc = Noto_Sans_SC({
  weight: ["400", "500", "600", "700"],
  preload: false,
  display: "swap",
  variable: "--font-noto-sans",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const THEME_INIT_SCRIPT = `(() => {
  try {
    const saved = window.localStorage.getItem("ask-me-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
    }
  } catch {}
})();`;

export const metadata: Metadata = {
  title: "Ask Me | 张倬玮 AI 分身 · Career Agent",
  description: "认识张倬玮，不只通过一页简历——可追问、可溯源的 AI 产品经理求职数字分身。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fontClasses = [
    bodoni.variable,
    manrope.variable,
    notoSerifSc.variable,
    notoSansSc.variable,
    mono.variable,
  ].join(" ");

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={fontClasses}>{children}</body>
    </html>
  );
}
