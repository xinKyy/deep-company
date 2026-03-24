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
      try {
        await handler(grammyCtx);
      } catch (err) {
        console.error(`Bot error (agent=${agentId}):`, err);
      }
    });

    bot.catch((err) => {
      console.error(`Bot crash (agent=${agentId}):`, err);
    });

    bot.start();
    this.bots.set(agentId, { agentId, bot, running: true });
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
