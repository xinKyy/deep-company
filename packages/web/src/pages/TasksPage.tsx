import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Button, StatusBadge, Badge,
  Modal, Input, Textarea, Select, Label, FormGroup, EmptyState,
} from "../components/ui";
import { Plus, Search, ChevronDown, ChevronRight, ListTodo, LayoutGrid, List } from "lucide-react";

const STATUS_COLUMNS = ["created", "assigned", "in_progress", "review", "blocked", "completed"];

export function TasksPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"board" | "list">("board");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: () => api.tasks.list() });
  const { data: searchResults } = useQuery({
    queryKey: ["tasks-search", search],
    queryFn: () => api.tasks.search(search),
    enabled: search.length > 1,
  });
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: api.agents.list });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });

  const createMut = useMutation({
    mutationFn: api.tasks.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setShowCreate(false); },
  });

  const displayTasks = search.length > 1 ? (searchResults || []) : tasks;
  const topLevelTasks = displayTasks.filter((t: any) => !t.parentTaskId);

  return (
    <div>
      <PageHeader
        title="任务"
        action={
          <div className="flex items-center gap-2">
            <div className="flex bg-white/5 rounded-full p-0.5 border border-white/10">
              <button
                onClick={() => setView("board")}
                className={`px-3 py-1.5 rounded-full text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                  view === "board"
                    ? "bg-[#F7931A]/15 text-[#F7931A] shadow-sm"
                    : "text-[var(--color-muted)] hover:text-white"
                }`}
              >
                <LayoutGrid size={12} /> 看板
              </button>
              <button
                onClick={() => setView("list")}
                className={`px-3 py-1.5 rounded-full text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                  view === "list"
                    ? "bg-[#F7931A]/15 text-[#F7931A] shadow-sm"
                    : "text-[var(--color-muted)] hover:text-white"
                }`}
              >
                <List size={12} /> 列表
              </button>
            </div>
            <Button onClick={() => setShowCreate(true)}><Plus size={16} /> 新建任务</Button>
          </div>
        }
      />

      <div className="mb-6 relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]/50" />
        <Input
          className="pl-11"
          placeholder="按 ID、标题或描述搜索任务..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((status) => {
            const col = topLevelTasks.filter((t: any) => t.status === status);
            return (
              <div key={status} className="min-w-[280px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-4 px-1">
                  <StatusBadge status={status} />
                  <span className="text-xs font-mono text-[var(--color-muted)]/50">{col.length}</span>
                </div>
                <div className="space-y-3">
                  {col.map((task: any) => (
                    <TaskCard key={task.id} task={task} agents={agents} />
                  ))}
                  {col.length === 0 && (
                    <div className="border border-dashed border-white/5 rounded-xl p-6 text-center">
                      <p className="text-xs font-mono text-white/15">暂无</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card hover={false}>
          <CardContent className="p-0">
            {topLevelTasks.length === 0 ? (
              <EmptyState icon={<ListTodo size={48} />} message="暂无任务" />
            ) : (
              <div className="divide-y divide-white/5">
                {topLevelTasks.map((task: any) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    agents={agents}
                    expanded={expandedTask === task.id}
                    onToggle={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="创建任务">
        <TaskForm
          agents={agents}
          projects={projects}
          onSubmit={(d) => createMut.mutate(d)}
          onCancel={() => setShowCreate(false)}
          loading={createMut.isPending}
        />
      </Modal>
    </div>
  );
}

function TaskCard({ task, agents }: { task: any; agents: any[] }) {
  const agent = agents.find((a: any) => a.id === task.assignedAgentId);
  return (
    <Card className="group">
      <CardContent className="p-4">
        <p className="text-sm font-medium text-white mb-1.5 leading-snug">{task.title}</p>
        <p className="text-[10px] font-mono text-[var(--color-muted)] mb-3 tracking-wider">{task.id}</p>
        <div className="flex items-center justify-between">
          <Badge variant={task.priority === "urgent" ? "error" : task.priority === "high" ? "warning" : "default"}>
            {task.priority}
          </Badge>
          {agent && <span className="text-xs font-mono text-[var(--color-muted)]">{agent.name}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskRow({
  task, agents, expanded, onToggle,
}: {
  task: any; agents: any[]; expanded: boolean; onToggle: () => void;
}) {
  const { data: detail } = useQuery({
    queryKey: ["task-detail", task.id],
    queryFn: () => api.tasks.get(task.id),
    enabled: expanded,
  });
  const agent = agents.find((a: any) => a.id === task.assignedAgentId);

  return (
    <div>
      <div
        className="px-6 py-4 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={onToggle}
      >
        <div className="text-[var(--color-muted)]">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[var(--color-muted)] tracking-wider">{task.id}</span>
            <span className="text-sm font-medium text-white truncate">{task.title}</span>
          </div>
        </div>
        <Badge variant={task.priority === "urgent" ? "error" : task.priority === "high" ? "warning" : "default"}>
          {task.priority}
        </Badge>
        {agent && <span className="text-xs font-mono text-[var(--color-muted)]">{agent.name}</span>}
        <StatusBadge status={task.status} />
      </div>
      {expanded && detail && (
        <div className="px-12 pb-5 space-y-4">
          {task.description && (
            <p className="text-sm text-[var(--color-muted)] leading-relaxed">{task.description}</p>
          )}
          {detail.subtasks?.length > 0 && (
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-xs font-mono font-semibold text-[var(--color-muted)] mb-3 tracking-wider uppercase">
                子任务 ({detail.subtaskProgress.completed}/{detail.subtaskProgress.total})
              </p>
              <div className="space-y-2">
                {detail.subtasks.map((sub: any) => (
                  <div key={sub.id} className="flex items-center gap-3 py-1.5">
                    <StatusBadge status={sub.status} />
                    <span className="text-[10px] font-mono text-[var(--color-muted)] tracking-wider">{sub.id}</span>
                    <span className="text-sm text-white">{sub.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {detail.events?.length > 0 && (
            <div>
              <p className="text-xs font-mono font-semibold text-[var(--color-muted)] mb-3 tracking-wider uppercase">
                事件历史
              </p>
              <div className="relative pl-4 border-l border-[#F7931A]/20 space-y-2">
                {detail.events.slice(0, 5).map((ev: any) => (
                  <div key={ev.id} className="text-xs text-[var(--color-muted)] py-1 relative">
                    <div className="absolute -left-[21px] top-2 w-2 h-2 rounded-full bg-[#F7931A]/40 border border-[#F7931A]/60" />
                    <span className="text-white/60">{ev.fromStatus || "new"}</span>
                    <span className="text-[#F7931A] mx-1.5">&rarr;</span>
                    <span className="text-white/80">{ev.toStatus}</span>
                    {ev.comment && <span className="text-[var(--color-muted)]"> — {ev.comment}</span>}
                    <span className="ml-2 text-white/20">{new Date(ev.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskForm({
  agents, projects, onSubmit, onCancel, loading,
}: {
  agents: any[]; projects: any[];
  onSubmit: (data: any) => void; onCancel: () => void; loading: boolean;
}) {
  const [form, setForm] = useState({
    title: "", description: "", projectId: "", priority: "medium", assignedAgentId: "",
  });
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <FormGroup><Label>标题</Label><Input value={form.title} onChange={set("title")} /></FormGroup>
      <FormGroup><Label>描述</Label><Textarea value={form.description} onChange={set("description")} /></FormGroup>
      <div className="grid grid-cols-2 gap-4">
        <FormGroup><Label>项目</Label>
          <Select value={form.projectId} onChange={set("projectId")}>
            <option value="">无</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FormGroup>
        <FormGroup><Label>优先级</Label>
          <Select value={form.priority} onChange={set("priority")}>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="urgent">紧急</option>
          </Select>
        </FormGroup>
      </div>
      <FormGroup><Label>分配给智能体</Label>
        <Select value={form.assignedAgentId} onChange={set("assignedAgentId")}>
          <option value="">未分配</option>
          {agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </FormGroup>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
        <Button variant="secondary" onClick={onCancel}>取消</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.title || loading}>
          {loading ? "创建中..." : "创建"}
        </Button>
      </div>
    </>
  );
}
