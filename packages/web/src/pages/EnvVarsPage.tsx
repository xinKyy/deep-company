import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card,
  CardContent,
  PageHeader,
  Button,
  Badge,
  EmptyState,
  Modal,
  Input,
  Textarea,
  Select,
  Label,
  FormGroup,
} from "../components/ui";
import {
  Plus,
  Trash2,
  KeyRound,
  Pencil,
  Eye,
  EyeOff,
  Shield,
  GitBranch,
  HardHat,
  Terminal,
  FileText,
  Settings2,
} from "lucide-react";

const CATEGORY_META: Record<
  string,
  { label: string; icon: typeof GitBranch; variant: "info" | "warning" | "success" | "orange" | "default" }
> = {
  git: { label: "Git", icon: GitBranch, variant: "info" },
  jenkins: { label: "Jenkins", icon: HardHat, variant: "warning" },
  codex: { label: "Codex", icon: Terminal, variant: "success" },
  google: { label: "Google", icon: FileText, variant: "orange" },
  custom: { label: "自定义", icon: Settings2, variant: "default" },
};

const PRESET_VARS = [
  { key: "GITHUB_TOKEN", description: "GitHub 个人访问令牌", category: "git" },
  { key: "GITLAB_TOKEN", description: "GitLab 个人访问令牌", category: "git" },
  { key: "JENKINS_TOKEN", description: "Jenkins API 令牌（user:token 格式）", category: "jenkins" },
];

export function EnvVarsPage() {
  const qc = useQueryClient();
  const { data: envVars = [] } = useQuery({
    queryKey: ["env-vars"],
    queryFn: api.envVars.list,
  });
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filter, setFilter] = useState<string>("all");

  const createMut = useMutation({
    mutationFn: api.envVars.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["env-vars"] });
      setShowCreate(false);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.envVars.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["env-vars"] });
      setEditing(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: api.envVars.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["env-vars"] }),
  });

  const filtered =
    filter === "all"
      ? envVars
      : envVars.filter((v: any) => v.category === filter);

  const existingKeys = new Set(envVars.map((v: any) => v.key));
  const missingPresets = PRESET_VARS.filter((p) => !existingKeys.has(p.key));

  return (
    <div>
      <PageHeader
        title="环境变量"
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> 添加变量
          </Button>
        }
      />

      {missingPresets.length > 0 && (
        <Card hover={false} className="mb-6">
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Shield size={14} className="text-yellow-400" />
              <h3 className="text-xs font-mono font-semibold text-yellow-400 tracking-wider uppercase">
                推荐变量
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {missingPresets.map((p) => {
                const meta = CATEGORY_META[p.category];
                const Icon = meta.icon;
                return (
                  <button
                    key={p.key}
                    onClick={() => {
                      setShowCreate(true);
                      setTimeout(() => {
                        const el = document.getElementById("env-var-key") as HTMLInputElement;
                        if (el) el.value = p.key;
                      }, 50);
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10
                      hover:border-[#F7931A]/40 hover:bg-white/[0.08] transition-all duration-200 cursor-pointer text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <Icon size={14} className="text-[var(--color-muted)]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-white truncate">{p.key}</p>
                      <p className="text-[10px] text-[var(--color-muted)] truncate">{p.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 mb-6">
        {["all", "git", "jenkins", "codex", "google", "custom"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-mono tracking-wide transition-all duration-200 cursor-pointer ${
              filter === cat
                ? "bg-[#F7931A]/15 text-[#F7931A] border border-[#F7931A]/30"
                : "bg-white/5 text-[var(--color-muted)] border border-white/10 hover:bg-white/10"
            }`}
          >
            {cat === "all" ? "All" : CATEGORY_META[cat]?.label || cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<KeyRound size={48} />}
          message="暂未配置环境变量。"
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((v: any) => {
            const meta = CATEGORY_META[v.category] || CATEGORY_META.custom;
            const Icon = meta.icon;
            return (
              <Card key={v.id} className="group">
                <CardContent className="!py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-[var(--color-muted)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-sm font-semibold text-white">
                          {v.key}
                        </span>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        {v.isSecret && (
                          <span className="text-[10px] text-[var(--color-muted)] flex items-center gap-1">
                            <EyeOff size={10} /> 敏感
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-muted)] truncate">
                        {v.description || "暂无描述"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs text-[var(--color-muted)] bg-black/30 px-3 py-1 rounded-lg max-w-[200px] truncate">
                        {v.value}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(v)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`确定删除 "${v.key}"？`))
                            deleteMut.mutate(v.id);
                        }}
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="添加环境变量"
      >
        <EnvVarForm
          onSubmit={(d) => createMut.mutate(d)}
          onCancel={() => setShowCreate(false)}
          loading={createMut.isPending}
        />
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="编辑环境变量"
      >
        {editing && (
          <EnvVarForm
            initial={editing}
            onSubmit={(d) => updateMut.mutate({ id: editing.id, data: d })}
            onCancel={() => setEditing(null)}
            loading={updateMut.isPending}
          />
        )}
      </Modal>
    </div>
  );
}

function EnvVarForm({
  initial,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: any;
  onSubmit: (d: any) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    key: initial?.key || "",
    value: "",
    description: initial?.description || "",
    category: initial?.category || "custom",
    isSecret: initial?.isSecret ?? true,
  });
  const [showValue, setShowValue] = useState(false);

  const set =
    (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <FormGroup>
        <Label>键名</Label>
        <Input
          id="env-var-key"
          value={form.key}
          onChange={set("key")}
          placeholder="GITHUB_TOKEN"
          disabled={!!initial}
        />
      </FormGroup>
      <FormGroup>
        <Label>值</Label>
        <div className="relative">
          <Input
            type={showValue ? "text" : "password"}
            value={form.value}
            onChange={set("value")}
            placeholder={initial ? "（未修改）" : "请输入值..."}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowValue(!showValue)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-white transition-colors cursor-pointer"
          >
            {showValue ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </FormGroup>
      <FormGroup>
        <Label>描述</Label>
        <Textarea
          value={form.description}
          onChange={set("description")}
          placeholder="这个变量的用途..."
        />
      </FormGroup>
      <FormGroup>
        <Label>分类</Label>
        <Select value={form.category} onChange={set("category")}>
          <option value="git">Git (GitHub / GitLab)</option>
          <option value="jenkins">Jenkins</option>
          <option value="codex">Codex CLI</option>
          <option value="google">Google</option>
          <option value="custom">自定义</option>
        </Select>
      </FormGroup>
      <FormGroup>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.isSecret}
            onChange={(e) => setForm({ ...form, isSecret: e.target.checked })}
            className="w-4 h-4 rounded accent-[#F7931A]"
          />
          <span className="text-sm text-[var(--color-muted)]">
            敏感值（界面中隐藏显示）
          </span>
        </div>
      </FormGroup>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/5">
        <Button variant="secondary" onClick={onCancel}>
          取消
        </Button>
        <Button
          onClick={() => {
            const data: any = { ...form };
            if (initial && !data.value) delete data.value;
            onSubmit(data);
          }}
          disabled={(!initial && !form.key) || loading}
        >
          {loading ? "保存中..." : initial ? "更新" : "创建"}
        </Button>
      </div>
    </>
  );
}
