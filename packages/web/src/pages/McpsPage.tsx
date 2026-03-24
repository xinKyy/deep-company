import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Button, StatusBadge, EmptyState,
  Modal, Input, Textarea, Label, FormGroup,
} from "../components/ui";
import { Plus, Trash2, Server, Terminal } from "lucide-react";

export function McpsPage() {
  const qc = useQueryClient();
  const { data: servers = [] } = useQuery({ queryKey: ["mcps"], queryFn: api.mcps.list });
  const [showCreate, setShowCreate] = useState(false);

  const createMut = useMutation({
    mutationFn: api.mcps.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mcps"] }); setShowCreate(false); },
  });

  const deleteMut = useMutation({
    mutationFn: api.mcps.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcps"] }),
  });

  return (
    <div>
      <PageHeader
        title="MCP Servers"
        action={<Button onClick={() => setShowCreate(true)}><Plus size={16} /> New MCP Server</Button>}
      />

      {servers.length === 0 ? (
        <EmptyState icon={<Server size={48} />} message="No MCP servers configured." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {servers.map((srv: any) => (
            <Card key={srv.id} className="group relative overflow-hidden">
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F7931A]/10 border border-[#F7931A]/20 flex items-center justify-center">
                      <Server size={16} className="text-[#F7931A]" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-white">{srv.name}</h3>
                      <p className="text-xs text-[var(--color-muted)]">{srv.description || "No description"}</p>
                    </div>
                  </div>
                  <StatusBadge status={srv.status} />
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/30 border border-white/5 mb-4">
                  <Terminal size={12} className="text-[#F7931A]/60 shrink-0" />
                  <p className="text-xs font-mono text-[var(--color-muted)] truncate">
                    {srv.command} {JSON.parse(srv.args || "[]").join(" ")}
                  </p>
                </div>
                <div className="pt-3 border-t border-white/5">
                  <Button size="sm" variant="danger" onClick={() => { if (confirm("Delete?")) deleteMut.mutate(srv.id); }}>
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              </CardContent>
              <Server
                size={80}
                className="absolute -bottom-4 -right-4 text-white/[0.02] group-hover:text-white/[0.05] transition-colors duration-500"
              />
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add MCP Server">
        <McpForm
          onSubmit={(d) => createMut.mutate(d)}
          onCancel={() => setShowCreate(false)}
          loading={createMut.isPending}
        />
      </Modal>
    </div>
  );
}

function McpForm({ onSubmit, onCancel, loading }: {
  onSubmit: (d: any) => void; onCancel: () => void; loading: boolean;
}) {
  const [form, setForm] = useState({ name: "", description: "", command: "", args: "" });
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <FormGroup><Label>Name</Label><Input value={form.name} onChange={set("name")} placeholder="e.g. filesystem" /></FormGroup>
      <FormGroup><Label>Description</Label><Textarea value={form.description} onChange={set("description")} /></FormGroup>
      <FormGroup><Label>Command</Label><Input value={form.command} onChange={set("command")} placeholder="e.g. npx" /></FormGroup>
      <FormGroup><Label>Arguments (space-separated)</Label><Input value={form.args} onChange={set("args")} placeholder="e.g. -y @modelcontextprotocol/server-filesystem /tmp" /></FormGroup>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => onSubmit({ ...form, args: form.args.split(/\s+/).filter(Boolean) })}
          disabled={!form.name || !form.command || loading}
        >
          {loading ? "Saving..." : "Create"}
        </Button>
      </div>
    </>
  );
}
