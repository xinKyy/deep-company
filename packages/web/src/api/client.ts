const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  agents: {
    list: () => request<any[]>("/agents"),
    get: (id: string) => request<any>(`/agents/${id}`),
    create: (data: any) => request<any>("/agents", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/agents/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/agents/${id}`, { method: "DELETE" }),
    getSops: (id: string) => request<any[]>(`/agents/${id}/sops`),
    bindSop: (id: string, sopId: string) => request<any>(`/agents/${id}/sops/${sopId}`, { method: "POST" }),
    unbindSop: (id: string, sopId: string) => request<any>(`/agents/${id}/sops/${sopId}`, { method: "DELETE" }),
  },
  sops: {
    list: () => request<any[]>("/sops"),
    get: (id: string) => request<any>(`/sops/${id}`),
    create: (data: any) => request<any>("/sops", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/sops/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/sops/${id}`, { method: "DELETE" }),
    getSteps: (id: string) => request<any[]>(`/sops/${id}/steps`),
    addStep: (id: string, data: any) => request<any>(`/sops/${id}/steps`, { method: "POST", body: JSON.stringify(data) }),
    updateStep: (stepId: string, data: any) => request<any>(`/sops/steps/${stepId}`, { method: "PUT", body: JSON.stringify(data) }),
    deleteStep: (stepId: string) => request<any>(`/sops/steps/${stepId}`, { method: "DELETE" }),
  },
  tasks: {
    list: (filters?: Record<string, string>) => {
      const params = new URLSearchParams(filters || {});
      return request<any[]>(`/tasks?${params}`);
    },
    get: (id: string) => request<any>(`/tasks/${id}`),
    search: (q: string) => request<any[]>(`/tasks/search?q=${encodeURIComponent(q)}`),
    create: (data: any) => request<any>("/tasks", { method: "POST", body: JSON.stringify(data) }),
    transition: (id: string, status: string, comment?: string) =>
      request<any>(`/tasks/${id}/transition`, { method: "POST", body: JSON.stringify({ status, comment }) }),
    delete: (id: string) => request<any>(`/tasks/${id}`, { method: "DELETE" }),
  },
  projects: {
    list: () => request<any[]>("/projects"),
    get: (id: string) => request<any>(`/projects/${id}`),
    create: (data: any) => request<any>("/projects", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/projects/${id}`, { method: "DELETE" }),
  },
  skills: {
    list: () => request<any>("/skills"),
    create: (data: any) => request<any>("/skills", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/skills/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/skills/${id}`, { method: "DELETE" }),
  },
  mcps: {
    list: () => request<any[]>("/mcps"),
    create: (data: any) => request<any>("/mcps", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/mcps/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/mcps/${id}`, { method: "DELETE" }),
  },
  memories: {
    list: (params?: Record<string, string>) => {
      const qs = new URLSearchParams(params || {});
      return request<any[]>(`/memories?${qs}`);
    },
    delete: (id: string) => request<any>(`/memories/${id}`, { method: "DELETE" }),
  },
  messages: {
    list: (params: Record<string, string>) => {
      const qs = new URLSearchParams(params);
      return request<any[]>(`/messages?${qs}`);
    },
  },
  envVars: {
    list: () => request<any[]>("/env-vars"),
    create: (data: any) =>
      request<any>("/env-vars", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: any) =>
      request<any>(`/env-vars/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<any>(`/env-vars/${id}`, { method: "DELETE" }),
  },
};
