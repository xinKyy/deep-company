import { mkdirSync } from "fs";
import { resolve } from "path";

const DEFAULT_TEMPLATE = "/data/agent-pro/{agentId}";

/**
 * Resolves the agent filesystem workspace.
 * - If `workDirOverride` is set, it is used (supports `{agentId}`).
 * - Otherwise uses `AGENT_WORK_DIR_TEMPLATE` or `/data/agent-pro/{agentId}`.
 */
export function resolveAgentWorkDir(
  agentId: string,
  workDirOverride: string | null | undefined
): string {
  const trimmed = workDirOverride?.trim();
  if (trimmed) {
    return resolveExpanded(trimmed, agentId);
  }
  const template =
    process.env.AGENT_WORK_DIR_TEMPLATE?.trim() || DEFAULT_TEMPLATE;
  return resolveExpanded(template, agentId);
}

function resolveExpanded(pathOrTemplate: string, agentId: string): string {
  const withId = pathOrTemplate.replace(/\{agentId\}/g, agentId);
  return resolve(withId);
}

export function ensureAgentWorkDir(path: string): void {
  mkdirSync(path, { recursive: true });
}
