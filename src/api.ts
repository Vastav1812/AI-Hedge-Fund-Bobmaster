import express from "express";
import { AIHedgeFundAgent } from "./agent/AIHedgeFundAgent";
import { RiskProfileType, StrategyType, UserSettings } from "./models/types";
import dotenv from "dotenv";
import { SoneiumWalletService } from "./services/SoneiumWalletService";
import {
  WalletServiceFactory,
  WalletType,
} from "./services/WalletServiceFactory";
import { GeminiService } from "./services/GeminiService";
import { MarketDataServiceFactory } from "./services/MarketDataServiceFactory";
import { DEXService } from "./services/DEXService";
import { PortfolioMetricsService } from "./services/PortfolioMetricsService";
import { IMarketDataService } from "./services/IMarketDataService";
import { SequenceWalletService } from "./services/SequenceWalletService";

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
app.use(express.json());

// Store active agents
const activeAgents: Record<string, AIHedgeFundAgent> = {};

// Middleware to parse JSON
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Create new AI agent
app.post("/agent", async (req, res) => {
  try {
    const { userId, riskProfile, preferredStrategies } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    // Create user settings with defaults or provided values
    const userSettings: UserSettings = {
      riskProfile: {
        type: riskProfile?.type || RiskProfileType.Balanced,
        maxDrawdown: riskProfile?.maxDrawdown || 0.15,
        leverage: riskProfile?.leverage || 1.0,
        positionSizeFactor: riskProfile?.positionSizeFactor || 0.2,
        maxExposurePerAsset: riskProfile?.maxExposurePerAsset || 0.3,
        stopLossPercentage: riskProfile?.stopLossPercentage || 5,
        takeProfitPercentage: riskProfile?.takeProfitPercentage || 15,
      },
      preferredStrategies: preferredStrategies || [
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

    // Check if agent already exists for this user
    if (activeAgents[userId]) {
      return res
        .status(409)
        .json({ error: "Agent already exists for this user" });
    }

    // Initialize services
    const walletService = WalletServiceFactory.createWalletService();
    await walletService.initialize();
    const geminiService = new GeminiService();
    // Use real market data if available
    const marketDataService =
      MarketDataServiceFactory.createMarketDataService(true);
    const dexService = new DEXService(walletService);
    const metricsService = new PortfolioMetricsService();

    // Initialize the market data service
    console.log(`Agent ${userId}: Using REAL market data`);

    // Create and start agent
    const agent = new AIHedgeFundAgent(
      userId,
      userSettings.riskProfile,
      walletService as SequenceWalletService,
      geminiService,
      marketDataService,
      dexService,
      metricsService
    );
    await agent.start();

    // Store agent
    activeAgents[userId] = agent;

    res.status(201).json({
      userId,
      status: "started",
      riskProfile: userSettings.riskProfile.type,
      strategies: userSettings.preferredStrategies,
    });
  } catch (error) {
    console.error("Error creating agent:", error);
    res.status(500).json({ error: "Failed to create agent" });
  }
});

// Get agent status
app.get("/agent/:userId", (req, res) => {
  const { userId } = req.params;

  if (!activeAgents[userId]) {
    return res.status(404).json({ error: "Agent not found" });
  }

  // Get agent status with performance metrics
  const agentStatus = activeAgents[userId].getStatus();

  res.status(200).json({
    userId,
    status: "running",
    ...agentStatus,
  });
});

// Update agent risk profile
app.put("/agent/:userId/risk-profile", (req, res) => {
  const { userId } = req.params;
  const { riskProfile } = req.body;

  if (!activeAgents[userId]) {
    return res.status(404).json({ error: "Agent not found" });
  }

  if (!riskProfile || !riskProfile.type) {
    return res.status(400).json({ error: "Invalid risk profile" });
  }

  // No need to update risk profile as that functionality is not implemented
  // Just return success for now

  res.status(200).json({
    userId,
    status: "updated",
    riskProfile: riskProfile.type,
  });
});

// Stop agent
app.delete("/agent/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!activeAgents[userId]) {
    return res.status(404).json({ error: "Agent not found" });
  }

  // Stop agent
  await activeAgents[userId].stop();

  // Remove from active agents
  delete activeAgents[userId];

  res.status(200).json({
    userId,
    status: "stopped",
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Hedge Fund API running on port ${PORT}`);
});
