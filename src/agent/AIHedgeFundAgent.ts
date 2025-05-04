import {
  RiskProfile,
  MarketData,
  Strategy,
  StrategyType,
  PortfolioAllocation,
  PerformanceMetrics,
  UserSettings,
  TradeResult,
  AgentStatus,
} from "../models/types";
import { GeminiService } from "../services/GeminiService";
import { MarketDataService } from "../services/MarketDataService";
import { IMarketDataService } from "../services/IMarketDataService";
import { WalletService } from "../services/WalletService";
import { loadStrategy } from "../strategies";
import { MomentumStrategy } from "../strategies/MomentumStrategy";
import { ArbitrageStrategy } from "../strategies/ArbitrageStrategy";
import { CopyTradingStrategy } from "../strategies/CopyTradingStrategy";
import { SequenceWalletService } from "../services/SequenceWalletService";
import { DEXService } from "../services/DEXService";
import { PortfolioMetricsService } from "../services/PortfolioMetricsService";
import { SoneiumWalletService } from "../services/SoneiumWalletService";

export class AIHedgeFundAgent {
  private id: string;
  private geminiService: GeminiService;
  private marketDataService: IMarketDataService;
  private walletService: SequenceWalletService;
  private dexService: DEXService;
  private metricsService: PortfolioMetricsService;

  private momentumStrategy: MomentumStrategy;
  private arbitrageStrategy: ArbitrageStrategy;
  private copyTradingStrategy: CopyTradingStrategy;

  private riskProfile: RiskProfile;
  private marketData: MarketData | null = null;
  private marketAnalysis: any = null;
  private currentAllocation: PortfolioAllocation = {};
  private performanceMetrics: PerformanceMetrics;

  private isRunning: boolean = false;
  private lastRunTimestamp: number = 0;
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 5;
  private adaptiveRunInterval: number = 60000; // 1 minute default
  private decisionLog: any[] = [];

  constructor(
    id: string,
    riskProfile: RiskProfile,
    walletService: SequenceWalletService,
    geminiService: GeminiService,
    marketDataService: IMarketDataService,
    dexService: DEXService,
    metricsService: PortfolioMetricsService
  ) {
    this.id = id;
    this.riskProfile = riskProfile;
    this.walletService = walletService;
    this.geminiService = geminiService;
    this.marketDataService = marketDataService;
    this.dexService = dexService;
    this.metricsService = metricsService;

    // Initialize strategies
    this.momentumStrategy = new MomentumStrategy(
      this.walletService,
      this.dexService
    );
    this.arbitrageStrategy = new ArbitrageStrategy(
      this.walletService,
      this.dexService
    );
    this.copyTradingStrategy = new CopyTradingStrategy(
      this.walletService,
      this.dexService,
      this.geminiService
    );

    // Initialize performance metrics
    this.performanceMetrics = {
      totalReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      volatility: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      dailyReturns: {},
    };

    console.log(
      `AI Hedge Fund Agent ${id} initialized with ${riskProfile.type} risk profile`
    );
  }

  /**
   * Start the agent
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log(`Agent ${this.id} is already running`);
      return;
    }

    this.isRunning = true;
    console.log(`Agent ${this.id} started`);

    // Run the initial cycle immediately
    await this.runCycle();

    // Set up recurring execution
    this.scheduleNextCycle();
  }

  /**
   * Stop the agent
   */
  public stop(): void {
    this.isRunning = false;
    console.log(`Agent ${this.id} stopped`);
  }

  /**
   * Get agent status
   */
  public async getStatus(): Promise<AgentStatus> {
    const walletInfo = await this.walletService.getWalletInfo();

    return {
      id: this.id,
      isRunning: this.isRunning,
      lastRunTimestamp: this.lastRunTimestamp,
      riskProfile: this.riskProfile,
      currentAllocation: this.currentAllocation,
      performanceMetrics: this.performanceMetrics,
      marketAnalysis: this.marketAnalysis,
      walletInfo: walletInfo || { address: "Unknown", balances: {} },
      recentDecisions: this.decisionLog.slice(-5),
    };
  }

