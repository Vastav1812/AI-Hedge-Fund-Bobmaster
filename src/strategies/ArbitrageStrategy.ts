import {
  MarketData,
  RiskProfile,
  TradeResult,
  Strategy,
  StrategyType,
  StrategyScore,
  RiskProfileType,
} from "../models/types";
import { DEXService } from "../services/DEXService";
import { IWalletService } from "../services/IWalletService";

/**
 * Strategy that capitalizes on price differences between exchanges
 */
export class ArbitrageStrategy implements Strategy {
  public type: StrategyType;
  public name: string;
  public description: string;
  public riskProfileSupport: RiskProfileType[];

  private walletService: IWalletService;
  private dexService: DEXService;
  private readonly MIN_PRICE_DIFFERENCE = 0.005; // 0.5% minimum price difference

  constructor(walletService: IWalletService, dexService: DEXService) {
    this.walletService = walletService;
    this.dexService = dexService;

    // Initialize Strategy interface properties
    this.type = StrategyType.Arbitrage;
    this.name = "Arbitrage Trading";
    this.description =
      "Strategy that capitalizes on price differences between exchanges";
    this.riskProfileSupport = [
      RiskProfileType.Aggressive,
      RiskProfileType.Balanced,
      RiskProfileType.LowRisk,
    ];

    console.log("Arbitrage strategy initialized");
  }

  /**
   * Evaluate strategy for current market conditions (required by Strategy interface)
   */
  public async evaluate(marketData: MarketData): Promise<StrategyScore> {
    // Find arbitrage opportunities
    const opportunities = this.findArbitrageOpportunities(marketData);
    const score =
      opportunities.length > 0
        ? 50 + Math.min(50, opportunities.length * 10)
        : 25;

    return {
      score,
      confidence: score / 100,
      reasoning: `Arbitrage score based on ${opportunities.length} opportunities found`,
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
    try {
      // Find arbitrage opportunities
      const opportunities = this.findArbitrageOpportunities(marketData);

      if (opportunities.length === 0) {
        return this.createErrorTradeResult("No arbitrage opportunities found");
      }

      // Take best opportunity
      const bestOpportunity = opportunities[0];

      // Execute buy side of arbitrage
      const trade = await this.dexService.executeTrade(
        "USDC",
        bestOpportunity.symbol,
        allocation,
        0,
        bestOpportunity.buyExchange
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
   * Find arbitrage opportunities between exchanges
   */
  private findArbitrageOpportunities(marketData: MarketData): any[] {
    const opportunities = [];

    // For each asset, check price differences between exchanges
    for (const [symbol, asset] of Object.entries(marketData.assets)) {
      // Skip stablecoins
      if (symbol === "USDC" || symbol === "USDT" || symbol === "DAI") {
        continue;
      }

      const exchanges = Object.entries(asset.exchanges);

      // Need at least 2 exchanges to find arbitrage
      if (exchanges.length < 2) {
        continue;
      }

      // Check all exchange pairs for price differences
      for (let i = 0; i < exchanges.length; i++) {
        const [exchangeA, dataA] = exchanges[i];

        for (let j = i + 1; j < exchanges.length; j++) {
          const [exchangeB, dataB] = exchanges[j];

          // Calculate price difference
          const priceDiff = Math.abs(dataA.price - dataB.price);
          const priceDiffPercent =
            priceDiff / Math.min(dataA.price, dataB.price);

          // Check if difference exceeds minimum threshold
          if (priceDiffPercent > this.MIN_PRICE_DIFFERENCE) {
            // Determine buy and sell exchanges
            let buyExchange, sellExchange, buyPrice, sellPrice;

            if (dataA.price < dataB.price) {
              buyExchange = exchangeA;
              buyPrice = dataA.price;
              sellExchange = exchangeB;
              sellPrice = dataB.price;
            } else {
              buyExchange = exchangeB;
              buyPrice = dataB.price;
              sellExchange = exchangeA;
              sellPrice = dataA.price;
            }

            // Check if there's enough liquidity
            const buyLiquidity =
              buyExchange === exchangeA ? dataA.liquidity : dataB.liquidity;
            const sellLiquidity =
              sellExchange === exchangeA ? dataA.liquidity : dataB.liquidity;

            if (buyLiquidity > 10000 && sellLiquidity > 10000) {
              opportunities.push({
                symbol,
                buyExchange,
                buyPrice,
                sellExchange,
                sellPrice,
                priceDiffPercent,
                profitPotential: priceDiffPercent - 0.003, // Accounting for fees
                buyLiquidity,
                sellLiquidity,
              });
            }
          }
        }
      }
    }

    // Sort by profit potential
    return opportunities.sort((a, b) => b.profitPotential - a.profitPotential);
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
