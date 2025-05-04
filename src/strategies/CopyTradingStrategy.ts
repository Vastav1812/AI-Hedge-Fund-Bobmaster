import {
  MarketData,
  RiskProfile,
  TradeResult,
  Strategy,
  StrategyType,
  StrategyScore,
  RiskProfileType,
} from "../models/types";
import { IWalletService } from "../services/IWalletService";
import { DEXService } from "../services/DEXService";
import { GeminiService } from "../services/GeminiService";

/**
 * Strategy that uses AI analysis to identify and copy successful trading patterns
 */
export class CopyTradingStrategy implements Strategy {
  public type: StrategyType;
  public name: string;
  public description: string;
  public riskProfileSupport: RiskProfileType[];

  private walletService: IWalletService;
  private dexService: DEXService;
  private geminiService: GeminiService;

  constructor(
    walletService: IWalletService,
    dexService: DEXService,
    geminiService: GeminiService
  ) {
    this.walletService = walletService;
    this.dexService = dexService;
    this.geminiService = geminiService;

    // Initialize Strategy interface properties
    this.type = StrategyType.CopyTrading;
    this.name = "Copy Trading";
    this.description =
      "Strategy that uses AI analysis to identify and copy successful trading patterns";
    this.riskProfileSupport = [
      RiskProfileType.Aggressive,
      RiskProfileType.Balanced,
      RiskProfileType.LowRisk,
    ];

    console.log("Copy Trading strategy initialized");
  }

  /**
   * Evaluate strategy for current market conditions (required by Strategy interface)
   */
  public async evaluate(marketData: MarketData): Promise<StrategyScore> {
    // Use AI to analyze market data for copy trading opportunities
    try {
      // Generate a simplified analysis for copy trading potential
      const analysis = await this.geminiService.analyzeMarket(marketData);

      // Calculate a score based on the analysis
      let score = 50; // Base score

      // Adjust score based on market conditions
      if (marketData.globalMetrics.volatilityIndex < 0.3) {
        score += 10; // Low volatility is good for copy trading
      }

      // Use AI analysis if available
      if (analysis && analysis.opportunities) {
        const copyTradingOpps =
          analysis.opportunities.filter(
            (op: any) => op.strategy === "copy-trading"
          ) || [];

        score += copyTradingOpps.length * 7;
      }

      return {
        score: Math.max(0, Math.min(100, score)),
        confidence: score / 100,
        reasoning:
          "Score based on market volatility and AI-identified copying opportunities",
      };
    } catch (error) {
      console.error("Error evaluating copy trading strategy:", error);
      return {
        score: 30, // Default fallback score
        confidence: 0.3,
        reasoning: "Error in evaluation, using fallback score",
      };
    }
  }

