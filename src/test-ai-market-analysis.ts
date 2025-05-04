import { MarketDataServiceFactory } from './services/MarketDataServiceFactory';
import { GeminiService } from './services/GeminiService';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test script for AI market analysis with real data
 */
async function main() {
  console.log('Testing AI market analysis with real data...');
  
  // Create services
  const marketDataService = MarketDataServiceFactory.createMarketDataService(true);
  const geminiService = new GeminiService();
  
  try {
    // Fetch real market data
    console.log('\nFetching real market data...');
    const marketData = await marketDataService.getMarketData();
    console.log(`Retrieved data for ${Object.keys(marketData.assets).length} assets`);
    
    // Log a sample of the data
    console.log('\nSample of market data:');
    const assets = Object.keys(marketData.assets).slice(0, 3);
    for (const symbol of assets) {
      const asset = marketData.assets[symbol];
      console.log(`${symbol}: $${asset.price.toFixed(2)} (${asset.priceChange24h.toFixed(2)}%), Vol: $${(asset.volume24h / 1000000).toFixed(2)}M`);
    }
    
    // Analyze with AI
    console.log('\nAnalyzing market data with Gemini AI...');
    const marketAnalysis = await geminiService.analyzeMarket(marketData);
    
    // Display results
    console.log('\nAI Market Analysis Results:');
    console.log(`Market trend: ${marketAnalysis.market_trend}`);
    console.log(`Volatility assessment: ${marketAnalysis.volatility_assessment}`);
    console.log(`Market summary: ${marketAnalysis.market_summary}`);
    
    if (marketAnalysis.opportunities && marketAnalysis.opportunities.length > 0) {
      console.log('\nTop opportunities:');
      for (let i = 0; i < Math.min(3, marketAnalysis.opportunities.length); i++) {
        const opp = marketAnalysis.opportunities[i];
        console.log(`${i+1}. ${opp.asset} (${opp.strategy} strategy) - Confidence: ${(opp.confidence * 100).toFixed(1)}%`);
        console.log(`   Reasoning: ${opp.reasoning}`);
      }
    } else {
      console.log('\nNo opportunities identified.');
    }
    
    if (marketAnalysis.risks && marketAnalysis.risks.length > 0) {
      console.log('\nTop risks:');
      for (let i = 0; i < Math.min(3, marketAnalysis.risks.length); i++) {
        const risk = marketAnalysis.risks[i];
        console.log(`${i+1}. ${risk.description} (${risk.severity} severity)`);
        console.log(`   Mitigation: ${risk.mitigation}`);
      }
    } else {
      console.log('\nNo risks identified.');
    }
    
    if (marketAnalysis.asset_rankings && marketAnalysis.asset_rankings.length > 0) {
      console.log('\nAsset rankings:');
      for (let i = 0; i < Math.min(5, marketAnalysis.asset_rankings.length); i++) {
        const ranking = marketAnalysis.asset_rankings[i];
        console.log(`${i+1}. ${ranking.asset} - Potential: ${ranking.potential}/100`);
        console.log(`   Reasoning: ${ranking.reasoning}`);
      }
    } else {
      console.log('\nNo asset rankings available.');
    }
    
    console.log('\nAdditional insights:');
    console.log(marketAnalysis.correlation_insights || 'No correlation insights available.');
    console.log(`Recommended timeframe: ${marketAnalysis.timeframe_recommendation || 'None specified'}`);
    
  } catch (error) {
    console.error('Error testing AI market analysis:', error);
  }
}

// Run the test
main().catch(console.error); 