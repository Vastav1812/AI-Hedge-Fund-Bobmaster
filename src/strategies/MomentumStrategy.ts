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

/**
 * Strategy that trades based on price momentum and trend following
 */
export class MomentumStrategy implements Strategy {
  public type: StrategyType;
  public name: string;
  public description: string;
  public riskProfileSupport: RiskProfileType[];

  private walletService: IWalletService;
  private dexService: DEXService;

  constructor(walletService: IWalletService, dexService: DEXService) {
    this.walletService = walletService;
    this.dexService = dexService;

    // Initialize Strategy interface properties
    this.type = StrategyType.Momentum;
    this.name = "Momentum Trading";
    this.description =
      "Strategy that trades based on price momentum and trend following";
    this.riskProfileSupport = [
      RiskProfileType.Aggressive,
      RiskProfileType.Balanced,
      RiskProfileType.LowRisk,
    ];

    console.log("Momentum strategy initialized");
  }

  /**
   * Evaluate strategy for current market conditions (required by Strategy interface)
   */
  public async evaluate(marketData: MarketData): Promise<StrategyScore> {
    // Basic evaluation without market analysis
    // In reality, this method would be called with pre-analyzed market data
    const score = this.calculateMomentumScore(marketData);

    return {
      score,
      confidence: score / 100,
      reasoning: `Momentum score based on market trends and volatility: ${score}`,
    };
  }

