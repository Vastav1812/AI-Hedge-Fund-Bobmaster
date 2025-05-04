import dotenv from "dotenv";
import { AIHedgeFundAgent } from "./agent/AIHedgeFundAgent";
import { RiskProfileType, StrategyType, UserSettings } from "./models/types";
import { SoneiumWalletService } from "./services/SoneiumWalletService";
import { GeminiService } from "./services/GeminiService";
import { MarketDataServiceFactory } from "./services/MarketDataServiceFactory";
import { DEXService } from "./services/DEXService";
import { PortfolioMetricsService } from "./services/PortfolioMetricsService";
import { IMarketDataService } from "./services/IMarketDataService";
import {
  WalletServiceFactory,
  WalletType,
} from "./services/WalletServiceFactory";
import { SequenceWalletService } from "./services/SequenceWalletService";

// Load environment variables
dotenv.config();

async function main() {
  console.log("Starting AI Hedge Fund...");

  // Create sample user settings
  const userSettings: UserSettings = {
    riskProfile: {
      type: RiskProfileType.Balanced,
      maxDrawdown: 0.15,
      leverage: 1.2,
      positionSizeFactor: 0.3,
      maxExposurePerAsset: 0.3,
      stopLossPercentage: 5,
      takeProfitPercentage: 15,
    },
    preferredStrategies: [
      StrategyType.Momentum,
      StrategyType.Arbitrage,
      StrategyType.CopyTrading,
    ],
    maxFeePercentage: 0.5,
    rebalancingFrequency: "daily",
    notificationPreferences: {
      email: true,
      push: true,
      tradingUpdates: true,
      performanceReports: true,
    },
  };

  // Initialize services
  // Use Sequence wallet if specified in .env, otherwise fall back to Soneium
  const walletType =
    (process.env.WALLET_TYPE as WalletType) || WalletType.SONEIUM;
  const walletService = WalletServiceFactory.createWalletService(walletType);
  await walletService.initialize();

  const geminiService = new GeminiService();
  // Use real market data if available
  const marketDataService =
    MarketDataServiceFactory.createMarketDataService(true);
  const dexService = new DEXService(walletService as SoneiumWalletService);
  const metricsService = new PortfolioMetricsService();

  // Initialize AI agent with a unique ID
  const agentId = `agent-${Date.now()}`;
  const agent = new AIHedgeFundAgent(
    agentId,
    userSettings.riskProfile,
    walletService as SequenceWalletService,
    geminiService,
    marketDataService,
    dexService,
    metricsService
  );

  // Start the agent
  await agent.start();

  // Log confirmation
  console.log("AI Hedge Fund agent is running...");
  console.log("Press Ctrl+C to stop");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down AI Hedge Fund...");
    await agent.stop();
    console.log("Shutdown complete. Goodbye!");
    process.exit(0);
  });
}

// Run the application
main().catch((error) => {
  console.error("Error starting AI Hedge Fund:", error);
  process.exit(1);
});
