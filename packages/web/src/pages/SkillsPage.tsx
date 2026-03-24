import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Button, Badge, EmptyState,
  Modal, Input, Textarea, Select, Label, FormGroup,
} from "../components/ui";
import { Plus, Trash2 } from "lucide-react";

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

      <Card className="mb-6">
        <CardContent>
          <h3 className="text-sm font-semibold mb-2">Registered Handlers (Runtime)</h3>
          <div className="flex flex-wrap gap-2">
            {registeredHandlers.map((name) => (
              <Badge key={name} variant="info">{name}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {skills.length === 0 ? (
        <EmptyState message="No custom skills defined." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill: any) => (
            <Card key={skill.id}>
              <CardContent>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{skill.name}</h3>
                  <Badge variant={skill.type === "builtin" ? "info" : "default"}>{skill.type}</Badge>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">{skill.description || "No description"}</p>
                <Button size="sm" variant="danger" onClick={() => { if (confirm("Delete?")) deleteMut.mutate(skill.id); }}>
                  <Trash2 size={14} /> Delete
                </Button>
              </CardContent>
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
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.name || loading}>{loading ? "Saving..." : "Create"}</Button>
      </div>
    </>
  );
}
