import { WebSocketService } from './services/WebSocketService';
import { CoinMarketCapService } from './services/CoinMarketCapService';
import dotenv from 'dotenv';
import { TickerUpdate, TradeUpdate, OrderBookUpdate } from './models/types';

dotenv.config();

/**
 * Test script for real-time market data features
 */
async function main() {
  console.log('Testing real-time market data features...');
  
  // Create services
  const marketDataService = new CoinMarketCapService();
  const wsService = new WebSocketService();
  
  // Check command line args to determine which tests to run
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Run all tests if no specific test is specified
    console.log('Running all tests...');
    await testHistoricalData(marketDataService);
    await testOrderBook(marketDataService);
    await testWebSocketUpdates(wsService);
  } else {
    // Run specific tests
    for (const arg of args) {
      switch (arg.toLowerCase()) {
        case 'history':
          await testHistoricalData(marketDataService);
          break;
        case 'orderbook':
          await testOrderBook(marketDataService);
          break;
        case 'websocket':
          await testWebSocketUpdates(wsService);
          break;
        default:
          console.log(`Unknown test: ${arg}`);
      }
    }
  }
  
  // Cleanup
  console.log('\nTests completed. Cleaning up...');
  wsService.closeAll();
}

/**
 * Test historical data retrieval
 */
async function testHistoricalData(marketDataService: CoinMarketCapService) {
  console.log('\n--- Testing Historical Data Retrieval ---');
  
  // Get data for the last 7 days
  const endTime = Date.now();
  const startTime = endTime - (7 * 24 * 60 * 60 * 1000); // 7 days ago
  
  console.log(`Retrieving daily historical data from ${new Date(startTime).toLocaleDateString()} to ${new Date(endTime).toLocaleDateString()}`);
  
  try {
    const historicalData = await marketDataService.getHistoricalMarketData(startTime, endTime, 'day');
    
    console.log(`Retrieved ${historicalData.length} historical data points`);
    
    // Display BTC price history
    console.log('\nBTC Price History:');
    for (const dataPoint of historicalData) {
      const date = new Date(dataPoint.timestamp).toLocaleDateString();
      const btcPrice = dataPoint.assets['BTC']?.price || 0;
      const btcCandle = dataPoint.candles?.['BTC']?.[0];
      
      if (btcCandle) {
        console.log(`${date}: Open: $${btcCandle.open.toFixed(2)}, High: $${btcCandle.high.toFixed(2)}, Low: $${btcCandle.low.toFixed(2)}, Close: $${btcCandle.close.toFixed(2)}, Volume: ${(btcCandle.volume/1000000).toFixed(2)}M`);
      } else {
        console.log(`${date}: $${btcPrice.toFixed(2)}`);
      }
    }
    
    // Also try hourly data for the last 24 hours
    const hourlyStartTime = endTime - (24 * 60 * 60 * 1000); // 24 hours ago
    console.log(`\nRetrieving hourly historical data for the last 24 hours`);
    
    const hourlyData = await marketDataService.getHistoricalMarketData(hourlyStartTime, endTime, 'hour');
    console.log(`Retrieved ${hourlyData.length} hourly data points`);
    
    // Display ETH price history for the last few hours
    console.log('\nETH Price History (Last 6 hours):');
    const last6Hours = hourlyData.slice(-6);
    for (const dataPoint of last6Hours) {
      const time = new Date(dataPoint.timestamp).toLocaleTimeString();
      const ethPrice = dataPoint.assets['ETH']?.price || 0;
      console.log(`${time}: $${ethPrice.toFixed(2)}`);
    }
    
    console.log('\nHistorical data test completed successfully');
  } catch (error) {
    console.error('Error testing historical data:', error);
  }
}

/**
 * Test order book data
 */
