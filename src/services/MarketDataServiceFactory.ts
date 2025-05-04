import { IMarketDataService } from './IMarketDataService';
import { MarketDataService } from './MarketDataService';
import { CoinMarketCapService } from './CoinMarketCapService';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Factory for creating market data services
 */
export class MarketDataServiceFactory {
  /**
   * Create an appropriate market data service
   * @param useRealData Whether to use real market data if available
   */
  public static createMarketDataService(useRealData: boolean = true): IMarketDataService {
    // Check if real data is requested and CoinMarketCap API key is available
    if (useRealData && process.env.COINMARKETCAP_API_KEY) {
      console.log('Creating real market data service using CoinMarketCap');
      return new CoinMarketCapService();
    } else {
      console.log('Creating mock market data service');
      return new MarketDataService();
    }
  }
} 