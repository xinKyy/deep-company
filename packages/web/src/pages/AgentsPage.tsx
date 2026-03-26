import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Button, StatusBadge,
  Modal, Input, Textarea, Select, Label, FormGroup, EmptyState, GlowDot,
} from "../components/ui";
import { Plus, Trash2, Edit, Bot, Cpu } from "lucide-react";

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
        title="智能体"
        action={<Button onClick={() => setShowCreate(true)}><Plus size={16} /> 新建智能体</Button>}
      />

      {isLoading ? (
        <div className="flex items-center gap-3 text-[var(--color-muted)]">
          <div className="w-4 h-4 border-2 border-[#F7931A]/30 border-t-[#F7931A] rounded-full animate-spin" />
          <span className="text-sm font-mono">加载中...</span>
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon={<Bot size={48} />}
          message="暂无智能体，点击「新建智能体」开始创建。"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map((agent: any) => (
            <Card key={agent.id} className="group relative overflow-hidden">
              <CardContent>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#EA580C]/15 border border-[#EA580C]/30 flex items-center justify-center group-hover:shadow-[0_0_20px_rgba(234,88,12,0.3)] transition-shadow">
                      <Bot size={18} className="text-[#F7931A]" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-white">{agent.name}</h3>
                      <p className="text-[10px] font-mono text-[var(--color-muted)] tracking-wider">{agent.id}</p>
                    </div>
                  </div>
                  <StatusBadge status={agent.status} />
                </div>

                <p className="text-sm text-[var(--color-muted)] mb-4 line-clamp-2 leading-relaxed">
                  {agent.description || "暂无描述"}
                </p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-muted)] break-all">
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/40">工作目录</span>
                    <span title={agent.workDir || undefined}>
                      {agent.workDir?.trim()
                        ? agent.workDir
                        : `默认 · /data/agent-pro/${agent.id}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-muted)]">
                    <Cpu size={12} className="text-[#F7931A]/60" />
                    <span>{agent.llmProvider}/{agent.llmModel}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-muted)]">
                    {agent.tgBotUsername ? (
                      <>
                        <GlowDot color="green" />
                        <span>@{agent.tgBotUsername}</span>
                      </>
                    ) : (
                      <span className="text-white/20">未配置 Bot</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-white/5">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(agent)}>
                    <Edit size={14} /> 编辑
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => { if (confirm("确定删除该智能体？")) deleteMut.mutate(agent.id); }}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
              <Bot
                size={100}
                className="absolute -bottom-6 -right-6 text-white/[0.02] group-hover:text-white/[0.05] transition-colors duration-500"
              />
            </Card>
          ))}
        </div>
      )}

      <AgentFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="创建智能体"
        onSubmit={(data) => createMut.mutate(data)}
        loading={createMut.isPending}
      />

      {editing && (
        <AgentFormModal
          open={true}
          onClose={() => setEditing(null)}
          title="编辑智能体"
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
    workDir: initial?.workDir || "",
  });

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <FormGroup><Label>名称</Label><Input value={form.name} onChange={set("name")} placeholder="例如：PM Agent" /></FormGroup>
      <FormGroup><Label>描述</Label><Textarea value={form.description} onChange={set("description")} placeholder="智能体描述..." /></FormGroup>
      <FormGroup><Label>系统提示词</Label><Textarea value={form.systemPrompt} onChange={set("systemPrompt")} placeholder="你是一个项目经理..." className="min-h-[120px]" /></FormGroup>
      <div className="grid grid-cols-2 gap-4">
        <FormGroup><Label>LLM 提供商</Label>
          <Select value={form.llmProvider} onChange={set("llmProvider")}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="deepseek">DeepSeek</option>
            <option value="google">Google</option>
          </Select>
        </FormGroup>
        <FormGroup><Label>LLM 模型</Label><Input value={form.llmModel} onChange={set("llmModel")} /></FormGroup>
      </div>
      <FormGroup>
        <Label>工作目录（可选）</Label>
        <Input
          value={form.workDir}
          onChange={set("workDir")}
          placeholder="留空则使用 AGENT_WORK_DIR_TEMPLATE 或 /data/agent-pro/{agentId}"
          className="font-mono text-sm"
        />
        <p className="text-[11px] text-[var(--color-muted)] mt-1.5 leading-relaxed">
          Agent 执行 run_bash、git、codex 时的默认目录；可填绝对路径，或使用 {"{agentId}"} 占位符。
        </p>
      </FormGroup>
      <div className="grid grid-cols-2 gap-4">
        <FormGroup><Label>TG Bot Token</Label><Input value={form.tgBotToken} onChange={set("tgBotToken")} type="password" /></FormGroup>
        <FormGroup><Label>TG Bot 用户名</Label><Input value={form.tgBotUsername} onChange={set("tgBotUsername")} placeholder="不含 @" /></FormGroup>
      </div>
      {initial && (
        <FormGroup><Label>状态</Label>
          <Select value={form.status} onChange={set("status")}>
            <option value="active">活跃</option>
            <option value="paused">已暂停</option>
            <option value="disabled">已禁用</option>
          </Select>
        </FormGroup>
      )}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
        <Button variant="secondary" onClick={onClose}>取消</Button>
        <Button
          onClick={() =>
            onSubmit({
              ...form,
              workDir: form.workDir?.trim() ? form.workDir.trim() : null,
            })
          }
          disabled={!form.name || loading}
        >
          {loading ? "保存中..." : "保存"}
        </Button>
      </div>
    </Modal>
  );
}
