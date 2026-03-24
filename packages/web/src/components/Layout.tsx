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
  KeyRound,
  Zap,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "仪表盘" },
  { to: "/agents", icon: Bot, label: "智能体" },
  { to: "/sops", icon: GitBranch, label: "流程" },
  { to: "/tasks", icon: ListTodo, label: "任务" },
  { to: "/projects", icon: FolderKanban, label: "项目" },
  { to: "/skills", icon: Wrench, label: "技能" },
  { to: "/mcps", icon: Server, label: "MCP 服务" },
  { to: "/messages", icon: MessageSquare, label: "消息" },
  { to: "/env-vars", icon: KeyRound, label: "环境变量" },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      <aside className="w-60 shrink-0 border-r border-white/5 bg-[var(--color-surface)] flex flex-col">
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#EA580C] to-[#F7931A] flex items-center justify-center shadow-[0_0_20px_-5px_rgba(234,88,12,0.5)]">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-heading font-bold text-white tracking-tight">
                AI Dev Pro
              </h1>
              <p className="text-[10px] font-mono text-[var(--color-muted)] tracking-widest uppercase">
                智能体控制台
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[#F7931A]/10 text-[#F7931A] shadow-[0_0_20px_-10px_rgba(247,147,26,0.3)]"
                    : "text-[var(--color-muted)] hover:text-white hover:bg-white/5"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                      isActive
                        ? "bg-[#F7931A]/20 text-[#F7931A]"
                        : "bg-white/5 text-[var(--color-muted)] group-hover:text-white group-hover:bg-white/10"
                    }`}
                  >
                    <Icon size={16} />
                  </div>
                  <span className="font-mono text-xs tracking-wider">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span className="text-[10px] font-mono text-[var(--color-muted)] tracking-wider uppercase">
              系统在线
            </span>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="relative">
          <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-30" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#F7931A] opacity-[0.03] blur-[150px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-[#EA580C] opacity-[0.02] blur-[120px] pointer-events-none" />
          <div className="relative p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
