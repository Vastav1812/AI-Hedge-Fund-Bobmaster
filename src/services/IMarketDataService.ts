import { MarketData, AssetData, OrderBook, HistoricalMarketData } from '../models/types';

/**
 * Interface for market data services
 */
export interface IMarketDataService {
  /**
   * Get the latest market data
   */
  getMarketData(): Promise<MarketData>;
  
  /**
   * Get historical market data for a specific period
   */
  getHistoricalMarketData(
    startTime: number,
    endTime: number,
    interval?: 'hour' | 'day' | 'week'
  ): Promise<HistoricalMarketData[]>;
  
  /**
   * Get detailed data for a specific asset
   */
  getAssetData(symbol: string): Promise<AssetData | null>;
  
  /**
   * Compare prices across exchanges to find arbitrage opportunities
   */
  findArbitrageOpportunities(minPriceGap?: number): Promise<any[]>;
  
  /**
   * Get order book data for a specific symbol and exchange
   */
  getOrderBook(symbol: string, exchange?: string): Promise<OrderBook | null>;
} 