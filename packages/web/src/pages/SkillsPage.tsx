import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Button, Badge, EmptyState,
  Modal, Input, Textarea, Select, Label, FormGroup,
} from "../components/ui";
import { Plus, Trash2, Wrench, Zap } from "lucide-react";

export function SkillsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["skills"], queryFn: api.skills.list });
  const skills = data?.skills || [];
  const registeredHandlers: string[] = data?.registeredHandlers || [];
  const [showCreate, setShowCreate] = useState(false);

  const createMut = useMutation({
    mutationFn: api.skills.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["skills"] }); setShowCreate(false); },
  });

  const deleteMut = useMutation({
    mutationFn: api.skills.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });

  return (
    <div>
      <PageHeader
        title="Skills"
        action={<Button onClick={() => setShowCreate(true)}><Plus size={16} /> New Skill</Button>}
      />

      <Card hover={false} className="mb-8">
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-[#F7931A]" />
            <h3 className="text-xs font-mono font-semibold text-[var(--color-muted)] tracking-wider uppercase">
              Registered Handlers (Runtime)
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {registeredHandlers.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No handlers registered</p>
            ) : (
              registeredHandlers.map((name) => (
                <Badge key={name} variant="orange">{name}</Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {skills.length === 0 ? (
        <EmptyState icon={<Wrench size={48} />} message="No custom skills defined." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {skills.map((skill: any) => (
            <Card key={skill.id} className="group relative overflow-hidden">
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#EA580C]/15 border border-[#EA580C]/30 flex items-center justify-center">
                      <Wrench size={16} className="text-[#F7931A]" />
                    </div>
                    <h3 className="font-heading font-semibold text-white">{skill.name}</h3>
                  </div>
                  <Badge variant={skill.type === "builtin" ? "info" : "default"}>{skill.type}</Badge>
                </div>
                <p className="text-sm text-[var(--color-muted)] mb-4 leading-relaxed">
                  {skill.description || "No description"}
                </p>
                <div className="pt-3 border-t border-white/5">
                  <Button size="sm" variant="danger" onClick={() => { if (confirm("Delete?")) deleteMut.mutate(skill.id); }}>
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              </CardContent>
              <Wrench
                size={80}
                className="absolute -bottom-4 -right-4 text-white/[0.02] group-hover:text-white/[0.05] transition-colors duration-500"
              />
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Skill">
        <SkillForm
          onSubmit={(d) => createMut.mutate(d)}
          onCancel={() => setShowCreate(false)}
          loading={createMut.isPending}
        />
      </Modal>
    </div>
  );
}

function SkillForm({ onSubmit, onCancel, loading }: {
  onSubmit: (d: any) => void; onCancel: () => void; loading: boolean;
}) {
  const [form, setForm] = useState({ name: "", description: "", type: "custom" });
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <FormGroup><Label>Name</Label><Input value={form.name} onChange={set("name")} /></FormGroup>
      <FormGroup><Label>Description</Label><Textarea value={form.description} onChange={set("description")} /></FormGroup>
      <FormGroup><Label>Type</Label>
        <Select value={form.type} onChange={set("type")}>
          <option value="builtin">Builtin</option>
          <option value="custom">Custom</option>
          <option value="mcp">MCP</option>
        </Select>
      </FormGroup>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.name || loading}>{loading ? "Saving..." : "Create"}</Button>
      </div>
    </>
  );
}