  /**
   * Execute strategy (required by Strategy interface)
   */
  public async execute(
    marketData: MarketData,
    allocation: number,
    riskProfile: RiskProfile
  ): Promise<TradeResult> {
    try {
      // Get AI analysis
      const analysis = await this.geminiService.analyzeMarket(marketData);

      // Find copy trading opportunities
      const opportunities = this.findCopyTradingOpportunities(
        marketData,
        analysis
      );

      if (opportunities.length === 0) {
        return this.createErrorTradeResult(
          "No copy trading opportunities found"
        );
      }

      // Take best opportunity
      const bestOpportunity = opportunities[0];

      // Execute trade
      const trade = await this.dexService.executeTrade(
        "USDC",
        bestOpportunity.symbol,
        allocation,
        0,
        bestOpportunity.exchange
      );

      return {
        ...trade,
        strategy: this.name,
      };
    } catch (error) {
      return this.createErrorTradeResult(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Evaluate how suitable the strategy is for current market conditions
   * Returns a score from 0-100
   */
  public async evaluateStrategy(
    marketData: MarketData,
    marketAnalysis: any,
    riskProfile: RiskProfile
  ): Promise<number> {
    // Base score - default medium weight
    let score = 50;

    // 1. Check if global market trend is suitable for copy trading
    // Copy trading works well in most market conditions but best in neutral markets
    if (marketAnalysis.market_trend === "neutral") {
      score += 15;
    } else if (marketAnalysis.market_trend === "bullish") {
      score += 5;
    }

    // 2. Check if market volatility is suitable
    // Copy trading is more reliable in low volatility
    if (marketAnalysis.volatility_assessment === "low") {
      score += 15;
    } else if (marketAnalysis.volatility_assessment === "moderate") {
      score += 5;
    } else {
      score -= 10; // High volatility is worse for copy trading
    }

    // 3. Check for specific copy-trading opportunities in the analysis
    const copyTradingOpps =
      marketAnalysis.opportunities?.filter(
        (op: any) => op.strategy === "copy-trading"
      ) || [];

    score += copyTradingOpps.length * 7;

    // 4. Copy trading is relatively consistent
    // Higher score for low-risk profiles
    if (riskProfile.type === "low-risk") {
      score += 15;
    } else if (riskProfile.type === "balanced") {
      score += 10;
    }

    // 5. Higher score during volatile periods as a stabilizing strategy
    if (marketData.globalMetrics.volatilityIndex > 0.2) {
      score += 10;
    }

    // Ensure score stays within 0-100 range
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Execute the copy trading strategy with allocated funds
   */
  public async executeStrategy(
    allocation: number,
    marketData: MarketData,
    marketAnalysis: any,
    riskProfile: RiskProfile
  ): Promise<TradeResult[]> {
    console.log(
      `Executing copy-trading strategy with $${allocation.toFixed(2)}`
    );

    // No trading if allocation is 0
    if (allocation <= 0) {
      return [];
    }

    const results: TradeResult[] = [];

    try {
      // 1. Find copy trading opportunities
      const opportunities = this.findCopyTradingOpportunities(
        marketData,
        marketAnalysis
      );

      if (opportunities.length === 0) {
        console.log("No suitable copy trading opportunities found");
        return [];
      }

      // 2. Check wallet balances
      const walletInfo = await this.walletService.getWalletInfo();
      if (!walletInfo) {
        throw new Error("Could not get wallet info");
      }

      // 3. Determine position sizes based on risk profile and opportunities
      // Copy trading typically uses many smaller positions
      const maxPositions =
        riskProfile.type === "aggressive"
          ? 4
          : riskProfile.type === "balanced"
          ? 6
          : 8;

      const numPositions = Math.min(maxPositions, opportunities.length);

      // Allocate more to higher confidence opportunities
      const totalConfidence = opportunities
        .slice(0, numPositions)
        .reduce((sum, op) => sum + op.confidence, 0);

      // 4. Execute copy trades based on identified opportunities
      for (let i = 0; i < numPositions; i++) {
        const opportunity = opportunities[i];

        // Calculate weighted position size
        const weight = opportunity.confidence / totalConfidence;
        const positionSize = allocation * weight;

        // Get USDC balance
        const usdcBalance = walletInfo.balances["USDC"]?.amount || 0;

        // Skip if not enough balance
        if (usdcBalance < positionSize) {
          console.log(
            `Skipping copy trade for ${opportunity.symbol} due to insufficient balance`
          );
          continue;
        }

        console.log(
          `Executing copy trade: ${opportunity.action} ${opportunity.symbol} ` +
            `with $${positionSize.toFixed(2)} (confidence: ${(
              opportunity.confidence * 100
            ).toFixed(1)}%)`
        );

        // Execute the trade
        let trade;
        if (opportunity.action === "buy") {
          trade = await this.dexService.executeTrade(
            "USDC",
            opportunity.symbol,
            positionSize,
            0, // Minimum amount to receive
            opportunity.exchange
          );
        } else {
          // For sell trades, get the asset balance first
          const assetBalance =
            walletInfo.balances[opportunity.symbol]?.amount || 0;
          const sellAmount = Math.min(
            assetBalance,
            opportunity.estimatedAmount
          );

          if (sellAmount <= 0) {
            console.log(
              `Cannot sell ${opportunity.symbol}: insufficient balance`
            );
            continue;
          }

          trade = await this.dexService.executeTrade(
            opportunity.symbol,
            "USDC",
            sellAmount,
            0, // Minimum amount to receive
            opportunity.exchange
          );
        }

        // Record the trade
        results.push({
          ...trade,
          strategy: this.name,
        });
      }

      return results;
    } catch (error) {
      console.error("Error executing copy trading strategy:", error);
      return [
        {
          timestamp: Date.now(),
          strategy: this.name,
          asset: "UNKNOWN",
          tradeType: "buy",
          amount: 0,
          price: 0,
          fee: 0,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      ];
    }
  }

  /**
   * Find copy trading opportunities
   */
  private findCopyTradingOpportunities(
    marketData: MarketData,
    marketAnalysis: any
  ): any[] {
    const opportunities = [];

    // 1. Look for opportunities explicitly identified in market analysis
    const copyTradingOpps =
      marketAnalysis.opportunities?.filter(
        (op: any) => op.strategy === "copy-trading"
      ) || [];

    for (const opportunity of copyTradingOpps) {
      const assetData = marketData.assets[opportunity.asset];

      if (!assetData) continue;

      // Find best exchange with most liquidity
      const exchanges = Object.entries(assetData.exchanges);
      const bestExchange = exchanges.reduce(
        (best, [exchange, data]) => {
          return data.liquidity > best.liquidity
            ? { exchange, liquidity: data.liquidity }
            : best;
        },
        { exchange: exchanges[0][0], liquidity: exchanges[0][1].liquidity }
      );

      opportunities.push({
        symbol: opportunity.asset,
        action: "buy", // Copy trading opportunities from AI analysis are typically buys
        confidence: opportunity.confidence,
        reasoning: opportunity.reasoning || "AI-identified trading opportunity",
        exchange: bestExchange.exchange,
        price: assetData.price,
        estimatedAmount: 0, // Will be calculated later
      });
    }

    // 2. Use asset rankings if available
    if (
      marketAnalysis.asset_rankings &&
      marketAnalysis.asset_rankings.length > 0
    ) {
      for (const ranking of marketAnalysis.asset_rankings) {
        // Skip assets already added from opportunities
        if (opportunities.some((op) => op.symbol === ranking.asset)) {
          continue;
        }

        const assetData = marketData.assets[ranking.asset];
        if (!assetData) continue;

        // Only consider high-potential assets
        if (ranking.potential < 60) continue;

        // Find best exchange with most liquidity
        const exchanges = Object.entries(assetData.exchanges);
        const bestExchange = exchanges.reduce(
          (best, [exchange, data]) => {
            return data.liquidity > best.liquidity
              ? { exchange, liquidity: data.liquidity }
              : best;
          },
          { exchange: exchanges[0][0], liquidity: exchanges[0][1].liquidity }
        );

        // Add as a copy trading opportunity
        opportunities.push({
          symbol: ranking.asset,
          action: "buy",
          confidence: ranking.potential / 100,
          reasoning:
            ranking.reasoning || "High potential asset identified by AI",
          exchange: bestExchange.exchange,
          price: assetData.price,
          estimatedAmount: 0, // Will be calculated later
        });
      }
    }

    // 3. Add additional opportunities based on market data if needed
    if (opportunities.length < 3) {
      for (const [symbol, asset] of Object.entries(marketData.assets)) {
        // Skip stablecoins
        if (
          symbol === "USDC" ||
          symbol === "USDT" ||
          symbol === "DAI" ||
          // Skip assets already added
          opportunities.some((op) => op.symbol === symbol)
        ) {
          continue;
        }

        // Copy trading works well with consistent performers
        // Look for assets with positive but not extreme price changes
        const priceChange = asset.priceChange24h;

        if (priceChange > 1 && priceChange < 8 && asset.volatility < 0.2) {
          // Find best exchange with most liquidity
          const exchanges = Object.entries(asset.exchanges);
          const bestExchange = exchanges.reduce(
            (best, [exchange, data]) => {
              return data.liquidity > best.liquidity
                ? { exchange, liquidity: data.liquidity }
                : best;
            },
            { exchange: exchanges[0][0], liquidity: exchanges[0][1].liquidity }
          );

          // Calculate a confidence score based on price action and volatility
          const confidence = Math.min(
            0.7,
            0.3 + (priceChange / 10) * (1 - asset.volatility)
          );

          opportunities.push({
            symbol,
            action: "buy",
            confidence,
            reasoning: `Consistent performer with ${priceChange.toFixed(
              1
            )}% gain and low volatility`,
            exchange: bestExchange.exchange,
            price: asset.price,
            estimatedAmount: 0,
          });
        }
      }
    }

    // Sort by confidence level (descending)
    return opportunities.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Create an error trade result
   */
  private createErrorTradeResult(errorMessage: string): TradeResult {
    return {
      timestamp: Date.now(),
      strategy: this.name,
      asset: "UNKNOWN",
      tradeType: "buy",
      amount: 0,
      price: 0,
      fee: 0,
      success: false,
      error: errorMessage,
    };
  }
}
