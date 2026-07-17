"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  ArrowSquareOutIcon,
  CaretRightIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  GithubLogoIcon,
  PhoneIcon,
  PlusIcon,
  ShieldCheckIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";
import { capabilityNavigation } from "@/lib/capability-navigation";
import { profile } from "@/lib/profile";

const publicLinks = [
  { label: "GitHub 项目", href: profile.github, icon: GithubLogoIcon, external: true, event: "project_opened", target: "github" },
  { label: "发送邮件", href: `mailto:${profile.email}`, icon: EnvelopeSimpleIcon, event: "contact_opened", target: "email" },
  { label: "电话联系", href: `tel:${profile.phone}`, icon: PhoneIcon, event: "contact_opened", target: "phone" },
  { label: "查看最新简历", href: "/resume", icon: FileTextIcon, event: undefined, target: undefined },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <main className={`app-shell${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`} id="top">
      <aside id="candidate-sidebar" className={`sidebar${sidebarCollapsed ? " is-collapsed" : ""}`} aria-label="候选人信息">
        <div className="sidebar-header">
          <div className="sidebar-title-row">
            <a className="brand" href="#top" aria-label="Ask Me 首页">
              <span className="brand-mark" aria-hidden="true">A</span>
              <span className="brand-copy">
                <strong>Ask Me</strong>
                <small>AI Career Agent</small>
              </span>
            </a>
            <button
              className="sidebar-toggle"
              type="button"
              aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
              aria-controls="candidate-sidebar"
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
              onClick={() => setSidebarCollapsed((current) => !current)}
            >
              <SidebarSimpleIcon size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>

          <a className="new-chat" href="#ask" aria-label="新对话" title={sidebarCollapsed ? "新对话" : undefined}>
            <PlusIcon size={17} weight="bold" aria-hidden="true" />
            <span className="new-chat-label">新对话</span>
          </a>
        </div>

        <section className="sidebar-section" aria-labelledby="profile-label">
          <p className="sidebar-label" id="profile-label">快速了解</p>
          <div className="profile-summary">
            <span className="profile-avatar" aria-hidden="true">张</span>
            <div className="profile-copy">
              <strong>{profile.name}</strong>
              <p>{profile.role}</p>
            </div>
          </div>
          <ul className="strength-nav">
            {capabilityNavigation.map((capability, index) => (
              <li className="strength-item" key={capability.title}>
                <a className="strength-trigger" href="#ask" aria-describedby={`capability-${index}`}>
                  <span>{capability.title}</span>
                  <CaretRightIcon size={13} aria-hidden="true" />
                </a>
                <div className="strength-flyout" id={`capability-${index}`} role="group" aria-label={`${capability.title}二级能力`}>
                  <strong>{capability.title}</strong>
                  <p>{capability.summary}</p>
                  <ul>
                    {capability.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="sidebar-footer">
          {publicLinks.map(({ label, href, icon: Icon, external, event, target }) => (
            <a
              key={label}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer" : undefined}
              data-track-event={event}
              data-track-detail={target}
              aria-label={label}
              title={sidebarCollapsed ? label : undefined}
            >
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

      {children}
    </main>
  );
}
