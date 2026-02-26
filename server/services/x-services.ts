import { storage } from "../storage";
import { encrypt, decrypt } from "../crypto";
import axios from "axios";

export class XService {
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.X_CLIENT_ID || "";
    this.clientSecret = process.env.X_CLIENT_SECRET || "";
  }

  async refreshBotToken(botId: number) {
    const account = await storage.getBotXAccount(botId);
    if (!account) throw new Error("No X account connected");

    const refreshToken = decrypt(account.encryptedRefreshToken);
    
    try {
      const response = await axios.post("https://api.twitter.com/2/oauth2/token", 
        new URLSearchParams({
          refresh_token: refreshToken,
          grant_type: "refresh_token",
          client_id: this.clientId,
        }).toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          auth: { username: this.clientId, password: this.clientSecret }
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      
      await storage.upsertBotXAccount({
        botId,
        xUserId: account.xUserId!,
        xUsername: account.xUsername!,
        xProfileImageUrl: account.xProfileImageUrl,
        encryptedAccessToken: encrypt(access_token),
        encryptedRefreshToken: encrypt(refresh_token),
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
      });

      return access_token;
    } catch (error) {
      console.error(`Failed to refresh token for bot ${botId}:`, error);
      throw error;
    }
  }

  async postTweet(botId: number, text: string) {
    const account = await storage.getBotXAccount(botId);
    if (!account) throw new Error("No X account connected");

    let accessToken = decrypt(account.encryptedAccessToken);
    
    // Check if token is expired (simplified)
    if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      accessToken = await this.refreshBotToken(botId);
    }

    return axios.post("https://api.twitter.com/2/tweets", 
      { text },
      { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
    );
  }
}

export const xService = new XService();