  /**
   * Execute strategy (required by Strategy interface)
   */
  public async execute(
    marketData: MarketData,
    allocation: number,
    riskProfile: RiskProfile
  ): Promise<TradeResult> {
    // Simplified version to match the Strategy interface
    // In reality, we would use marketAnalysis and return multiple trades
    try {
      // Find assets with momentum
      const assetsWithMomentum = this.findAssetsWithMomentum(marketData, {});

      if (assetsWithMomentum.length === 0) {
        return this.createErrorTradeResult("No suitable momentum assets found");
      }

      // Take top asset and execute a trade
      const topAsset = assetsWithMomentum[0];

      // Execute trade
      const trade = await this.dexService.executeTrade(
        "USDC",
        topAsset.symbol,
        allocation,
        0
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

    // 1. Check if global market trend is suitable for momentum strategy
    // Momentum works best in trending markets
    if (marketAnalysis.market_trend === "bullish") {
      score += 20;
    } else if (marketAnalysis.market_trend === "bearish") {
      score += 10; // Bearish can also be good for momentum, but slightly less than bullish
    } else {
      score -= 15; // Neutral markets are worse for momentum
    }

    // 2. Check if market volatility is suitable
    // Momentum works better in lower to medium volatility
    if (marketAnalysis.volatility_assessment === "low") {
      score += 15;
    } else if (marketAnalysis.volatility_assessment === "moderate") {
      score += 5;
    } else {
      score -= 10; // High volatility is worse for momentum
    }

    // 3. Check for specific momentum opportunities in the analysis
    const momentumOpps =
      marketAnalysis.opportunities?.filter(
        (op: any) => op.strategy === "momentum"
      ) || [];

    score += momentumOpps.length * 5;

    // 4. Strong trends are better for momentum
    score += Math.round(marketData.globalMetrics.trendStrength * 20);

    // 5. Adjust based on risk profile
    if (riskProfile.type === "aggressive") {
      score += 10; // Momentum is good for aggressive profiles
    } else if (riskProfile.type === "low-risk") {
      score -= 10; // Less suitable for low-risk profiles
    }

    // Ensure score stays within 0-100 range
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Execute the momentum strategy with allocated funds
   */
  public async executeStrategy(
    allocation: number,
    marketData: MarketData,
    marketAnalysis: any,
    riskProfile: RiskProfile
  ): Promise<TradeResult[]> {
    console.log(`Executing momentum strategy with $${allocation.toFixed(2)}`);

    // No trading if allocation is 0
    if (allocation <= 0) {
      return [];
    }

    const results: TradeResult[] = [];

    try {
      // 1. Find assets with strong price momentum
      const assetsWithMomentum = this.findAssetsWithMomentum(
        marketData,
        marketAnalysis
      );

      if (assetsWithMomentum.length === 0) {
        console.log("No suitable momentum assets found");
        return [];
      }

      // 2. Check wallet balances
      const walletInfo = await this.walletService.getWalletInfo();
      if (!walletInfo) {
        throw new Error("Could not get wallet info");
      }

      // 3. Determine position sizes based on risk profile
      // More aggressive profiles -> larger individual positions
      const maxPositions =
        riskProfile.type === "aggressive"
          ? 3
          : riskProfile.type === "balanced"
          ? 5
          : 7;

      const numPositions = Math.min(maxPositions, assetsWithMomentum.length);
      const positionSize = allocation / numPositions;

      // 4. Execute trades for top momentum assets
      for (let i = 0; i < numPositions; i++) {
        const asset = assetsWithMomentum[i];

        // Get USDC balance
        const usdcBalance = walletInfo.balances["USDC"]?.amount || 0;

        // Skip if not enough balance
        if (usdcBalance < positionSize) {
          console.log(
            `Skipping trade for ${asset.symbol} due to insufficient balance`
          );
          continue;
        }

        console.log(
          `Executing momentum trade: Buy ${
            asset.symbol
          } with ${positionSize.toFixed(2)} USDC`
        );

        // Execute the trade
        const trade = await this.dexService.executeTrade(
          "USDC",
          asset.symbol,
          positionSize,
          0, // Minimum amount to receive - in real implementation this would be calculated
          asset.bestExchange
        );

        // Update trade details
        const result: TradeResult = {
          ...trade,
          strategy: this.name,
        };

        results.push(result);
      }

      return results;
    } catch (error) {
      console.error("Error executing momentum strategy:", error);
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
   * Find assets with strong price momentum
   */
  private findAssetsWithMomentum(
    marketData: MarketData,
    marketAnalysis: any
  ): any[] {
    const assetsWithMomentum = [];

    // First, check if there are pre-identified momentum opportunities in analysis
    const momentumOpps =
      marketAnalysis.opportunities?.filter(
        (op: any) => op.strategy === "momentum"
      ) || [];

    for (const opportunity of momentumOpps) {
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

      assetsWithMomentum.push({
        symbol: opportunity.asset,
        momentum: opportunity.confidence * 100,
        priceChange: assetData.priceChange24h,
        price: assetData.price,
        bestExchange: bestExchange.exchange,
      });
    }

    // If no pre-identified opportunities, find assets with strong price momentum
    if (assetsWithMomentum.length === 0) {
      for (const [symbol, asset] of Object.entries(marketData.assets)) {
        // Skip stablecoins and assets with low price change
        if (
          symbol === "USDC" ||
          symbol === "USDT" ||
          symbol === "DAI" ||
          Math.abs(asset.priceChange24h) < 3
        ) {
          continue;
        }

        // Only consider assets with positive price change for momentum
        if (asset.priceChange24h <= 0) {
          continue;
        }

        // Calculate a momentum score
        const momentum = asset.priceChange24h * (1 - asset.volatility);

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

        assetsWithMomentum.push({
          symbol,
          momentum,
          priceChange: asset.priceChange24h,
          price: asset.price,
          bestExchange: bestExchange.exchange,
        });
      }
    }

    // Sort by momentum score
    return assetsWithMomentum.sort((a, b) => b.momentum - a.momentum);
  }

  /**
   * Calculate a basic momentum score from market data
   */
  private calculateMomentumScore(marketData: MarketData): number {
    // Base score
    let score = 50;

    // Adjust based on global metrics
    score += marketData.globalMetrics.trendStrength * 20;

    // Adjust for volatility - moderate volatility is good for momentum
    const volatility = marketData.globalMetrics.volatilityIndex;
    if (volatility < 0.3) {
      score += 10; // Low volatility is good
    } else if (volatility > 0.7) {
      score -= 15; // High volatility is bad for momentum
    }

    // Look for assets with strong momentum
    let momentumAssetCount = 0;
    for (const [symbol, asset] of Object.entries(marketData.assets)) {
      if (asset.priceChange24h > 5) {
        momentumAssetCount++;
      }
    }

    score += momentumAssetCount * 2;

    // Ensure score is between 0-100
    return Math.max(0, Math.min(100, score));
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
