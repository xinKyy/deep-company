import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Button, StatusBadge, EmptyState,
  Modal, Input, Textarea, Label, FormGroup,
} from "../components/ui";
import { Plus, Trash2 } from "lucide-react";

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
        <EmptyState message="No MCP servers configured." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {servers.map((srv: any) => (
            <Card key={srv.id}>
              <CardContent>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{srv.name}</h3>
                  <StatusBadge status={srv.status} />
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">{srv.description || "No description"}</p>
                <p className="text-xs font-mono text-[var(--color-text-secondary)] mb-3">
                  {srv.command} {JSON.parse(srv.args || "[]").join(" ")}
                </p>
                <Button size="sm" variant="danger" onClick={() => { if (confirm("Delete?")) deleteMut.mutate(srv.id); }}>
                  <Trash2 size={14} /> Delete
                </Button>
              </CardContent>
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
      <div className="flex justify-end gap-2 mt-4">
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
