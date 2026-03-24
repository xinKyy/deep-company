import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Button, StatusBadge,
  Modal, Input, Textarea, Select, Label, FormGroup, EmptyState,
} from "../components/ui";
import { Plus, Trash2, Edit } from "lucide-react";

export function AgentsPage() {
  const qc = useQueryClient();
  const { data: agents = [], isLoading } = useQuery({ queryKey: ["agents"], queryFn: api.agents.list });
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const createMut = useMutation({
    mutationFn: api.agents.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: any) => api.agents.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agents"] }); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: api.agents.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });

  return (
    <div>
      <PageHeader
        title="Agents"
        action={<Button onClick={() => setShowCreate(true)}><Plus size={16} /> New Agent</Button>}
      />

      {isLoading ? (
        <p className="text-[var(--color-text-secondary)]">Loading...</p>
      ) : agents.length === 0 ? (
        <EmptyState message="No agents created yet. Click 'New Agent' to get started." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent: any) => (
            <Card key={agent.id}>
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{agent.id}</p>
                  </div>
                  <StatusBadge status={agent.status} />
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-3 line-clamp-2">
                  {agent.description || "No description"}
                </p>
                <div className="text-xs text-[var(--color-text-secondary)] space-y-1 mb-3">
                  <p>LLM: {agent.llmProvider}/{agent.llmModel}</p>
                  <p>Bot: {agent.tgBotUsername ? `@${agent.tgBotUsername}` : "Not configured"}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(agent)}><Edit size={14} /> Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => { if (confirm("Delete this agent?")) deleteMut.mutate(agent.id); }}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AgentFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Agent"
        onSubmit={(data) => createMut.mutate(data)}
        loading={createMut.isPending}
      />

      {editing && (
        <AgentFormModal
          open={true}
          onClose={() => setEditing(null)}
          title="Edit Agent"
          initial={editing}
          onSubmit={(data) => updateMut.mutate({ id: editing.id, ...data })}
          loading={updateMut.isPending}
        />
      )}
    </div>
  );
}

function AgentFormModal({
  open, onClose, title, initial, onSubmit, loading,
}: {
  open: boolean; onClose: () => void; title: string;
  initial?: any; onSubmit: (data: any) => void; loading: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    description: initial?.description || "",
    systemPrompt: initial?.systemPrompt || "",
    llmProvider: initial?.llmProvider || "openai",
    llmModel: initial?.llmModel || "gpt-4o",
    tgBotToken: initial?.tgBotToken || "",
    tgBotUsername: initial?.tgBotUsername || "",
    status: initial?.status || "active",
  });

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <FormGroup><Label>Name</Label><Input value={form.name} onChange={set("name")} placeholder="e.g. PM Agent" /></FormGroup>
      <FormGroup><Label>Description</Label><Textarea value={form.description} onChange={set("description")} placeholder="Agent description..." /></FormGroup>
      <FormGroup><Label>System Prompt</Label><Textarea value={form.systemPrompt} onChange={set("systemPrompt")} placeholder="You are a project manager..." className="min-h-[120px]" /></FormGroup>
      <div className="grid grid-cols-2 gap-4">
        <FormGroup><Label>LLM Provider</Label>
          <Select value={form.llmProvider} onChange={set("llmProvider")}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="deepseek">DeepSeek</option>
            <option value="google">Google</option>
          </Select>
        </FormGroup>
        <FormGroup><Label>LLM Model</Label><Input value={form.llmModel} onChange={set("llmModel")} /></FormGroup>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormGroup><Label>TG Bot Token</Label><Input value={form.tgBotToken} onChange={set("tgBotToken")} type="password" /></FormGroup>
        <FormGroup><Label>TG Bot Username</Label><Input value={form.tgBotUsername} onChange={set("tgBotUsername")} placeholder="without @" /></FormGroup>
      </div>
      {initial && (
        <FormGroup><Label>Status</Label>
          <Select value={form.status} onChange={set("status")}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="disabled">Disabled</option>
          </Select>
        </FormGroup>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.name || loading}>
          {loading ? "Saving..." : "Save"}
        </Button>
      </div>
    </Modal>
  );
}
