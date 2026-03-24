import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Button, StatusBadge, Badge,
  Modal, Input, Textarea, Select, Label, FormGroup, EmptyState,
} from "../components/ui";
import { Plus, Search, ChevronDown, ChevronRight } from "lucide-react";

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
        title="Tasks"
        action={
          <div className="flex gap-2">
            <Button variant={view === "board" ? "primary" : "secondary"} size="sm" onClick={() => setView("board")}>Board</Button>
            <Button variant={view === "list" ? "primary" : "secondary"} size="sm" onClick={() => setView("list")}>List</Button>
            <Button onClick={() => setShowCreate(true)}><Plus size={16} /> New Task</Button>
          </div>
        }
      />

      <div className="mb-4 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
        <Input
          className="pl-10"
          placeholder="Search tasks by ID, title, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {view === "board" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((status) => {
            const col = topLevelTasks.filter((t: any) => t.status === status);
            return (
              <div key={status} className="min-w-[260px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <StatusBadge status={status} />
                  <span className="text-xs text-[var(--color-text-secondary)]">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((task: any) => (
                    <TaskCard key={task.id} task={task} agents={agents} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {topLevelTasks.length === 0 ? (
              <EmptyState message="No tasks found" />
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Task">
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
    <Card>
      <CardContent className="p-3">
        <p className="text-sm font-medium mb-1">{task.title}</p>
        <p className="text-xs text-[var(--color-text-secondary)] mb-2">{task.id}</p>
        <div className="flex items-center justify-between">
          <Badge variant={task.priority === "urgent" ? "error" : task.priority === "high" ? "warning" : "default"}>
            {task.priority}
          </Badge>
          {agent && <span className="text-xs text-[var(--color-text-secondary)]">{agent.name}</span>}
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
      <div className="px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/3" onClick={onToggle}>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-secondary)] font-mono">{task.id}</span>
            <span className="text-sm font-medium truncate">{task.title}</span>
          </div>
        </div>
        <Badge variant={task.priority === "urgent" ? "error" : task.priority === "high" ? "warning" : "default"}>
          {task.priority}
        </Badge>
        {agent && <span className="text-xs text-[var(--color-text-secondary)]">{agent.name}</span>}
        <StatusBadge status={task.status} />
      </div>
      {expanded && detail && (
        <div className="px-10 pb-4 space-y-3">
          {task.description && <p className="text-sm text-[var(--color-text-secondary)]">{task.description}</p>}
          {detail.subtasks?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1">
                Subtasks ({detail.subtaskProgress.completed}/{detail.subtaskProgress.total})
              </p>
              {detail.subtasks.map((sub: any) => (
                <div key={sub.id} className="flex items-center gap-2 py-1 text-sm">
                  <StatusBadge status={sub.status} />
                  <span className="text-xs font-mono text-[var(--color-text-secondary)]">{sub.id}</span>
                  <span>{sub.title}</span>
                </div>
              ))}
            </div>
          )}
          {detail.events?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Event History</p>
              {detail.events.slice(0, 5).map((ev: any) => (
                <div key={ev.id} className="text-xs text-[var(--color-text-secondary)] py-0.5">
                  {ev.fromStatus || "new"} → {ev.toStatus} {ev.comment && `- ${ev.comment}`}
                  <span className="ml-2 opacity-50">{new Date(ev.createdAt).toLocaleString()}</span>
                </div>
              ))}
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
      <FormGroup><Label>Title</Label><Input value={form.title} onChange={set("title")} /></FormGroup>
      <FormGroup><Label>Description</Label><Textarea value={form.description} onChange={set("description")} /></FormGroup>
      <div className="grid grid-cols-2 gap-4">
        <FormGroup><Label>Project</Label>
          <Select value={form.projectId} onChange={set("projectId")}>
            <option value="">None</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </FormGroup>
        <FormGroup><Label>Priority</Label>
          <Select value={form.priority} onChange={set("priority")}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </FormGroup>
      </div>
      <FormGroup><Label>Assign to Agent</Label>
        <Select value={form.assignedAgentId} onChange={set("assignedAgentId")}>
          <option value="">Unassigned</option>
          {agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </FormGroup>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.title || loading}>
          {loading ? "Creating..." : "Create"}
        </Button>
      </div>
    </>
  );
}
