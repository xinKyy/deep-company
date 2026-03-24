import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Select, EmptyState, Badge,
} from "../components/ui";
import { MessageSquare, ArrowDownLeft, ArrowUpRight } from "lucide-react";

export function MessagesPage() {
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: api.agents.list });
  const [selectedAgent, setSelectedAgent] = useState("");

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", selectedAgent],
    queryFn: () => api.messages.list({ agentId: selectedAgent, limit: "100" }),
    enabled: !!selectedAgent,
  });

  return (
    <div>
      <PageHeader title="Messages" />

      <div className="mb-6 max-w-sm">
        <label className="block text-xs font-mono text-[var(--color-muted)] mb-2 tracking-wider uppercase">
          Select Agent
        </label>
        <Select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
          <option value="">Select an agent...</option>
          {agents.map((a: any) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
      </div>

      {!selectedAgent ? (
        <EmptyState icon={<MessageSquare size={48} />} message="Select an agent to view messages." />
      ) : messages.length === 0 ? (
        <EmptyState icon={<MessageSquare size={48} />} message="No messages recorded for this agent." />
      ) : (
        <Card hover={false}>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5 max-h-[70vh] overflow-y-auto">
              {messages.map((msg: any) => (
                <div key={msg.id} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      msg.direction === "incoming"
                        ? "bg-sky-500/10 text-sky-400"
                        : "bg-[#F7931A]/10 text-[#F7931A]"
                    }`}>
                      {msg.direction === "incoming" ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                    </div>
                    <Badge variant={msg.direction === "incoming" ? "info" : "orange"}>
                      {msg.direction}
                    </Badge>
                    <span className="text-xs font-mono text-[var(--color-muted)]">
                      {msg.tgUsername ? `@${msg.tgUsername}` : msg.tgUserId || "system"}
                    </span>
                    <span className="text-[10px] font-mono text-white/20 ml-auto">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed pl-8">
                    {msg.content}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
