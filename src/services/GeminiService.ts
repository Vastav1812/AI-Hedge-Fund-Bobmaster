import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { MarketData, RiskProfile, PerformanceMetrics, WalletInfo, PortfolioAllocation } from '../models/types';
import dotenv from 'dotenv';

dotenv.config();

export class GeminiService {
  private gemini: GenerativeModel | null;
  private apiKey: string;
  private useAI: boolean;
  private aiInsightsHistory: any[] = [];

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      // Use Gemini 1.5 Pro which works with the provided API key
      this.gemini = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      this.useAI = true;
      console.log('Gemini AI service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Gemini AI service, using mock data:', error);
      this.gemini = null;
      this.useAI = false;
    }
  }

  /**
   * Analyze market data to identify trends and opportunities
   */
  public async analyzeMarket(marketData: MarketData): Promise<any> {
    if (!this.useAI || !this.gemini) {
      console.log('Using mock market analysis (Gemini AI disabled)');
      return this.generateMockMarketAnalysis(marketData);
    }
    
    console.log('Performing AI market analysis with Gemini 1.5...');
    const prompt = this.buildMarketAnalysisPrompt(marketData);
    
    try {
      const result = await this.gemini.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      console.log('AI analysis received, processing response...');
      
      // Extract JSON from response
      const analysis = this.extractJsonFromText(text) || this.generateMockMarketAnalysis(marketData);
      
      // Store AI insights for future reference
      this.aiInsightsHistory.push({
        timestamp: new Date().toISOString(),
        marketData: {
          timestamp: marketData.timestamp,
          assetCount: Object.keys(marketData.assets).length,
          volatilityIndex: marketData.globalMetrics.volatilityIndex
        },
        analysis: {
          market_trend: analysis.market_trend,
          volatility_assessment: analysis.volatility_assessment,
          opportunity_count: analysis.opportunities?.length || 0,
          risk_count: analysis.risks?.length || 0
        }
      });
      
      // Keep history at reasonable size
      if (this.aiInsightsHistory.length > 10) {
        this.aiInsightsHistory.shift();
      }
      
      // Log key insights
      console.log(`AI Market Analysis: ${analysis.market_trend} trend, ${analysis.volatility_assessment} volatility`);
      if (analysis.opportunities && analysis.opportunities.length > 0) {
        console.log(`Top opportunity: ${analysis.opportunities[0].asset} with ${(analysis.opportunities[0].confidence * 100).toFixed(1)}% confidence`);
      }
      
      return analysis;
    } catch (e) {
      console.error('Error using Gemini API for market analysis:', e);
      console.log('Falling back to mock market analysis');
      return this.generateMockMarketAnalysis(marketData);
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
    if (!this.useAI || !this.gemini) {
      console.log('Using mock allocation optimization (Gemini AI disabled)');
      return this.generateSmartAllocation(strategyScores, riskProfile, marketAnalysis);
    }
    
    console.log('Optimizing portfolio allocation with AI...');
    const prompt = this.buildAllocationPrompt(strategyScores, riskProfile, marketAnalysis);
    
    try {
      const result = await this.gemini.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Extract JSON from response
      const allocation = this.extractJsonFromText(text);
      if (allocation) {
        const normalizedAllocation = this.normalizeAllocation(allocation);
        
        // Log allocation decision
        console.log('AI allocation decision:');
        Object.entries(normalizedAllocation).forEach(([strategy, weight]) => {
          console.log(`  ${strategy}: ${(weight * 100).toFixed(1)}%`);
        });
        
        return normalizedAllocation;
      } else {
        console.error('Could not parse Gemini allocation response as JSON');
        return this.generateSmartAllocation(strategyScores, riskProfile, marketAnalysis);
      }
    } catch (e) {
      console.error('Error using Gemini API for allocation optimization:', e);
      console.log('Falling back to smart allocation algorithm');
      return this.generateSmartAllocation(strategyScores, riskProfile, marketAnalysis);
    }
  }

  /**
   * Analyze performance metrics to provide insights and recommendations
   */
  public async analyzePerformance(
    performanceMetrics: PerformanceMetrics,
    riskProfile: RiskProfile
  ): Promise<any> {
    if (!this.useAI || !this.gemini) {
      return {
        assessment: 'Performance analysis requires AI capabilities',
        recommendations: []
      };
    }
    
    const prompt = `
Analyze the following portfolio performance metrics for a ${riskProfile.type} risk profile:

- Total Return: ${performanceMetrics.totalReturn.toFixed(4)}
- Sharpe Ratio: ${performanceMetrics.sharpeRatio.toFixed(4)}
- Max Drawdown: ${performanceMetrics.maxDrawdown.toFixed(4)}
- Volatility: ${performanceMetrics.volatility.toFixed(4)}
- Win Rate: ${performanceMetrics.winRate.toFixed(4)}
- Average Win: ${performanceMetrics.averageWin.toFixed(4)}
- Average Loss: ${performanceMetrics.averageLoss.toFixed(4)}
- Profit Factor: ${performanceMetrics.profitFactor.toFixed(4)}

Recent daily returns:
${Object.entries(performanceMetrics.dailyReturns)
  .slice(-5)
  .map(([date, value]) => `${date}: ${value.toFixed(4)}`)
  .join('\n')}

Provide an assessment of the portfolio performance and recommendations for improvement based on the ${riskProfile.type} risk profile.

Return your analysis in JSON format with the following structure:
{
  "assessment": "Detailed assessment of the performance",
  "performance_rating": 1-10,
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "recommendations": [
    {"action": "Recommended action", "reasoning": "Reasoning behind recommendation", "priority": "high|medium|low"}
  ]
}
`;

    try {
      const result = await this.gemini.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Extract JSON from response
      return this.extractJsonFromText(text) || {
        assessment: "Unable to generate AI assessment",
        recommendations: []
      };
    } catch (e) {
      console.error('Error analyzing performance with AI:', e);
      return {
        assessment: "Error performing AI analysis",
        recommendations: []
      };
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
    
    // Calculate other metrics from daily returns
    const updatedMetrics = {
      ...currentMetrics,
      dailyReturns: {
        ...currentMetrics.dailyReturns,
        [today]: dailyReturn
      },
      totalReturn: currentMetrics.totalReturn + dailyReturn
    };
    
    // Calculate volatility based on daily returns
    const returns = Object.values(updatedMetrics.dailyReturns);
    if (returns.length > 1) {
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      updatedMetrics.volatility = Math.sqrt(variance);
      
      // Calculate sharpe ratio (simplified)
      const riskFreeRate = 0.0003; // Assuming 0.03% daily risk-free rate
      updatedMetrics.sharpeRatio = (mean - riskFreeRate) / updatedMetrics.volatility;
      
      // Calculate max drawdown
      let peak = -Infinity;
      let maxDrawdown = 0;
      let cumulativeReturn = 1;
      
      for (const dailyReturn of returns) {
        cumulativeReturn *= (1 + dailyReturn);
        if (cumulativeReturn > peak) {
          peak = cumulativeReturn;
        }
        const drawdown = (peak - cumulativeReturn) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
      
      updatedMetrics.maxDrawdown = maxDrawdown;
    }
    
    return updatedMetrics;
  }

  /**
   * Get the latest AI insights
   */
  public getAIInsightsHistory(): any[] {
    return this.aiInsightsHistory;
  }

  /**
   * Generate mock market analysis based on actual market data
   */
  private generateMockMarketAnalysis(marketData: MarketData): any {
    const volatility = marketData.globalMetrics.volatilityIndex;
    const sentiment = marketData.globalMetrics.sentimentScore;
    const trend = marketData.globalMetrics.trendStrength;
    
    // Determine market trend based on sentiment and trend strength
    let marketTrend: string;
    if (trend > 0.6 && sentiment > 60) {
      marketTrend = 'bullish';
    } else if (trend < 0.4 && sentiment < 40) {
      marketTrend = 'bearish';
    } else {
      marketTrend = 'neutral';
    }
    
    // Determine volatility assessment
    let volatilityAssessment: string;
    if (volatility > 0.25) {
      volatilityAssessment = 'high';
    } else if (volatility > 0.15) {
      volatilityAssessment = 'moderate';
    } else {
      volatilityAssessment = 'low';
    }
    
    // Find assets with positive and negative price changes
    const opportunities = [];
    const risks = [];
    const assetRankings = [];
    
    for (const [symbol, asset] of Object.entries(marketData.assets)) {
      // Create asset rankings
      const potential = 50 + (asset.priceChange24h * 2) + (Math.random() * 20);
      assetRankings.push({
        asset: symbol,
        potential: Math.min(Math.max(potential, 10), 90), // Keep between 10-90
        reasoning: `${asset.priceChange24h > 0 ? 'Positive' : 'Negative'} price action with ${asset.volatility.toFixed(2)} volatility`
      });
      
      // Create opportunities for assets with positive price change
      if (asset.priceChange24h > 3 && asset.volume24h > 1000000) {
        opportunities.push({
          asset: symbol,
          strategy: asset.volatility > 0.2 ? 'momentum' : 'copy-trading',
          confidence: Math.min(0.5 + (asset.priceChange24h / 20), 0.9),
          reasoning: `Strong ${asset.priceChange24h.toFixed(1)}% price increase with good volume`
        });
      }
      
      // Create risks for assets with high volatility or negative price change
      if (asset.volatility > 0.25 || asset.priceChange24h < -5) {
        risks.push({
          description: `High volatility in ${symbol}`,
          severity: asset.volatility > 0.3 ? 'high' : 'medium',
          mitigation: 'Use smaller position sizes and tighter stop losses'
        });
      }
    }
    
    return {
      market_trend: marketTrend,
      volatility_assessment: volatilityAssessment,
      opportunities: opportunities.slice(0, 3), // Limit to top 3
      risks: risks.slice(0, 3), // Limit to top 3
      asset_rankings: assetRankings.sort((a, b) => b.potential - a.potential).slice(0, 5) // Top 5 by potential
    };
  }

  /**
   * Generate smart allocation based on strategy scores and risk profile
   */
  private generateSmartAllocation(
    strategyScores: Record<string, number>,
    riskProfile: RiskProfile,
    marketAnalysis: any
  ): PortfolioAllocation {
    // Start with an allocation of 0 for each strategy
    const allocation: Record<string, number> = {};
    Object.keys(strategyScores).forEach(strategy => {
      allocation[strategy] = 0;
    });
    
    // Calculate total score
    const totalScore = Object.values(strategyScores).reduce((sum, score) => sum + score, 0);
    
    if (totalScore === 0) {
      // If all scores are 0, use equal allocation
      return this.generateEqualAllocation(strategyScores);
    }
    
    // Allocate proportionally to scores, but with adjustments based on risk profile
    Object.entries(strategyScores).forEach(([strategy, score]) => {
      let allocationPercentage = score / totalScore;
      
      // Adjust based on risk profile
      if (riskProfile.type === 'aggressive') {
        // For aggressive, concentrate more on high-scoring strategies
        allocationPercentage = Math.pow(allocationPercentage, 0.8);
      } else if (riskProfile.type === 'low-risk') {
        // For low-risk, distribute more evenly
        allocationPercentage = Math.pow(allocationPercentage, 0.5);
      }
      
      // Adjust based on market conditions
      if (marketAnalysis.volatility_assessment === 'high' && riskProfile.type !== 'aggressive') {
        // In high volatility, reduce allocation to momentum and increase to copy-trading
        if (strategy === 'momentum') {
          allocationPercentage *= 0.8;
        } else if (strategy === 'copy-trading') {
          allocationPercentage *= 1.2;
        }
      }
      
      allocation[strategy] = allocationPercentage;
    });
    
    // Normalize to ensure sum is 1.0
    return this.normalizeAllocation(allocation);
  }

  /**
   * Extract JSON from a text response that might contain markdown, text, etc.
   */
  private extractJsonFromText(text: string): any {
    // Log partial response for debugging
    console.log(`AI response length: ${text.length} characters`);
    
    // Look for text within JSON code blocks
    const jsonBlockMatches = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatches && jsonBlockMatches[1]) {
      try {
        return JSON.parse(jsonBlockMatches[1]);
      } catch (e) {
        console.error('Failed to parse JSON from markdown code block:', e);
      }
    }
    
    // Look for text that appears to be just JSON
    try {
      return JSON.parse(text);
    } catch (e) {
      // If we can't parse the whole text as JSON, look for JSON-like patterns
      const possibleJsonMatch = text.match(/\{[\s\S]*\}/);
      if (possibleJsonMatch) {
        try {
          return JSON.parse(possibleJsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse JSON from text pattern:', e);
        }
      }
    }
    
    return null;
  }

  /**
   * Build a prompt for market analysis based on market data
   */
  private buildMarketAnalysisPrompt(marketData: MarketData): string {
    const assetInfo = Object.entries(marketData.assets)
      .map(([symbol, data]) => {
        // Get exchange-specific data as a string
        const exchangeData = Object.entries(data.exchanges)
          .map(([exchange, exchangeData]) => 
            `${exchange}: $${exchangeData.price.toFixed(2)}, Vol: $${Math.round(exchangeData.volume24h).toLocaleString()}`
          )
          .join('; ');
          
        return `
Symbol: ${symbol}
Price: $${data.price.toFixed(2)}
24h Change: ${data.priceChange24h.toFixed(2)}%
24h Volume: $${Math.round(data.volume24h).toLocaleString()}
Volatility: ${(data.volatility * 100).toFixed(2)}%
Exchanges: ${exchangeData}`;
      })
      .join('\n\n');
      
    // Include global metrics
    const globalMetrics = `
Market Volatility Index: ${(marketData.globalMetrics.volatilityIndex * 100).toFixed(2)}%
Market Sentiment (0-100): ${marketData.globalMetrics.sentimentScore.toFixed(2)}
Trend Strength (0-1): ${marketData.globalMetrics.trendStrength.toFixed(4)}
Timestamp: ${new Date(marketData.timestamp).toISOString()}`;
    
    // Build the full analysis prompt
    return `
You are an expert cryptocurrency market analyst and trader. Analyze the following real-time market data:

${globalMetrics}

ASSET DATA:
${assetInfo}

Based on this data, provide a comprehensive market analysis including:

1. Overall market trend (bullish, bearish, or neutral)
2. Volatility assessment
3. A concise market summary
4. 2-4 specific trading opportunities, including:
   - The asset to trade
   - The strategy to use (momentum, arbitrage, copy-trading)
   - The confidence level (0.0-1.0)
   - Brief reasoning

5. Key market risks and mitigation strategies
6. A ranking of the top 5 assets by potential (scale of 0-100)
7. Any correlation insights between assets
8. Recommended timeframe for these strategies (short, medium, or long term)

Format your response as valid JSON with the following structure:
{
  "market_trend": "bullish|bearish|neutral",
  "volatility_assessment": "low|moderate|high",
  "market_summary": "Concise market analysis",
  "opportunities": [
    {
      "asset": "SYMBOL",
      "strategy": "momentum|arbitrage|copy-trading",
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation"
    }
  ],
  "risks": [
    {
      "description": "Risk description",
      "severity": "low|medium|high",
      "mitigation": "Mitigation strategy"
    }
  ],
  "asset_rankings": [
    {
      "asset": "SYMBOL",
      "potential": 0-100,
      "reasoning": "Brief explanation"
    }
  ],
  "correlation_insights": "Any correlations observed",
  "timeframe_recommendation": "short|medium|long"
}`;
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
As an expert portfolio manager AI, optimize the allocation of capital across multiple trading strategies for our autonomous DeFi hedge fund.

Current Strategy Performance Scores (0-100):
${Object.entries(strategyScores).map(([strategy, score]) => `- ${strategy}: ${score.toFixed(2)}`).join('\n')}

User Risk Profile:
- Type: ${riskProfile.type}
- Max Drawdown Tolerance: ${riskProfile.maxDrawdown}
- Leverage Setting: ${riskProfile.leverage}x
- Position Size Factor: ${riskProfile.positionSizeFactor}
- Max Exposure Per Asset: ${riskProfile.maxExposurePerAsset * 100}%
- Stop Loss: ${riskProfile.stopLossPercentage}%
- Take Profit: ${riskProfile.takeProfitPercentage}%

Current Market Analysis:
- Overall Trend: ${marketAnalysis.market_trend || 'neutral'}
- Volatility: ${marketAnalysis.volatility_assessment || 'moderate'}
- Opportunities Identified: ${marketAnalysis.opportunities?.length || 0}
- Risk Factors: ${marketAnalysis.risks?.length || 0}

Key Opportunities:
${marketAnalysis.opportunities?.slice(0, 2).map((op: any) => 
  `- ${op.asset}: ${op.strategy} strategy with ${(op.confidence * 100).toFixed(1)}% confidence`
).join('\n') || 'None identified'}

Key Risks:
${marketAnalysis.risks?.slice(0, 2).map((risk: any) => 
  `- ${risk.severity.toUpperCase()}: ${risk.description}`
).join('\n') || 'None identified'}

Calculate the optimal allocation across our strategies in JSON format, ensuring allocations sum to 1.0:
{
  "momentum": 0.X,
  "arbitrage": 0.Y,
  "copy-trading": 0.Z
}

Strategic Guidelines:
1. For aggressive risk profiles, concentrate more capital on highest-scoring strategies
2. For low-risk profiles, maintain broader diversification even if some strategies score lower
3. In highly volatile markets, reduce allocation to momentum strategies for balanced/low-risk profiles
4. Consider copy-trading as a more defensive strategy during uncertain market conditions
5. Arbitrage should receive higher allocation when price discrepancies across exchanges are significant

Return ONLY a valid JSON object with the allocations, without any additional text or explanations.
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