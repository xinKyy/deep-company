import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  GitBranch,
  ListTodo,
  FolderKanban,
  Wrench,
  Server,
  MessageSquare,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/agents", icon: Bot, label: "Agents" },
  { to: "/sops", icon: GitBranch, label: "SOPs" },
  { to: "/tasks", icon: ListTodo, label: "Tasks" },
  { to: "/projects", icon: FolderKanban, label: "Projects" },
  { to: "/skills", icon: Wrench, label: "Skills" },
  { to: "/mcps", icon: Server, label: "MCPs" },
  { to: "/messages", icon: MessageSquare, label: "Messages" },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h1 className="text-lg font-bold text-[var(--color-primary-light)]">
            AI Dev Pro
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            One-Person Company OS
          </p>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--color-primary)]/15 text-[var(--color-primary-light)] border-r-2 border-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