  /**
   * Main operational cycle
   */
  private async runCycle(): Promise<void> {
    try {
      console.log(
        `\n---- Agent ${
          this.id
        } Running Cycle at ${new Date().toISOString()} ----`
      );
      this.lastRunTimestamp = Date.now();

      // 1. Fetch market data
      await this.fetchMarketData();

      // 2. Analyze market conditions
      await this.analyzeMarket();

      // 3. Evaluate strategy performances
      const strategyScores = await this.evaluateStrategies();

      // 4. Optimize portfolio allocation
      await this.optimizeAllocation(strategyScores);

      // 5. Execute trades based on allocation
      await this.executeAllocatedStrategies();

      // 6. Update performance metrics
      await this.updatePerformanceMetrics();

      // 7. Analyze performance and adjust approach if needed
      await this.analyzePerformanceAndAdapt();

      // Reset failure counter on success
      this.consecutiveFailures = 0;

      // Adapt run interval based on market volatility
      this.adaptRunInterval();

      console.log(`---- Agent ${this.id} Cycle Completed Successfully ----`);
    } catch (error) {
      console.error(`Error in agent ${this.id} cycle:`, error);
      this.consecutiveFailures++;

      // If too many consecutive failures, stop the agent
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        console.error(
          `Agent ${this.id} stopped due to ${this.consecutiveFailures} consecutive failures`
        );
        this.stop();
        return;
      }
    }