async function testOrderBook(marketDataService: CoinMarketCapService) {
  console.log('\n--- Testing Order Book Data ---');
  
  try {
    // Get order books for BTC on different exchanges
    console.log('\nBTC Order Books:');
    for (const exchange of ['Binance', 'Coinbase Exchange', 'Kraken']) {
      const orderBook = await marketDataService.getOrderBook('BTC', exchange);
      
      if (orderBook) {
        console.log(`\n${exchange} Order Book for BTC:`);
        console.log(`Timestamp: ${new Date(orderBook.timestamp).toISOString()}`);
        console.log(`Top 3 Bids (Buy Orders):`);
        orderBook.bids.slice(0, 3).forEach((bid, i) => {
          console.log(`  ${i+1}. ${bid.quantity.toFixed(5)} BTC @ $${bid.price.toFixed(2)}`);
        });
        
        console.log(`Top 3 Asks (Sell Orders):`);
        orderBook.asks.slice(0, 3).forEach((ask, i) => {
          console.log(`  ${i+1}. ${ask.quantity.toFixed(5)} BTC @ $${ask.price.toFixed(2)}`);
        });
        
        // Calculate spread
        if (orderBook.asks.length > 0 && orderBook.bids.length > 0) {
          const lowestAsk = orderBook.asks[0].price;
          const highestBid = orderBook.bids[0].price;
          const spread = lowestAsk - highestBid;
          const spreadPercent = (spread / lowestAsk) * 100;
          
          console.log(`Spread: $${spread.toFixed(2)} (${spreadPercent.toFixed(4)}%)`);
        }
      } else {
        console.log(`Failed to get order book for BTC on ${exchange}`);
      }
    }
    
    // Test with a different asset
    console.log('\nETH Order Book on Binance:');
    const ethOrderBook = await marketDataService.getOrderBook('ETH', 'Binance');
    
    if (ethOrderBook) {
      console.log(`Timestamp: ${new Date(ethOrderBook.timestamp).toISOString()}`);
      console.log(`Order Book Depth: ${ethOrderBook.bids.length} bids, ${ethOrderBook.asks.length} asks`);
      
      // Calculate total liquidity within 1% of mid price
      const midPrice = (ethOrderBook.asks[0].price + ethOrderBook.bids[0].price) / 2;
      const lowerBound = midPrice * 0.99;
      const upperBound = midPrice * 1.01;
      
      const bidLiquidity = ethOrderBook.bids
        .filter(bid => bid.price >= lowerBound)
        .reduce((sum, bid) => sum + (bid.price * bid.quantity), 0);
      
      const askLiquidity = ethOrderBook.asks
        .filter(ask => ask.price <= upperBound)
        .reduce((sum, ask) => sum + (ask.price * ask.quantity), 0);
      
      console.log(`Liquidity within 1% of mid price: $${(bidLiquidity + askLiquidity).toFixed(2)}`);
    } else {
      console.log('Failed to get order book for ETH on Binance');
    }
    
    // Test arbitrage opportunities with order book data
    console.log('\nFinding arbitrage opportunities with order book data:');
    const opportunities = await marketDataService.findArbitrageOpportunities(0.001);
    
    if (opportunities.length > 0) {
      console.log(`Found ${opportunities.length} potential arbitrage opportunities`);
      for (let i = 0; i < Math.min(3, opportunities.length); i++) {
        const opp = opportunities[i];
        console.log(`${i+1}. ${opp.symbol}: Buy at $${opp.effectiveBuyPrice.toFixed(4)} on ${opp.buyExchange}, Sell at $${opp.effectiveSellPrice.toFixed(4)} on ${opp.sellExchange}`);
        console.log(`   Nominal profit: ${opp.profitPotential.toFixed(4)}%, Effective profit: ${opp.effectiveProfitPotential.toFixed(4)}%, Risk: ${opp.executionRisk}`);
      }
    } else {
      console.log('No arbitrage opportunities found.');
    }
    
    console.log('\nOrder book test completed successfully');
  } catch (error) {
    console.error('Error testing order book data:', error);
  }
}

/**
 * Test WebSocket real-time updates
 */
async function testWebSocketUpdates(wsService: WebSocketService) {
  console.log('\n--- Testing WebSocket Real-time Updates ---');
  console.log('Setting up event listeners for real-time updates...');
  
  // Set up event listeners
  wsService.on('ticker', (ticker: TickerUpdate) => {
    console.log(`[Ticker] ${ticker.symbol} on ${ticker.exchange}: $${ticker.price.toFixed(2)} (${ticker.priceChange24h.toFixed(2)}%)`);
  });
  
  wsService.on('trade', (trade: TradeUpdate) => {
    console.log(`[Trade] ${trade.symbol} on ${trade.exchange}: ${trade.side.toUpperCase()} ${trade.quantity.toFixed(5)} @ $${trade.price.toFixed(2)}`);
  });
  
  wsService.on('orderbook', (update: OrderBookUpdate) => {
    const type = update.isSnapshot ? 'Snapshot' : 'Update';
    const bidCount = update.bids?.length || 0;
    const askCount = update.asks?.length || 0;
    console.log(`[OrderBook ${type}] ${update.symbol} on ${update.exchange}: ${bidCount} bids, ${askCount} asks`);
  });
  
  wsService.on('connection_failed', (exchange: string) => {
    console.error(`Connection to ${exchange} failed after maximum retry attempts`);
  });
  
  // Subscribe to various data feeds
  console.log('\nSubscribing to market data feeds...');
  
  try {
    // BTC ticker on Binance
    await wsService.subscribeToMarketData('BTCUSDT', 'binance', ['ticker']);
    console.log('Subscribed to BTC ticker on Binance');
    
    // ETH trades on Coinbase
    await wsService.subscribeToMarketData('ETH-USD', 'coinbase', ['trade']);
    console.log('Subscribed to ETH trades on Coinbase');
    
    // Order book for BTC on Kraken
    await wsService.subscribeToMarketData('XBT/USD', 'kraken', ['orderbook']);
    console.log('Subscribed to BTC order book on Kraken');
    
    // Wait for real-time updates for 30 seconds
    console.log('\nListening for real-time updates for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Unsubscribe from feeds
    console.log('\nUnsubscribing from market data feeds...');
    wsService.unsubscribeFromMarketData('BTCUSDT', 'binance');
    wsService.unsubscribeFromMarketData('ETH-USD', 'coinbase');
    wsService.unsubscribeFromMarketData('XBT/USD', 'kraken');
    
    console.log('\nWebSocket test completed successfully');
  } catch (error) {
    console.error('Error testing WebSocket updates:', error);
  }
}

// Run the test
main().catch(console.error); 