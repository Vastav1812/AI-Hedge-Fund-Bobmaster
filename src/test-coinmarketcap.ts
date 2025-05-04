import { CoinMarketCapService } from './services/CoinMarketCapService';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test script for CoinMarketCapService
 */
async function main() {
  console.log('Testing CoinMarketCap integration...');
  
  // Create the service
  const marketDataService = new CoinMarketCapService();
  
  try {
    // Get market data
    console.log('Fetching market data...');
    const marketData = await marketDataService.getMarketData();
    
    // Display basic info
    console.log(`\nData timestamp: ${new Date(marketData.timestamp).toISOString()}`);
    console.log(`Retrieved data for ${Object.keys(marketData.assets).length} assets`);
    
    // Display global metrics
    console.log('\nGlobal Market Metrics:');
    console.log(`- Volatility Index: ${marketData.globalMetrics.volatilityIndex.toFixed(4)}`);
    console.log(`- Sentiment Score: ${marketData.globalMetrics.sentimentScore.toFixed(2)}`);
    console.log(`- Trend Strength: ${marketData.globalMetrics.trendStrength.toFixed(4)}`);
    
    // Display basic asset info
    console.log('\nAsset Data:');
    for (const [symbol, asset] of Object.entries(marketData.assets)) {
      console.log(`${symbol}: $${asset.price.toFixed(2)} (${asset.priceChange24h.toFixed(2)}%), Vol: $${(asset.volume24h / 1000000).toFixed(2)}M`);
      
      // Show first exchange for reference
      const firstExchange = Object.keys(asset.exchanges)[0];
      const exchangeData = asset.exchanges[firstExchange];
      console.log(`  - On ${firstExchange}: $${exchangeData.price.toFixed(2)}, Vol: $${(exchangeData.volume24h / 1000000).toFixed(2)}M`);
    }
    
    // Find arbitrage opportunities
    console.log('\nArbitrage Opportunities:');
    const opportunities = await marketDataService.findArbitrageOpportunities(0.001);
    
    if (opportunities.length > 0) {
      for (let i = 0; i < Math.min(3, opportunities.length); i++) {
        const opp = opportunities[i];
        console.log(`${opp.symbol}: Buy at $${opp.buyPrice.toFixed(4)} on ${opp.buyExchange}, Sell at $${opp.sellPrice.toFixed(4)} on ${opp.sellExchange}`);
        console.log(`  - Difference: ${(opp.priceDiffPercent * 100).toFixed(4)}%, Potential Profit: ${opp.profitPotential.toFixed(4)}%`);
      }
    } else {
      console.log('No arbitrage opportunities found.');
    }
    
    // Get data for specific asset
    console.log('\nDetailed data for BTC:');
    const btcData = await marketDataService.getAssetData('BTC');
    if (btcData) {
      console.log(`Price: $${btcData.price.toFixed(2)}`);
      console.log(`24h Change: ${btcData.priceChange24h.toFixed(2)}%`);
      console.log(`24h Volume: $${(btcData.volume24h / 1000000000).toFixed(2)}B`);
      console.log(`Volatility: ${btcData.volatility.toFixed(4)}`);
      
      console.log('Exchange Prices:');
      for (const [exchange, data] of Object.entries(btcData.exchanges)) {
        console.log(`  - ${exchange}: $${data.price.toFixed(2)}`);
      }
    } else {
      console.log('Failed to fetch BTC data');
    }
    
  } catch (error) {
    console.error('Error testing CoinMarketCap service:', error);
  }
}

// Run the test
main().catch(console.error); 