import { MarketData, AssetData, ExchangeData, OrderBook, HistoricalMarketData, CandleData } from '../models/types';
import { IMarketDataService } from './IMarketDataService';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Service to fetch and process market data
 */
export class MarketDataService implements IMarketDataService {
  private readonly MOCK_MODE = true; // Set to false when ready for real market data
  private readonly UPDATE_INTERVAL = 60000; // 1 minute
  private cachedMarketData: MarketData | null = null;
  private lastUpdateTimestamp: number = 0;
  
  constructor() {
    console.log('Market Data Service initialized');
  }
  
  /**
   * Get the latest market data
   */
  public async getMarketData(): Promise<MarketData> {
    const now = Date.now();
    
    // If we have recent data, return it from cache
    if (this.cachedMarketData && (now - this.lastUpdateTimestamp < this.UPDATE_INTERVAL)) {
      return this.cachedMarketData;
    }
    
    // Otherwise, fetch fresh data
    return this.fetchMarketData();
  }
  
  /**
   * Fetch fresh market data
   */
  private async fetchMarketData(): Promise<MarketData> {
    console.log('Fetching fresh market data...');
    
    if (this.MOCK_MODE) {
      const data = this.generateMockMarketData();
      this.cachedMarketData = data;
      this.lastUpdateTimestamp = Date.now();
      return data;
    }
    
    try {
      // In a real implementation, this would:
      // 1. Fetch data from CoinGecko, CoinMarketCap, or cryptocurrency exchange APIs
      // 2. Process and normalize the data
      // 3. Calculate derived metrics
      
      // For now, we'll use mock data
      const data = this.generateMockMarketData();
      this.cachedMarketData = data;
      this.lastUpdateTimestamp = Date.now();
      return data;
    } catch (error) {
      console.error('Error fetching market data:', error);
      
      // If we have any cached data, return it as fallback
      if (this.cachedMarketData) {
        console.log('Returning cached market data as fallback');
        return this.cachedMarketData;
      }
      
      // Otherwise, return mock data
      console.log('Returning mock market data as fallback');
      const mockData = this.generateMockMarketData();
      this.cachedMarketData = mockData;
      this.lastUpdateTimestamp = Date.now();
      return mockData;
    }
  }
  
  /**
   * Generate mock market data for testing
   */
  private generateMockMarketData(): MarketData {
    const timestamp = Date.now();
    
    // Create mock global metrics with some randomness
    const volatilityIndex = 0.05 + (Math.random() * 0.25); // 5-30% volatility
    const sentimentScore = 30 + (Math.random() * 60); // 30-90 sentiment
    const trendStrength = 0.3 + (Math.random() * 0.6); // 0.3-0.9 trend strength
    
    // List of assets to include
    const assetSymbols = ['BTC', 'ETH', 'USDC', 'SON', 'LINK', 'UNI', 'AAVE', 'SOL', 'DOT'];
    
    // List of exchanges
    const exchanges = ['SoneSwap', 'UnoSwap', 'SoneDefi', 'CentralDEX'];
    
    // Create mock asset data
    const assets: Record<string, AssetData> = {};
    
    for (const symbol of assetSymbols) {
      // Base price for each asset
      const basePrice = this.getBasePrice(symbol);
      
      // Generate random price change (-10% to +10%)
      const priceChangePercent = (Math.random() * 20) - 10;
      const price = basePrice * (1 + (priceChangePercent / 100));
      
      // Generate random volume
      const volume = basePrice * (10000 + Math.random() * 100000);
      
      // Generate random volatility
      const volatility = 0.01 + (Math.random() * 0.3);
      
      // Generate exchange data
      const exchangeData: Record<string, ExchangeData> = {};
      
      for (const exchange of exchanges) {
        // Add slight price variations between exchanges (up to 2%)
        const exchangePrice = price * (1 + ((Math.random() * 4) - 2) / 100);
        
        // Different volume on each exchange
        const exchangeVolume = volume * (0.1 + Math.random() * 0.9);
        
        // Random liquidity on each exchange
        const liquidity = exchangeVolume * (1 + Math.random());
        
        exchangeData[exchange] = {
          price: exchangePrice,
          volume24h: exchangeVolume,
          liquidity
        };
      }
      
      assets[symbol] = {
        symbol,
        price,
        priceChange24h: priceChangePercent,
        volume24h: volume,
        volatility,
        exchanges: exchangeData
      };
    }
    
    return {
      timestamp,
      assets,
      globalMetrics: {
        volatilityIndex,
        sentimentScore,
        trendStrength
      }
    };
  }
  
  /**
   * Get a realistic base price for each asset
   */
  private getBasePrice(symbol: string): number {
    // Realistic prices as of early 2023
    switch (symbol) {
      case 'BTC': return 60000 + (Math.random() * 5000);
      case 'ETH': return 3500 + (Math.random() * 500);
      case 'LINK': return 15 + (Math.random() * 5);
      case 'UNI': return 5 + (Math.random() * 2);
      case 'AAVE': return 80 + (Math.random() * 20);
      case 'SOL': return 100 + (Math.random() * 30);
      case 'DOT': return 20 + (Math.random() * 5);
      case 'USDC': return 1 + (Math.random() * 0.01); // Small variations around $1
      case 'SON': return 1 + (Math.random() * 0.5); // Fictional Soneium token
      default: return 10 + (Math.random() * 10); // Default for unknown tokens
    }
  }
  
