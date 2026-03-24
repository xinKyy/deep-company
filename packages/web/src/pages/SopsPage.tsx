import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Button, EmptyState,
  Modal, Input, Textarea, Select, Label, FormGroup, Badge,
} from "../components/ui";
import { Plus, Trash2, ChevronDown, ChevronRight, GitBranch } from "lucide-react";

export function SopsPage() {
  const qc = useQueryClient();
  const { data: sops = [] } = useQuery({ queryKey: ["sops"], queryFn: api.sops.list });
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: api.sops.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sops"] }); setShowCreate(false); },
  });

  const deleteMut = useMutation({
    mutationFn: api.sops.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sops"] }),
  });

  return (
    <div>
      <PageHeader
        title="SOPs"
        action={<Button onClick={() => setShowCreate(true)}><Plus size={16} /> New SOP</Button>}
      />

      {sops.length === 0 ? (
        <EmptyState icon={<GitBranch size={48} />} message="No SOPs defined yet." />
      ) : (
        <div className="space-y-4">
          {sops.map((sop: any) => (
            <SopCard
              key={sop.id}
              sop={sop}
              expanded={expanded === sop.id}
              onToggle={() => setExpanded(expanded === sop.id ? null : sop.id)}
              onDelete={() => { if (confirm("Delete?")) deleteMut.mutate(sop.id); }}
            />
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create SOP">
        <SopForm
          onSubmit={(d) => createMut.mutate(d)}
          onCancel={() => setShowCreate(false)}
          loading={createMut.isPending}
        />
      </Modal>
    </div>
  );
}

function SopCard({ sop, expanded, onToggle, onDelete }: {
  sop: any; expanded: boolean; onToggle: () => void; onDelete: () => void;
}) {
  const { data: steps = [] } = useQuery({
    queryKey: ["sop-steps", sop.id],
    queryFn: () => api.sops.getSteps(sop.id),
    enabled: expanded,
  });
  const qc = useQueryClient();
  const [showAddStep, setShowAddStep] = useState(false);

  const addStepMut = useMutation({
    mutationFn: (data: any) => api.sops.addStep(sop.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sop-steps", sop.id] }); setShowAddStep(false); },
  });

  const deleteStepMut = useMutation({
    mutationFn: api.sops.deleteStep,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sop-steps", sop.id] }),
  });

  return (
    <Card hover={false}>
      <div className="px-6 py-5 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors" onClick={onToggle}>
        <div className="text-[var(--color-muted)]">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        <div className="w-8 h-8 rounded-lg bg-[#F7931A]/10 border border-[#F7931A]/20 flex items-center justify-center">
          <GitBranch size={14} className="text-[#F7931A]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-semibold text-white">{sop.name}</h3>
          <p className="text-xs text-[var(--color-muted)] truncate">{sop.description || "No description"}</p>
        </div>
        <Badge variant="orange">{sop.triggerType}</Badge>
        <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 size={14} />
        </Button>
      </div>
      {expanded && (
        <CardContent className="border-t border-white/5 pt-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-mono font-semibold text-[var(--color-muted)] tracking-wider uppercase">
              Steps ({steps.length})
            </p>
            <Button size="sm" variant="secondary" onClick={() => setShowAddStep(true)}>
              <Plus size={14} /> Add Step
            </Button>
          </div>
          {steps.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No steps defined.</p>
          ) : (
            <div className="relative pl-6 border-l border-[#F7931A]/20 space-y-3">
              {steps.map((step: any, i: number) => (
                <div key={step.id} className="relative group/step">
                  <div className="absolute -left-[29px] top-3 w-3 h-3 rounded-full bg-[var(--color-surface)] border-2 border-[#F7931A]/50 group-hover/step:border-[#F7931A] transition-colors" />
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/5 hover:border-[#F7931A]/20 transition-all">
                    <span className="text-[10px] font-mono text-[#F7931A] w-5 text-center font-bold">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{step.name}</p>
                      <p className="text-xs font-mono text-[var(--color-muted)] tracking-wider">{step.actionType}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete step?")) deleteStepMut.mutate(step.id); }}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddStep && (
            <div className="mt-4 p-4 border border-white/10 rounded-xl bg-black/20">
              <StepForm
                stepOrder={steps.length + 1}
                onSubmit={(d) => addStepMut.mutate(d)}
                onCancel={() => setShowAddStep(false)}
                loading={addStepMut.isPending}
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function SopForm({ onSubmit, onCancel, loading }: {
  onSubmit: (d: any) => void; onCancel: () => void; loading: boolean;
}) {
  const [form, setForm] = useState({ name: "", description: "", triggerType: "intent" });
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <FormGroup><Label>Name</Label><Input value={form.name} onChange={set("name")} placeholder="e.g. Handle Feature Request" /></FormGroup>
      <FormGroup><Label>Description</Label><Textarea value={form.description} onChange={set("description")} /></FormGroup>
      <FormGroup><Label>Trigger Type</Label>
        <Select value={form.triggerType} onChange={set("triggerType")}>
          <option value="intent">Intent (LLM matches)</option>
          <option value="keyword">Keyword</option>
          <option value="manual">Manual</option>
          <option value="event">Event</option>
        </Select>
      </FormGroup>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.name || loading}>{loading ? "Saving..." : "Create"}</Button>
      </div>
    </>
  );
}

function StepForm({ stepOrder, onSubmit, onCancel, loading }: {
  stepOrder: number; onSubmit: (d: any) => void; onCancel: () => void; loading: boolean;
}) {
  const [form, setForm] = useState({
    name: "", stepOrder, actionType: "llm_call", description: "",
  });
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <FormGroup><Label>Step Name</Label><Input value={form.name} onChange={set("name")} /></FormGroup>
      <FormGroup><Label>Action Type</Label>
        <Select value={form.actionType} onChange={set("actionType")}>
          <option value="llm_call">LLM Call</option>
          <option value="skill_call">Skill Call</option>
          <option value="mcp_call">MCP Call</option>
          <option value="human_input">Human Input</option>
          <option value="notify">Notify</option>
          <option value="create_task">Create Task</option>
          <option value="transition_task">Transition Task</option>
          <option value="condition">Condition</option>
        </Select>
      </FormGroup>
      <div className="flex justify-end gap-2 mt-4">
        <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onSubmit(form)} disabled={!form.name || loading}>
          {loading ? "Adding..." : "Add Step"}
        </Button>
      </div>
    </>
  );
}
