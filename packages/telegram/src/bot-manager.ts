import { Bot, type Context as GrammyContext } from "grammy";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { AppContext } from "./types.js";
import { createMessageHandler } from "./handlers/message-handler.js";

interface ManagedBot {
  agentId: string;
  bot: Bot;
  running: boolean;
}

export class BotManager {
  private bots = new Map<string, ManagedBot>();
  private ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  async startAll() {
    const agents = await this.ctx.agentService.listActive();
    for (const agent of agents) {
      if (agent.tgBotToken) {
        await this.startBot(agent.id, agent.tgBotToken);
      }
    }
    console.log(`BotManager: started ${this.bots.size} bot(s)`);
  }

  async startBot(agentId: string, token: string) {
    if (this.bots.has(agentId)) {
      console.log(`Bot for agent ${agentId} already running`);
      return;
    }

    const proxyUrl =
      process.env.HTTPS_PROXY || process.env.https_proxy ||
      process.env.HTTP_PROXY || process.env.http_proxy;

    const bot = proxyUrl
      ? new Bot(token, {
          client: { baseFetchConfig: { agent: new HttpsProxyAgent(proxyUrl) as any } },
        })
      : new Bot(token);
    const handler = createMessageHandler(this.ctx, agentId);

    bot.on("message", async (grammyCtx) => {
      console.log(`[BotManager] message received for agent=${agentId} chat=${grammyCtx.message?.chat.id} text="${(grammyCtx.message?.text || "").substring(0, 50)}"`);
      try {
        await handler(grammyCtx);
      } catch (err) {
        console.error(`Bot error (agent=${agentId}):`, err);
      }
    });

    bot.catch((err) => {
      console.error(`[BotManager] Bot ${agentId} middleware error:`, err);
    });

    this.bots.set(agentId, { agentId, bot, running: true });

    // Clear any stale long-poll before starting, then launch with retry
    (async () => {
      try {
        await bot.api.deleteWebhook();
        await bot.api.raw.getUpdates({ offset: -1, limit: 1, timeout: 0 });
      } catch { /* ignore cleanup errors */ }

      const launchPolling = (attempt = 1, maxAttempts = 4) => {
        const pollPromise = bot.start({
          onStart: (botInfo) => {
            console.log(`[BotManager] polling started for @${botInfo.username} (agent=${agentId})`);
          },
        });

        pollPromise.catch(async (err: any) => {
          const is409 = err?.error_code === 409 || String(err?.description || err?.message || "").includes("409");
          if (is409 && attempt < maxAttempts) {
            const delay = 15000 * attempt;
            console.warn(`[BotManager] Bot ${agentId} polling conflict (attempt ${attempt}/${maxAttempts}), retrying in ${delay / 1000}s...`);
            try { await bot.stop(); } catch { /* ok */ }
            await new Promise((r) => setTimeout(r, delay));
            launchPolling(attempt + 1, maxAttempts);
          } else {
            console.error(`[BotManager] Bot ${agentId} polling stopped (attempt ${attempt}):`, err.message || err);
            const managed = this.bots.get(agentId);
            if (managed) managed.running = false;
          }
        });
      };

      launchPolling();
    })();

    console.log(`Bot started for agent: ${agentId}`);
  }

  async stopBot(agentId: string) {
    const managed = this.bots.get(agentId);
    if (!managed) return;

    await managed.bot.stop();
    managed.running = false;
    this.bots.delete(agentId);
    console.log(`Bot stopped for agent: ${agentId}`);
  }

  async restartBot(agentId: string, token: string) {
    await this.stopBot(agentId);
    await this.startBot(agentId, token);
  }

  async stopAll() {
    for (const [agentId] of this.bots) {
      await this.stopBot(agentId);
    }
  }

  getRunningBots(): string[] {
    return Array.from(this.bots.keys());
  }

  getBotForAgent(agentId: string): Bot | undefined {
    return this.bots.get(agentId)?.bot;
  }
}
