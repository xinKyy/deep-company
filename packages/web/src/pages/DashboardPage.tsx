import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Card, CardContent, PageHeader, StatusBadge } from "../components/ui";
import { Bot, ListTodo, FolderKanban, GitBranch } from "lucide-react";

export function DashboardPage() {
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: api.agents.list });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => api.tasks.list() });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  const { data: sops = [] } = useQuery({ queryKey: ["sops"], queryFn: api.sops.list });

  const stats = [
    { label: "Agents", value: agents.length, icon: Bot, active: agents.filter((a: any) => a.status === "active").length },
    { label: "Tasks", value: tasks.length, icon: ListTodo, active: tasks.filter((t: any) => t.status === "in_progress").length },
    { label: "Projects", value: projects.length, icon: FolderKanban, active: projects.filter((p: any) => p.status === "active").length },
    { label: "SOPs", value: sops.length, icon: GitBranch, active: sops.length },
  ];

  const recentTasks = tasks.slice(0, 10);

  return (
    <div>
      <PageHeader title="Dashboard" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, active }) => (
          <Card key={label}>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--color-text-secondary)] text-sm">{label}</p>
                  <p className="text-3xl font-bold mt-1">{value}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">{active} active</p>
                </div>
                <Icon size={32} className="text-[var(--color-primary)]/40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <h3 className="font-semibold">Recent Tasks</h3>
          </div>
          <CardContent className="p-0">
            {recentTasks.length === 0 ? (
              <p className="text-[var(--color-text-secondary)] text-sm p-5">No tasks yet</p>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {recentTasks.map((task: any) => (
                  <div key={task.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{task.id}</p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <h3 className="font-semibold">Active Agents</h3>
          </div>
          <CardContent className="p-0">
            {agents.length === 0 ? (
              <p className="text-[var(--color-text-secondary)] text-sm p-5">No agents configured</p>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {agents.map((agent: any) => (
                  <div key={agent.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{agent.name}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {agent.llmProvider}/{agent.llmModel}
                      </p>
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
