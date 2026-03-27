import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Button, Badge,
  Input, Label, FormGroup,
} from "../components/ui";
import {
  PenTool, Link, Image, FileCode2, LayoutGrid,
  Code2, Loader2, CheckCircle, XCircle, Download,
} from "lucide-react";

type TabId = "overview" | "fetch";

export function FigmaPage() {
  const [tab, setTab] = useState<TabId>("overview");

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["figma-status"],
    queryFn: api.figma.status,
    refetchInterval: 30_000,
  });

  const tabs: { id: TabId; label: string; icon: typeof PenTool }[] = [
    { id: "overview", label: "概览", icon: LayoutGrid },
    { id: "fetch", label: "获取设计", icon: Image },
  ];

  return (
    <div>
      <PageHeader
        title="Figma 设计工坊"
        action={
          <div className="flex items-center gap-3">
            {statusLoading ? (
              <Badge variant="default"><Loader2 size={12} className="animate-spin" /> 连接中</Badge>
            ) : status?.connected ? (
              <Badge variant="success"><CheckCircle size={12} /> 已连接</Badge>
            ) : (
              <Badge variant="error"><XCircle size={12} /> 未连接</Badge>
            )}
          </div>
        }
      />

      <div className="flex gap-2 mb-6 border-b border-white/5 pb-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer
              ${tab === id
                ? "bg-[#F7931A]/10 text-[#F7931A] shadow-[0_0_15px_-5px_rgba(247,147,26,0.3)]"
                : "text-[var(--color-muted)] hover:text-white hover:bg-white/5"
              }
            `}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab connected={status?.connected ?? false} tools={status?.tools} reason={status?.reason} />}
      {tab === "fetch" && <FetchDesignTab />}
    </div>
  );
}

function OverviewTab({ connected, tools, reason }: { connected: boolean; tools?: string[]; reason?: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <Card>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#F7931A]/10 border border-[#F7931A]/20 flex items-center justify-center">
              <PenTool size={20} className="text-[#F7931A]" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-white">连接状态</h3>
              <p className="text-xs text-[var(--color-muted)]">Figma MCP 服务</p>
            </div>
          </div>
          {connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle size={14} /> MCP 服务已连接
              </div>
              {tools && tools.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-[var(--color-muted)]">可用工具：</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tools.map((t) => (
                      <span key={t} className="px-2 py-0.5 text-xs font-mono rounded bg-[#F7931A]/10 text-[#F7931A] border border-[#F7931A]/20">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <XCircle size={14} /> 未连接
              </div>
              {reason && <p className="text-xs text-[var(--color-muted)]">{reason}</p>}
              <div className="text-xs text-[var(--color-muted)] bg-black/30 rounded-lg p-3 space-y-1">
                <p>请在 .env 中配置：</p>
                <p className="font-mono text-[#F7931A]">FIGMA_MCP_COMMAND=npx</p>
                <p className="font-mono text-[#F7931A]">FIGMA_MCP_ARGS=-y figma-developer-mcp --stdio</p>
                <p className="font-mono text-[#F7931A]">FIGMA_ACCESS_TOKEN=figd_xxx</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="font-heading font-semibold text-white mb-4">可用能力</h3>
          <div className="space-y-3">
            {[
              { icon: FileCode2, label: "获取设计数据", desc: "获取 Figma 文件的完整布局、内容、样式和组件信息" },
              { icon: Download, label: "下载图片资源", desc: "从 Figma 下载 SVG、PNG、GIF 图片到本地目录" },
              { icon: Code2, label: "设计转代码", desc: "Agent 可自动获取设计数据并生成前端代码" },
              { icon: Link, label: "URL 智能解析", desc: "粘贴 Figma 链接自动提取 fileKey 和 nodeId" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-black/20 border border-white/5">
                <Icon size={16} className="text-[#F7931A] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-[var(--color-muted)]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FetchDesignTab() {
  const [url, setUrl] = useState("");
  const [fileKey, setFileKey] = useState("");
  const [nodeId, setNodeId] = useState("");

  const parseMut = useMutation({
    mutationFn: (u: string) => api.figma.parseUrl(u),
    onSuccess: (data) => {
      setFileKey(data.fileKey);
      if (data.nodeId) setNodeId(data.nodeId);
    },
  });

  const designMut = useMutation({
    mutationFn: () =>
      api.figma.getDesignData({
        fileKey,
        nodeId: nodeId || undefined,
      }),
  });

  const handleParseUrl = () => {
    if (url.trim()) parseMut.mutate(url.trim());
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <h3 className="font-heading font-semibold text-white mb-4">从 Figma URL 获取设计数据</h3>
          <FormGroup>
            <Label>Figma URL</Label>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.figma.com/design/abc123/MyFile?node-id=1-2"
              />
              <Button
                variant="secondary"
                onClick={handleParseUrl}
                disabled={!url.trim() || parseMut.isPending}
                className="shrink-0"
              >
                <Link size={14} /> 解析
              </Button>
            </div>
            {parseMut.error && (
              <p className="mt-2 text-red-400 text-xs">{parseMut.error.message}</p>
            )}
          </FormGroup>

          <div className="grid grid-cols-2 gap-4">
            <FormGroup>
              <Label>File Key</Label>
              <Input value={fileKey} onChange={(e) => setFileKey(e.target.value)} placeholder="abc123" />
            </FormGroup>
            <FormGroup>
              <Label>Node ID（可选）</Label>
              <Input value={nodeId} onChange={(e) => setNodeId(e.target.value)} placeholder="1234:5678" />
            </FormGroup>
          </div>

          <Button
            onClick={() => designMut.mutate()}
            disabled={!fileKey || designMut.isPending}
          >
            {designMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <FileCode2 size={14} />}
            获取设计数据
          </Button>
        </CardContent>
      </Card>

      {designMut.data && (
        <Card>
          <CardContent>
            <h3 className="font-heading font-semibold text-white mb-3">设计数据</h3>
            <pre className="text-xs text-[var(--color-muted)] bg-black/30 rounded-lg p-4 overflow-auto max-h-[600px] whitespace-pre-wrap">
              {designMut.data.data}
            </pre>
          </CardContent>
        </Card>
      )}

      {designMut.error && (
        <Card>
          <CardContent>
            <p className="text-red-400 text-sm">{designMut.error.message}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
