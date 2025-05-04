import OpenAI from 'openai';
import { MarketData, RiskProfile, PerformanceMetrics, WalletInfo, PortfolioAllocation } from '../models/types';
import dotenv from 'dotenv';

dotenv.config();

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze market data to identify trends and opportunities
   */
  public async analyzeMarket(marketData: MarketData): Promise<any> {
    const prompt = this.buildMarketAnalysisPrompt(marketData);
    
    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: "You are an expert DeFi market analyst AI. Analyze the provided market data and provide insights on trends, opportunities, and risks." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });
    
    try {
      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (e) {
      console.error('Error parsing OpenAI response:', e);
      return {
        market_trend: 'neutral',
        volatility_assessment: 'moderate',
        opportunities: [],
        risks: []
      };
    }
  }

  /**
   * Use AI to optimize portfolio allocation across strategies
   */
  public async optimizeAllocation(
    strategyScores: Record<string, number>,
    riskProfile: RiskProfile,
    marketAnalysis: any
  ): Promise<PortfolioAllocation> {
    const prompt = this.buildAllocationPrompt(strategyScores, riskProfile, marketAnalysis);
    
    const response = await this.openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: "You are an expert portfolio manager AI. Optimize strategy allocations based on strategy scores, risk profile, and market analysis." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });
    
    try {
      const allocation = JSON.parse(response.choices[0].message.content || '{}');
      return this.normalizeAllocation(allocation);
    } catch (e) {
      console.error('Error parsing OpenAI allocation response:', e);
      // Fallback to equal allocation
      return this.generateEqualAllocation(strategyScores);
    }
  }

  /**
   * Calculate and update performance metrics
   */
  public async calculatePerformanceMetrics(
    currentMetrics: PerformanceMetrics,
    walletInfo: WalletInfo,
    lastAllocation: PortfolioAllocation
  ): Promise<PerformanceMetrics> {
    // This would typically involve more complex calculations
    // For now, we'll use a simplified approach
    
    // In a real implementation, you would:
    // 1. Calculate daily returns from wallet history
    // 2. Calculate Sharpe ratio, drawdowns, etc. from return series
    // 3. Calculate win/loss metrics from trade history
    
    // For demonstration, we'll just return the current metrics
    // with a simulated daily return
    const today = new Date().toISOString().split('T')[0];
    const dailyReturn = Math.random() * 0.02 - 0.01; // Random return between -1% and +1%
    
    return {
      ...currentMetrics,
      dailyReturns: {
        ...currentMetrics.dailyReturns,
        [today]: dailyReturn
      },
      totalReturn: currentMetrics.totalReturn + dailyReturn
    };
  }

  /**
   * Builds a detailed prompt for market analysis
   */
  private buildMarketAnalysisPrompt(marketData: MarketData): string {
    return `
Analyze the following market data and provide insights on market trends, volatility, opportunities, and risks.

Market Data Timestamp: ${new Date(marketData.timestamp).toISOString()}
Global Market Metrics:
- Volatility Index: ${marketData.globalMetrics.volatilityIndex}
- Sentiment Score: ${marketData.globalMetrics.sentimentScore}
- Trend Strength: ${marketData.globalMetrics.trendStrength}

Assets:
${Object.entries(marketData.assets).map(([symbol, data]) => `
${symbol}:
- Price: ${data.price}
- 24h Change: ${data.priceChange24h}%
- 24h Volume: ${data.volume24h}
- Volatility: ${data.volatility}
- Exchange Data: ${Object.entries(data.exchanges).map(([exchange, exchData]) => 
  `${exchange} (Price: ${exchData.price}, Volume: ${exchData.volume24h}, Liquidity: ${exchData.liquidity})`
).join(', ')}
`).join('\n')}

Please provide detailed analysis in JSON format with the following structure:
{
  "market_trend": "bullish|bearish|neutral",
  "volatility_assessment": "high|moderate|low",
  "opportunities": [
    {"asset": "symbol", "strategy": "strategy_name", "confidence": 0-1, "reasoning": "explanation"}
  ],
  "risks": [
    {"description": "risk description", "severity": "high|medium|low", "mitigation": "suggestion"}
  ],
  "asset_rankings": [
    {"asset": "symbol", "potential": 0-100, "reasoning": "explanation"}
  ]
}
`;
  }

  /**
   * Builds a prompt for portfolio allocation optimization
   */
  private buildAllocationPrompt(
    strategyScores: Record<string, number>,
    riskProfile: RiskProfile,
    marketAnalysis: any
  ): string {
    return `
Optimize the portfolio allocation across multiple trading strategies based on their scores, the user's risk profile, and current market analysis.

Strategy Scores (0-100):
${Object.entries(strategyScores).map(([strategy, score]) => `- ${strategy}: ${score}`).join('\n')}

Risk Profile:
- Type: ${riskProfile.type}
- Max Drawdown: ${riskProfile.maxDrawdown}
- Leverage: ${riskProfile.leverage}
- Position Size Factor: ${riskProfile.positionSizeFactor}
- Max Exposure Per Asset: ${riskProfile.maxExposurePerAsset}
- Stop Loss: ${riskProfile.stopLossPercentage}%
- Take Profit: ${riskProfile.takeProfitPercentage}%

Market Analysis:
- Trend: ${marketAnalysis.market_trend || 'neutral'}
- Volatility: ${marketAnalysis.volatility_assessment || 'moderate'}
- Opportunities: ${marketAnalysis.opportunities?.length || 0}
- Risks: ${marketAnalysis.risks?.length || 0}

Please provide an optimal allocation across strategies in JSON format, ensuring the allocations sum to 1.0:
{
  "strategy1": 0.X,
  "strategy2": 0.Y,
  ...
}

For more aggressive risk profiles, allocate more to higher-scoring strategies.
For lower risk profiles, ensure more diversification across strategies.
Allocate 0 to any strategy that is not appropriate for current market conditions.
`;
  }

  /**
   * Normalizes allocation to ensure the sum is 1.0
   */
  private normalizeAllocation(allocation: Record<string, number>): PortfolioAllocation {
    const sum = Object.values(allocation).reduce((a, b) => a + b, 0);
    
    if (sum === 0) {
      // If all allocations are 0, return equal allocation
      const count = Object.keys(allocation).length;
      return Object.fromEntries(
        Object.keys(allocation).map(key => [key, 1 / count])
      );
    }
    
    // Normalize to sum to 1.0
    return Object.fromEntries(
      Object.entries(allocation).map(([key, value]) => [key, value / sum])
    );
  }

  /**
   * Generates equal allocation across all strategies
   */
  private generateEqualAllocation(strategyScores: Record<string, number>): PortfolioAllocation {
    const strategies = Object.keys(strategyScores);
    const allocation = 1 / strategies.length;
    
    return Object.fromEntries(
      strategies.map(strategy => [strategy, allocation])
    );
  }
} 