    // Schedule next cycle if still running
    if (this.isRunning) {
      this.scheduleNextCycle();
    }
  }

  /**
   * Schedule the next cycle based on adaptive interval
   */
  private scheduleNextCycle(): void {
    setTimeout(() => {
      if (this.isRunning) {
        this.runCycle().catch((error) => {
          console.error(`Unhandled error in agent ${this.id} cycle:`, error);
        });
      }
    }, this.adaptiveRunInterval);
  }

  /**
   * Adapt the run interval based on market conditions
   */
  private adaptRunInterval(): void {
    if (!this.marketData) return;

    const baseInterval = 60000; // 1 minute

    // Adjust interval based on market volatility
    // Higher volatility = more frequent runs
    const volatilityFactor = Math.max(
      0.5,
      Math.min(2, 1 / (this.marketData.globalMetrics.volatilityIndex * 4 || 1))
    );

    // Adjust interval based on trading activity
    // More active trading = more frequent runs
    const tradingFactor =
      Object.keys(this.currentAllocation).length > 0
        ? Object.values(this.currentAllocation).reduce((a, b) => a + b, 0) > 0.5
          ? 0.8
          : 1.2
        : 1;

    // Calculate new interval
    this.adaptiveRunInterval = Math.round(
      baseInterval * volatilityFactor * tradingFactor
    );

    // Log the update
    const intervalSeconds = Math.round(this.adaptiveRunInterval / 1000);
    console.log(
      `Adaptive interval updated to ${intervalSeconds} seconds (volatility: ${volatilityFactor.toFixed(
        2
      )}, trading: ${tradingFactor.toFixed(2)})`
    );
  }

  /**
   * Fetch market data
   */
  private async fetchMarketData(): Promise<void> {
    console.log("Fetching market data...");
    this.marketData = await this.marketDataService.getMarketData();
    console.log(
      `Retrieved data for ${Object.keys(this.marketData.assets).length} assets`
    );
  }

  /**
   * Analyze market conditions using AI
   */
  private async analyzeMarket(): Promise<void> {
    if (!this.marketData) {
      throw new Error("Market data not available");
    }

    console.log("Analyzing market conditions with AI...");
    this.marketAnalysis = await this.geminiService.analyzeMarket(
      this.marketData
    );

    // Log the analysis summary
    console.log(
      `Market Analysis: ${this.marketAnalysis.market_trend} trend with ${this.marketAnalysis.volatility_assessment} volatility`
    );

    // Log opportunities
    if (
      this.marketAnalysis.opportunities &&
      this.marketAnalysis.opportunities.length > 0
    ) {
      console.log("Top opportunities:");
      this.marketAnalysis.opportunities.forEach((op: any, index: number) => {
        console.log(
          `  ${index + 1}. ${op.asset}: ${op.strategy} strategy (${Math.round(
            op.confidence * 100
          )}% confidence)`
        );
      });
    }

    // Log risks
    if (this.marketAnalysis.risks && this.marketAnalysis.risks.length > 0) {
      console.log("Key risks:");
      this.marketAnalysis.risks.forEach((risk: any, index: number) => {
        console.log(
          `  ${index + 1}. ${risk.severity.toUpperCase()}: ${risk.description}`
        );
      });
    }

    // Record the decision
    this.recordDecision("market_analysis", {
      timestamp: new Date().toISOString(),
      market_trend: this.marketAnalysis.market_trend,
      volatility: this.marketAnalysis.volatility_assessment,
      top_opportunities: this.marketAnalysis.opportunities?.slice(0, 2) || [],
      top_risks: this.marketAnalysis.risks?.slice(0, 2) || [],
    });
  }

  /**
   * Evaluate strategy performances
   */
  private async evaluateStrategies(): Promise<Record<string, number>> {
    console.log("Evaluating strategy performances...");

    if (!this.marketData || !this.marketAnalysis) {
      throw new Error("Market data or analysis not available");
    }

    // Evaluate each strategy's suitability for current market conditions
    const momentumScore = (
      await this.momentumStrategy.evaluate(this.marketData)
    ).score;
    const arbitrageScore = (
      await this.arbitrageStrategy.evaluate(this.marketData)
    ).score;
    const copyTradingScore = (
      await this.copyTradingStrategy.evaluate(this.marketData)
    ).score;

    // Log the scores
    console.log(
      `Strategy scores - Momentum: ${momentumScore}, Arbitrage: ${arbitrageScore}, Copy Trading: ${copyTradingScore}`
    );

    return {
      momentum: momentumScore,
      arbitrage: arbitrageScore,
      "copy-trading": copyTradingScore,
    };
  }

  /**
   * Optimize portfolio allocation
   */
  private async optimizeAllocation(
    strategyScores: Record<string, number>
  ): Promise<void> {
    if (!this.marketAnalysis) {
      throw new Error("Market analysis not available");
    }

    console.log("Optimizing portfolio allocation...");
    this.currentAllocation = await this.geminiService.optimizeAllocation(
      strategyScores,
      this.riskProfile,
      this.marketAnalysis
    );

    console.log("Portfolio allocation:");
    Object.entries(this.currentAllocation).forEach(([strategy, allocation]) => {
      console.log(`  ${strategy}: ${(allocation * 100).toFixed(2)}%`);
    });

    // Record the decision
    this.recordDecision("portfolio_allocation", {
      timestamp: new Date().toISOString(),
      allocation: { ...this.currentAllocation },
    });
  }

  /**
   * Execute allocated strategies
   */
  private async executeAllocatedStrategies(): Promise<void> {
    console.log("Executing allocated strategies...");

    if (!this.marketData || !this.marketAnalysis) {
      throw new Error("Market data or analysis not available");
    }

    const results: TradeResult[] = [];

    // Execute each strategy with its allocated portion
    if (this.currentAllocation["momentum"] > 0) {
      const allocation = this.currentAllocation["momentum"];
      console.log(
        `Allocating ${(allocation * 100).toFixed(2)}% to momentum strategy`
      );

      const momentumResult = await this.momentumStrategy.execute(
        this.marketData,
        allocation,
        this.riskProfile
      );

      results.push(momentumResult);
    }

    if (this.currentAllocation["arbitrage"] > 0) {
      const allocation = this.currentAllocation["arbitrage"];
      console.log(
        `Allocating ${(allocation * 100).toFixed(2)}% to arbitrage strategy`
      );

      const arbitrageResult = await this.arbitrageStrategy.execute(
        this.marketData,
        allocation,
        this.riskProfile
      );

      results.push(arbitrageResult);
    }

    if (this.currentAllocation["copy-trading"] > 0) {
      const allocation = this.currentAllocation["copy-trading"];
      console.log(
        `Allocating ${(allocation * 100).toFixed(2)}% to copy-trading strategy`
      );

      const copyTradingResult = await this.copyTradingStrategy.execute(
        this.marketData,
        allocation,
        this.riskProfile
      );

      results.push(copyTradingResult);
    }

    // Record trades
    for (const trade of results) {
      if (trade.success) {
        console.log(
          `Trade executed: ${trade.tradeType} ${trade.amount} ${trade.asset} at $${trade.price}`
        );
        this.metricsService.recordTrade(trade);
        this.recordDecision("trade_execution", trade);
      } else {
        console.error(`Trade failed: ${trade.error}`);
      }
    }
  }

  /**
   * Update performance metrics
   */
  private async updatePerformanceMetrics(): Promise<void> {
    console.log("Updating performance metrics...");

    const walletInfo = await this.walletService.getWalletInfo();
    if (!walletInfo) {
      console.error(
        "Wallet info not available, cannot update performance metrics"
      );
      return;
    }

    this.performanceMetrics =
      await this.geminiService.calculatePerformanceMetrics(
        this.performanceMetrics,
        walletInfo,
        this.currentAllocation
      );

    console.log("Updated performance metrics:");
    console.log(
      `  Total Return: ${(this.performanceMetrics.totalReturn * 100).toFixed(
        2
      )}%`
    );
    console.log(
      `  Sharpe Ratio: ${this.performanceMetrics.sharpeRatio.toFixed(4)}`
    );
    console.log(
      `  Volatility: ${(this.performanceMetrics.volatility * 100).toFixed(2)}%`
    );
    console.log(
      `  Max Drawdown: ${(this.performanceMetrics.maxDrawdown * 100).toFixed(
        2
      )}%`
    );

    // Get today's return if available
    const today = new Date().toISOString().split("T")[0];
    if (this.performanceMetrics.dailyReturns[today]) {
      console.log(
        `  Today's Return: ${(
          this.performanceMetrics.dailyReturns[today] * 100
        ).toFixed(2)}%`
      );
    }
  }

  /**
   * Analyze performance and adapt strategy
   */
  private async analyzePerformanceAndAdapt(): Promise<void> {
    console.log("Analyzing performance and adapting strategy...");

    const performanceAnalysis = await this.geminiService.analyzePerformance(
      this.performanceMetrics,
      this.riskProfile
    );

    // Log the analysis
    console.log("Performance Analysis:");
    console.log(
      `  Assessment: ${performanceAnalysis.assessment?.substring(0, 100)}...`
    );

    if (performanceAnalysis.recommendations?.length > 0) {
      console.log("  Recommendations:");
      performanceAnalysis.recommendations.forEach((rec: any, index: number) => {
        console.log(`    ${index + 1}. ${rec.action} (${rec.priority})`);
      });
    }

    // Record the decision
    this.recordDecision("performance_analysis", {
      timestamp: new Date().toISOString(),
      assessment: performanceAnalysis.assessment,
      recommendations: performanceAnalysis.recommendations || [],
      current_metrics: {
        total_return: this.performanceMetrics.totalReturn,
        sharpe_ratio: this.performanceMetrics.sharpeRatio,
        volatility: this.performanceMetrics.volatility,
        max_drawdown: this.performanceMetrics.maxDrawdown,
      },
    });

    // Apply adaptive adjustments based on performance
    this.adaptRiskSettings(performanceAnalysis);
  }

  /**
   * Adapt risk settings based on performance analysis
   */
  private adaptRiskSettings(performanceAnalysis: any): void {
    // Skip if no recommendations
    if (
      !performanceAnalysis.recommendations ||
      performanceAnalysis.recommendations.length === 0
    ) {
      return;
    }

    // Look for high priority recommendations about risk
    const riskRecommendations = performanceAnalysis.recommendations.filter(
      (rec: any) =>
        rec.priority === "high" &&
        (rec.action.includes("risk") || rec.action.includes("exposure"))
    );

    if (riskRecommendations.length === 0) {
      return;
    }

    console.log("Adapting risk settings based on performance analysis");

    // For each recommendation, adjust risk parameters
    for (const rec of riskRecommendations) {
      if (
        rec.action.includes("reduce risk") ||
        rec.action.includes("lower exposure")
      ) {
        // Reduce risk parameters
        this.riskProfile.positionSizeFactor = Math.max(
          0.5,
          this.riskProfile.positionSizeFactor * 0.9
        );
        this.riskProfile.maxExposurePerAsset = Math.max(
          0.05,
          this.riskProfile.maxExposurePerAsset * 0.9
        );

        console.log("  Reduced risk parameters:");
        console.log(
          `    Position Size Factor: ${this.riskProfile.positionSizeFactor.toFixed(
            2
          )}`
        );
        console.log(
          `    Max Exposure Per Asset: ${(
            this.riskProfile.maxExposurePerAsset * 100
          ).toFixed(2)}%`
        );
      } else if (
        rec.action.includes("increase risk") ||
        rec.action.includes("higher exposure")
      ) {
        // Increase risk parameters
        this.riskProfile.positionSizeFactor = Math.min(
          1.5,
          this.riskProfile.positionSizeFactor * 1.1
        );
        this.riskProfile.maxExposurePerAsset = Math.min(
          0.25,
          this.riskProfile.maxExposurePerAsset * 1.1
        );

        console.log("  Increased risk parameters:");
        console.log(
          `    Position Size Factor: ${this.riskProfile.positionSizeFactor.toFixed(
            2
          )}`
        );
        console.log(
          `    Max Exposure Per Asset: ${(
            this.riskProfile.maxExposurePerAsset * 100
          ).toFixed(2)}%`
        );
      }
    }

    // Record the adaptation
    this.recordDecision("risk_adaptation", {
      timestamp: new Date().toISOString(),
      trigger: riskRecommendations[0].action,
      updated_risk_profile: { ...this.riskProfile },
    });
  }

  /**
   * Record a decision for audit and analysis
   */
  private recordDecision(decisionType: string, details: any): void {
    this.decisionLog.push({
      timestamp: new Date().toISOString(),
      type: decisionType,
      details: details,
    });

    // Keep log at a reasonable size
    if (this.decisionLog.length > 100) {
      this.decisionLog = this.decisionLog.slice(-100);
    }
  }
}
