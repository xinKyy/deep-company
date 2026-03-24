import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Button, StatusBadge, EmptyState,
  Modal, Input, Textarea, Label, FormGroup,
} from "../components/ui";
import { Plus, Trash2, Edit } from "lucide-react";

export function ProjectsPage() {
  const qc = useQueryClient();
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const createMut = useMutation({
    mutationFn: api.projects.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: any) => api.projects.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: api.projects.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  return (
    <div>
      <PageHeader
        title="Projects"
        action={<Button onClick={() => setShowCreate(true)}><Plus size={16} /> New Project</Button>}
      />

      {projects.length === 0 ? (
        <EmptyState message="No projects yet." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj: any) => (
            <Card key={proj.id}>
              <CardContent>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{proj.name}</h3>
                  <StatusBadge status={proj.status} />
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-2 line-clamp-2">{proj.description || "No description"}</p>
                {proj.repoUrl && (
                  <p className="text-xs text-[var(--color-primary-light)] mb-3 truncate">{proj.repoUrl}</p>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(proj)}><Edit size={14} /> Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => { if (confirm("Delete?")) deleteMut.mutate(proj.id); }}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate || !!editing} onClose={() => { setShowCreate(false); setEditing(null); }} title={editing ? "Edit Project" : "Create Project"}>
        <ProjectForm
          initial={editing}
          onSubmit={(d) => editing ? updateMut.mutate({ id: editing.id, ...d }) : createMut.mutate(d)}
          onCancel={() => { setShowCreate(false); setEditing(null); }}
          loading={createMut.isPending || updateMut.isPending}
        />
      </Modal>
    </div>
  );
}

function ProjectForm({ initial, onSubmit, onCancel, loading }: {
  initial?: any; onSubmit: (d: any) => void; onCancel: () => void; loading: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "", description: initial?.description || "", repoUrl: initial?.repoUrl || "",
  });
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <FormGroup><Label>Name</Label><Input value={form.name} onChange={set("name")} placeholder="e.g. AF" /></FormGroup>
      <FormGroup><Label>Description</Label><Textarea value={form.description} onChange={set("description")} /></FormGroup>
      <FormGroup><Label>Repo URL</Label><Input value={form.repoUrl} onChange={set("repoUrl")} placeholder="https://github.com/..." /></FormGroup>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.name || loading}>{loading ? "Saving..." : "Save"}</Button>
      </div>
    </>
  );
}
