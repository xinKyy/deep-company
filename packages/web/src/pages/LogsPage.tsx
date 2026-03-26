import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type LogEntry } from "../api/client";
import { Card, PageHeader, Button } from "../components/ui";
import { ScrollText, RefreshCw } from "lucide-react";

const LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "debug", label: "debug+" },
  { value: "info", label: "info+" },
  { value: "warn", label: "warn+" },
  { value: "error", label: "仅 error" },
];

function levelClass(level: LogEntry["level"]) {
  switch (level) {
    case "debug":
      return "text-zinc-500";
    case "info":
      return "text-sky-300/90";
    case "warn":
      return "text-amber-300/90";
    case "error":
      return "text-red-400";
    default:
      return "text-[var(--color-muted)]";
  }
}

export function LogsPage() {
  const [minLevel, setMinLevel] = useState("all");
  const [limit, setLimit] = useState(500);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [stickBottom, setStickBottom] = useState(true);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["logs", minLevel, limit],
    queryFn: () => api.logs.list({ level: minLevel, limit }),
    refetchInterval: autoRefresh ? 2000 : false,
  });

  useEffect(() => {
    if (stickBottom && data?.entries?.length) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [data?.entries, stickBottom]);

  const entries = data?.entries ?? [];

  return (
    <div>
      <PageHeader
        title="运行日志"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            刷新
          </Button>
        }
      />

      <p className="text-sm text-[var(--color-muted)] mb-6 -mt-4 max-w-3xl">
        拦截 API 进程内的 console 输出，可按最低级别过滤；同时写入本地文件（NDJSON），便于在服务器上排查。
      </p>

      <Card hover={false} className="overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-[var(--color-muted)] tracking-wider uppercase">
              级别
            </label>
            <select
              value={minLevel}
              onChange={(e) => setMinLevel(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#F7931A]/40"
            >
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-[var(--color-muted)] tracking-wider uppercase">
              条数
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#F7931A]/40"
            >
              {[200, 500, 1000, 2000].map((n) => (
                <option key={n} value={n}>
                  最近 {n} 条
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-white/20 bg-white/5 text-[#F7931A] focus:ring-[#F7931A]/40"
            />
            <span className="text-xs font-mono text-[var(--color-muted)]">每 2 秒自动刷新</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={stickBottom}
              onChange={(e) => setStickBottom(e.target.checked)}
              className="rounded border-white/20 bg-white/5 text-[#F7931A] focus:ring-[#F7931A]/40"
            />
            <span className="text-xs font-mono text-[var(--color-muted)]">跟随最新</span>
          </label>
          {data && (
            <span className="text-xs font-mono text-[var(--color-muted)] ml-auto">
              共 {data.total} 条（筛选后）
            </span>
          )}
        </div>

        {data?.logFile && (
          <div className="px-6 py-2 border-b border-white/5 bg-black/20">
            <p className="text-[10px] font-mono text-[var(--color-muted)] truncate" title={data.logFile}>
              文件: {data.logFile}
            </p>
          </div>
        )}

        <div className="relative">
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 opacity-[0.03] pointer-events-none"
            aria-hidden
          >
            <ScrollText size={120} />
          </div>
          <div
            className="max-h-[min(70vh,560px)] overflow-auto p-4 font-mono text-[11px] leading-relaxed"
            onScroll={(e) => {
              const el = e.currentTarget;
              const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              setStickBottom(nearBottom);
            }}
          >
            {isLoading && (
              <p className="text-[var(--color-muted)] text-sm">加载中…</p>
            )}
            {isError && (
              <p className="text-red-400 text-sm">
                {(error as Error)?.message || "加载失败"}
              </p>
            )}
            {!isLoading && !isError && entries.length === 0 && (
              <p className="text-[var(--color-muted)] text-sm">暂无日志</p>
            )}
            {entries.map((line, i) => (
              <div
                key={`${line.time}-${i}`}
                className="border-b border-white/[0.04] py-1.5 px-1 hover:bg-white/[0.02] break-words"
              >
                <span className="text-zinc-500 shrink-0">
                  {line.time.replace("T", " ").slice(0, 23)}
                </span>{" "}
                <span className={`font-semibold uppercase ${levelClass(line.level)}`}>
                  [{line.level}]
                </span>{" "}
                <span className="text-zinc-300/95 whitespace-pre-wrap">{line.message}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      </Card>
    </div>
  );
}
