import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import {
  Card, CardContent, PageHeader, Select, EmptyState, Badge,
} from "../components/ui";

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

      <div className="mb-4 max-w-xs">
        <Select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}>
          <option value="">Select an agent...</option>
          {agents.map((a: any) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
      </div>

      {!selectedAgent ? (
        <EmptyState message="Select an agent to view messages." />
      ) : messages.length === 0 ? (
        <EmptyState message="No messages recorded for this agent." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--color-border)] max-h-[70vh] overflow-y-auto">
              {messages.map((msg: any) => (
                <div key={msg.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={msg.direction === "incoming" ? "info" : "success"}>
                      {msg.direction}
                    </Badge>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {msg.tgUsername ? `@${msg.tgUsername}` : msg.tgUserId || "system"}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)] ml-auto">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