  /**
   * Get historical market data for a specific period
   */
  public async getHistoricalMarketData(
    startTime: number,
    endTime: number,
    interval: 'hour' | 'day' | 'week' = 'day'
  ): Promise<HistoricalMarketData[]> {
    // In a real implementation, this would fetch historical data from APIs
    // For mock implementation, we'll generate some fake historical data
    
    const now = Date.now();
    const results: HistoricalMarketData[] = [];
    
    // Ensure valid time range
    const validEndTime = endTime > now ? now : endTime;
    
    // Calculate interval in milliseconds
    let intervalMs: number;
    switch (interval) {
      case 'hour': intervalMs = 60 * 60 * 1000; break;
      case 'day': intervalMs = 24 * 60 * 60 * 1000; break;
      case 'week': intervalMs = 7 * 24 * 60 * 60 * 1000; break;
      default: intervalMs = 24 * 60 * 60 * 1000;
    }
    
    // Generate data points
    for (let timestamp = startTime; timestamp <= validEndTime; timestamp += intervalMs) {
      const mockData = this.generateMockMarketData() as HistoricalMarketData;
      mockData.timestamp = timestamp;
      
      // Add candle data
      mockData.candles = {};
      
      for (const symbol in mockData.assets) {
        const asset = mockData.assets[symbol];
        const basePrice = asset.price;
        
        // Generate a candle
        const open = basePrice * (1 - 0.01 + (Math.random() * 0.02));
        const close = basePrice;
        const high = Math.max(open, close) * (1 + (Math.random() * 0.01));
        const low = Math.min(open, close) * (1 - (Math.random() * 0.01));
        
        mockData.candles[symbol] = [{
          timestamp,
          open,
          high,
          low,
          close,
          volume: asset.volume24h
        }];
      }
      
      results.push(mockData);
    }
    
    return results;
  }
  
  /**
   * Get detailed data for a specific asset
   */
  public async getAssetData(symbol: string): Promise<AssetData | null> {
    // Fetch latest market data
    const marketData = await this.getMarketData();
    
    // Return the specific asset data if it exists
    return marketData.assets[symbol] || null;
  }
  
  /**
   * Compare prices across exchanges to find arbitrage opportunities
   */
  public async findArbitrageOpportunities(minPriceGap: number = 0.005): Promise<any[]> {
    const marketData = await this.getMarketData();
    const opportunities = [];
    
    // Look for price differences between exchanges
    for (const [symbol, asset] of Object.entries(marketData.assets)) {
      const exchanges = Object.entries(asset.exchanges);
      
      for (let i = 0; i < exchanges.length; i++) {
        const [exchangeA, dataA] = exchanges[i];
        
        for (let j = i + 1; j < exchanges.length; j++) {
          const [exchangeB, dataB] = exchanges[j];
          
          // Calculate price difference percentage
          const priceDiffPercent = Math.abs(dataA.price - dataB.price) / Math.min(dataA.price, dataB.price);
          
          // If difference exceeds threshold, it's an arbitrage opportunity
          if (priceDiffPercent > minPriceGap) {
            // Determine buy and sell exchanges
            const [buyExchange, buyPrice, sellExchange, sellPrice] = 
              dataA.price < dataB.price 
                ? [exchangeA, dataA.price, exchangeB, dataB.price]
                : [exchangeB, dataB.price, exchangeA, dataA.price];
            
            opportunities.push({
              symbol,
              buyExchange,
              buyPrice,
              sellExchange,
              sellPrice,
              priceDiffPercent,
              potentialProfitPercent: priceDiffPercent - 0.002, // Accounting for fees
              timestamp: marketData.timestamp
            });
          }
        }
      }
    }
    
    return opportunities.sort((a, b) => b.potentialProfitPercent - a.potentialProfitPercent);
  }

  /**
   * Get order book data for a specific symbol and exchange
   */
  public async getOrderBook(symbol: string, exchange: string = 'SoneSwap'): Promise<OrderBook | null> {
    try {
      // Get the asset data
      const assetData = await this.getAssetData(symbol);
      
      if (!assetData) {
        return null;
      }
      
      // Get the exchange data
      const exchangeData = assetData.exchanges[exchange];
      if (!exchangeData) {
        return null;
      }
      
      // Use the base price from the exchange
      const basePrice = exchangeData.price;
      
      const timestamp = Date.now();
      const bids: { price: number, quantity: number }[] = [];
      const asks: { price: number, quantity: number }[] = [];
      
      // Generate 20 bid prices (below base price)
      for (let i = 0; i < 20; i++) {
        const price = basePrice * (1 - (i * 0.001) - (Math.random() * 0.001));
        const quantity = Math.random() * 10 + 0.1; // Random quantity between 0.1 and 10.1
        bids.push({ price, quantity });
      }
      
      // Generate 20 ask prices (above base price)
      for (let i = 0; i < 20; i++) {
        const price = basePrice * (1 + (i * 0.001) + (Math.random() * 0.001));
        const quantity = Math.random() * 10 + 0.1; // Random quantity between 0.1 and 10.1
        asks.push({ price, quantity });
      }
      
      // Sort bids in descending order by price
      bids.sort((a, b) => b.price - a.price);
      
      // Sort asks in ascending order by price
      asks.sort((a, b) => a.price - b.price);
      
      return {
        symbol,
        exchange,
        timestamp,
        bids,
        asks
      };
    } catch (error) {
      console.error(`Error generating order book for ${symbol} on ${exchange}:`, error);
      return null;
    }
  }
} 