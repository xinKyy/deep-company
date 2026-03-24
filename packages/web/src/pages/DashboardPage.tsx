import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, CardContent, PageHeader, StatusBadge, GlowDot } from "../components/ui";
import { Bot, ListTodo, FolderKanban, GitBranch, ArrowUpRight } from "lucide-react";

const STAT_CONFIG = [
  { key: "Agents", icon: Bot, gradient: "from-[#EA580C] to-[#F7931A]" },
  { key: "Tasks", icon: ListTodo, gradient: "from-[#F7931A] to-[#FFD600]" },
  { key: "Projects", icon: FolderKanban, gradient: "from-[#EA580C] to-[#F7931A]" },
  { key: "SOPs", icon: GitBranch, gradient: "from-[#F7931A] to-[#FFD600]" },
];

export function DashboardPage() {
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: api.agents.list });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => api.tasks.list() });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  const { data: sops = [] } = useQuery({ queryKey: ["sops"], queryFn: api.sops.list });

  const stats = [
    { label: "Agents", value: agents.length, active: agents.filter((a: any) => a.status === "active").length },
    { label: "Tasks", value: tasks.length, active: tasks.filter((t: any) => t.status === "in_progress").length },
    { label: "Projects", value: projects.length, active: projects.filter((p: any) => p.status === "active").length },
    { label: "SOPs", value: sops.length, active: sops.length },
  ];

  const recentTasks = tasks.slice(0, 10);

  return (
    <div>
      <PageHeader title="Dashboard" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {stats.map(({ label, value, active }, i) => {
          const config = STAT_CONFIG[i];
          const Icon = config.icon;
          return (
            <Card key={label} className="group relative overflow-hidden">
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <p className="text-xs font-mono text-[var(--color-muted)] tracking-wider uppercase">{label}</p>
                    <p className="text-4xl font-heading font-bold text-white">{value}</p>
                    <div className="flex items-center gap-2">
                      <GlowDot color="orange" />
                      <span className="text-xs font-mono text-[var(--color-muted)]">
                        {active} active
                      </span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center opacity-80 shadow-[0_0_20px_-5px_rgba(234,88,12,0.4)] group-hover:opacity-100 transition-opacity`}>
                    <Icon size={20} className="text-white" />
                  </div>
                </div>
              </CardContent>
              <Icon
                size={80}
                className="absolute -bottom-4 -right-4 text-white/[0.02] group-hover:text-white/[0.06] transition-colors duration-500"
              />
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card hover={false}>
          <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-heading font-semibold text-white">Recent Tasks</h3>
            <span className="text-xs font-mono text-[var(--color-muted)]">{recentTasks.length} items</span>
          </div>
          <CardContent className="p-0">
            {recentTasks.length === 0 ? (
              <p className="text-[var(--color-muted)] text-sm p-6">No tasks yet</p>
            ) : (
              <div className="divide-y divide-white/5">
                {recentTasks.map((task: any) => (
                  <div key={task.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{task.title}</p>
                      <p className="text-xs font-mono text-[var(--color-muted)] mt-0.5">{task.id}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <StatusBadge status={task.status} />
                      <ArrowUpRight size={14} className="text-white/20" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card hover={false}>
          <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-heading font-semibold text-white">Active Agents</h3>
            <span className="text-xs font-mono text-[var(--color-muted)]">{agents.length} total</span>
          </div>
          <CardContent className="p-0">
            {agents.length === 0 ? (
              <p className="text-[var(--color-muted)] text-sm p-6">No agents configured</p>
            ) : (
              <div className="divide-y divide-white/5">
                {agents.map((agent: any) => (
                  <div key={agent.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#EA580C]/20 border border-[#EA580C]/30 flex items-center justify-center shrink-0">
                        <Bot size={14} className="text-[#F7931A]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                        <p className="text-xs font-mono text-[var(--color-muted)] truncate">
                          {agent.llmProvider}/{agent.llmModel}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={agent.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
