import { xService } from "../services/x-service";
import { storage } from "../storage";

export async function runBotCycle() {
  const bots = await storage.getAllBots();
  const activeBots = bots.filter(b => b.status === "active" && b.xUsername);

  for (const bot of activeBots) {
    try {
      // 1. Check if it's time to post
      const lastPost = bot.lastPostAt ? new Date(bot.lastPostAt).getTime() : 0;
      const interval = (bot.postingIntervalMinutes || 120) * 60 * 1000;
      
      if (Date.now() - lastPost > interval) {
        console.log(`Bot ${bot.botName} is generating a post...`);
        // In a real scenario, call AI to generate content based on personalityPrompt
        const content = `Automated update from ${bot.botName}! #Solana #AI`;
        await xService.postTweet(bot.id, content);
        
        await storage.updateBot(bot.id, { lastPostAt: new Date() });
        await storage.createAuditLog({
          botId: bot.id,
          userId: bot.userId,
          action: "tweet_posted",
          details: { content },
          source: "worker"
        });
      }

      // 2. Check for mentions (simplified)
      // Implementation would involve polling /2/users/:id/mentions
    } catch (error) {
      console.error(`Error in cycle for bot ${bot.id}:`, error);
    }
  }
}
