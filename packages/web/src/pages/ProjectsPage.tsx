import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Button, StatusBadge, EmptyState,
  Modal, Input, Textarea, Label, FormGroup,
} from "../components/ui";
import { Plus, Trash2, Edit, FolderKanban, ExternalLink } from "lucide-react";

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
        title="项目"
        action={<Button onClick={() => setShowCreate(true)}><Plus size={16} /> 新建项目</Button>}
      />

      {projects.length === 0 ? (
        <EmptyState icon={<FolderKanban size={48} />} message="暂无项目。" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj: any) => (
            <Card key={proj.id} className="group relative overflow-hidden">
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F7931A]/10 border border-[#F7931A]/20 flex items-center justify-center">
                      <FolderKanban size={18} className="text-[#F7931A]" />
                    </div>
                    <h3 className="font-heading font-semibold text-white">{proj.name}</h3>
                  </div>
                  <StatusBadge status={proj.status} />
                </div>
                <p className="text-sm text-[var(--color-muted)] mb-3 line-clamp-2 leading-relaxed">
                  {proj.description || "暂无描述"}
                </p>
                {proj.repoUrl && (
                  <a
                    href={proj.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-[#F7931A] hover:text-[#FFD600] transition-colors mb-4 truncate max-w-full"
                  >
                    <ExternalLink size={11} />
                    <span className="truncate">{proj.repoUrl}</span>
                  </a>
                )}
                <div className="flex gap-2 pt-3 border-t border-white/5">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(proj)}>
                    <Edit size={14} /> 编辑
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => { if (confirm("确定删除？")) deleteMut.mutate(proj.id); }}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
              <FolderKanban
                size={100}
                className="absolute -bottom-6 -right-6 text-white/[0.02] group-hover:text-white/[0.05] transition-colors duration-500"
              />
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showCreate || !!editing}
        onClose={() => { setShowCreate(false); setEditing(null); }}
        title={editing ? "编辑项目" : "创建项目"}
      >
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
      <FormGroup><Label>名称</Label><Input value={form.name} onChange={set("name")} placeholder="例如：AF" /></FormGroup>
      <FormGroup><Label>描述</Label><Textarea value={form.description} onChange={set("description")} /></FormGroup>
      <FormGroup><Label>仓库地址</Label><Input value={form.repoUrl} onChange={set("repoUrl")} placeholder="https://github.com/..." /></FormGroup>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
        <Button variant="secondary" onClick={onCancel}>取消</Button>
        <Button onClick={() => onSubmit(form)} disabled={!form.name || loading}>{loading ? "保存中..." : "保存"}</Button>
      </div>
    </>
  );
}
