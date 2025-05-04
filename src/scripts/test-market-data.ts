/**
 * Script to test the real market data service
 */
import { RealMarketDataService } from "../services/RealMarketDataService";
import { MarketDataService } from "../services/MarketDataService";
import dotenv from "dotenv";

dotenv.config();

async function testMarketData() {
  console.log("Testing Market Data Services...");

  // Create both services for comparison
  const realDataService = new RealMarketDataService();
  const mockDataService = new MarketDataService();

  try {
    console.log("Initializing real market data service...");
    await realDataService.initialize();

    console.log("\nFetching REAL market data...");
    const startReal = Date.now();
    const realData = await realDataService.getMarketData();
    const realTime = Date.now() - startReal;

    console.log("\nFetching MOCK market data...");
    const startMock = Date.now();
    const mockData = await mockDataService.getMarketData();
    const mockTime = Date.now() - startMock;

    // Compare results
    console.log("\n--- COMPARISON ---");
    console.log(`Real data fetch time: ${realTime}ms`);
    console.log(`Mock data fetch time: ${mockTime}ms`);

    console.log("\nReal Data Assets:");
    console.log(Object.keys(realData.assets).join(", "));

    console.log("\nMock Data Assets:");
    console.log(Object.keys(mockData.assets).join(", "));

    // Show some sample price data
    console.log("\n--- SAMPLE PRICE DATA ---");
    for (const symbol of Object.keys(realData.assets)) {
      if (mockData.assets[symbol]) {
        console.log(
          `${symbol}: Real $${realData.assets[symbol].price.toFixed(
            2
          )} | Mock $${mockData.assets[symbol].price.toFixed(2)}`
        );
      } else {
        console.log(
          `${symbol}: Real $${realData.assets[symbol].price.toFixed(
            2
          )} | Mock N/A`
        );
      }
    }

    // Display global metrics
    console.log("\n--- GLOBAL METRICS ---");
    console.log("Real Data:");
    console.log(
      `- Volatility Index: ${realData.globalMetrics.volatilityIndex.toFixed(4)}`
    );
    console.log(
      `- Sentiment Score: ${realData.globalMetrics.sentimentScore.toFixed(2)}`
    );
    console.log(
      `- Trend Strength: ${realData.globalMetrics.trendStrength.toFixed(4)}`
    );

    console.log("\nMock Data:");
    console.log(
      `- Volatility Index: ${mockData.globalMetrics.volatilityIndex.toFixed(4)}`
    );
    console.log(
      `- Sentiment Score: ${mockData.globalMetrics.sentimentScore.toFixed(2)}`
    );
    console.log(
      `- Trend Strength: ${mockData.globalMetrics.trendStrength.toFixed(4)}`
    );

    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Error testing market data services:", error);
  }
}

// Run the test
testMarketData().catch(console.error);
