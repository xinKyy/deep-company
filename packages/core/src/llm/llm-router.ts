export type LlmContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | LlmContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: LlmToolCall[];
}

export interface LlmTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmCompletionInput {
  provider: string;
  model: string;
  messages: LlmMessage[];
  tools?: LlmTool[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface LlmCompletionResult {
  content: string | null;
  toolCalls: LlmToolCall[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  raw?: unknown;
}

type ProviderAdapter = (
  input: LlmCompletionInput
) => Promise<LlmCompletionResult>;

export class LlmRouter {
  private adapters = new Map<string, ProviderAdapter>();

  registerProvider(name: string, adapter: ProviderAdapter) {
    this.adapters.set(name, adapter);
  }

  async complete(input: LlmCompletionInput): Promise<LlmCompletionResult> {
    const adapter = this.adapters.get(input.provider);
    if (!adapter) {
      throw new Error(`LLM provider "${input.provider}" not registered`);
    }
    return adapter(input);
  }

  listProviders(): string[] {
    return Array.from(this.adapters.keys());
  }
}

// ─── OpenAI-compatible adapter (works for OpenAI, DeepSeek, etc.) ────────────

export function createOpenAIAdapter(
  apiKey: string,
  baseUrl = "https://api.openai.com/v1"
): ProviderAdapter {
  return async (input) => {
    const messages = input.messages.map((m) => {
      const msg: Record<string, unknown> = { role: m.role };
      // Pass multimodal content arrays through directly for vision support
      if (Array.isArray(m.content)) {
        msg.content = m.content;
      } else {
        msg.content = m.content;
      }
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.name) msg.name = m.name;
      if (m.tool_calls && m.tool_calls.length > 0) {
        msg.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: tc.function,
        }));
      }
      return msg;
    });

    const body: Record<string, unknown> = {
      model: input.model,
      messages,
      temperature: input.temperature ?? 0.7,
    };
    if (input.maxTokens) body.max_tokens = input.maxTokens;
    if (input.tools && input.tools.length > 0) body.tools = input.tools;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as any;
    const choice = data.choices?.[0];
    const message = choice?.message;

    return {
      content: message?.content || null,
      toolCalls: (message?.tool_calls || []).map((tc: any) => ({
        id: tc.id,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      raw: data,
    };
  };
}

function toAnthropicContent(content: string | LlmContentPart[]): unknown {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (part.type === "image_url") {
      const url = part.image_url.url;
      const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        return {
          type: "image",
          source: { type: "base64", media_type: match[1], data: match[2] },
        };
      }
      return { type: "image", source: { type: "url", url } };
    }
    return { type: "text", text: String(part) };
  });
}

export function createAnthropicAdapter(apiKey: string): ProviderAdapter {
  return async (input) => {
    const systemMsg = input.messages.find((m) => m.role === "system");
    const otherMsgs = input.messages.filter((m) => m.role !== "system");

    const body: Record<string, unknown> = {
      model: input.model,
      max_tokens: input.maxTokens || 4096,
      messages: otherMsgs.map((m) => ({
        role: m.role === "tool" ? "user" : m.role,
        content: toAnthropicContent(m.content),
      })),
    };
    if (systemMsg) body.system = systemMsg.content;
    if (input.tools && input.tools.length > 0) {
      body.tools = input.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as any;
    let content = "";
    const toolCalls: LlmToolCall[] = [];

    for (const block of data.content || []) {
      if (block.type === "text") content += block.text;
      if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      content: content || null,
      toolCalls,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
      raw: data,
    };
  };
}
