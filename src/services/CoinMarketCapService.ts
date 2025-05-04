import {
  MarketData,
  AssetData,
  ExchangeData,
  OrderBook,
  HistoricalMarketData,
  CandleData,
} from "../models/types";
import { IMarketDataService } from "./IMarketDataService";
import CoinMarketCap from "coinmarketcap-api";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import axios from "axios";

dotenv.config();

/**
 * Service to fetch real market data from CoinMarketCap
 */
export class CoinMarketCapService implements IMarketDataService {
  private client: any;
  private apiKey: string;
  private isInitialized: boolean = false;
  private cachedMarketData: MarketData | null = null;
  private cachedHistoricalData: Map<string, HistoricalMarketData[]> = new Map();
  private cachedOrderBooks: Map<string, OrderBook> = new Map();
  private lastUpdateTimestamp: number = 0;
  private readonly UPDATE_INTERVAL = 60000; // 1 minute (CoinMarketCap has rate limits)
  private readonly CACHE_DIR = path.join(process.cwd(), "cache");
  private readonly DEFAULT_EXCHANGE_LIST = [
    "Binance",
    "Coinbase Exchange",
    "Kraken",
    "Huobi",
  ];
  private readonly SUPPORTED_ASSETS = [
    "BTC",
    "ETH",
    "USDC",
    "LINK",
    "UNI",
    "AAVE",
    "SOL",
    "DOT",
    "USDT",
  ];

  constructor() {
    this.apiKey =
      process.env.COINMARKETCAP_API_KEY ||
      "16f433de-15b7-42a5-8140-580b2f400975";
    this.initialize();
  }

  /**
   * Initialize the CoinMarketCap client
   */
  private initialize(): void {
    try {
      this.client = new CoinMarketCap(this.apiKey);
      this.isInitialized = true;

      // Ensure cache directory exists
      if (!fs.existsSync(this.CACHE_DIR)) {
        fs.mkdirSync(this.CACHE_DIR, { recursive: true });
      }

      console.log("CoinMarketCap API service initialized successfully");

      // Load cached historical data
      this.loadHistoricalDataCache();
    } catch (error) {
      console.error("Failed to initialize CoinMarketCap API:", error);
      this.isInitialized = false;
    }
  }

  /**
   * Load historical data from cache
   */
  private loadHistoricalDataCache(): void {
    try {
      const cacheFile = path.join(this.CACHE_DIR, "historical_data_cache.json");

      if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));

        Object.entries(cacheData).forEach(([key, data]) => {
          this.cachedHistoricalData.set(key, data as HistoricalMarketData[]);
        });

        console.log(
          `Loaded historical data cache with ${this.cachedHistoricalData.size} entries`
        );
      }
    } catch (error) {
      console.error("Error loading historical data cache:", error);
    }
  }

  /**
   * Save historical data to cache
   */
  private saveHistoricalDataCache(): void {
    try {
      const cacheFile = path.join(this.CACHE_DIR, "historical_data_cache.json");
      const cacheData: Record<string, HistoricalMarketData[]> = {};

      this.cachedHistoricalData.forEach((data, key) => {
        cacheData[key] = data;
      });

      fs.writeFileSync(cacheFile, JSON.stringify(cacheData), "utf-8");
    } catch (error) {
      console.error("Error saving historical data cache:", error);
    }
  }

  /**
   * Get the latest market data
   */
  public async getMarketData(): Promise<MarketData> {
    const now = Date.now();

    // If we have recent data, return it from cache
    if (
      this.cachedMarketData &&
      now - this.lastUpdateTimestamp < this.UPDATE_INTERVAL
    ) {
      return this.cachedMarketData;
    }

    return this.fetchMarketData();
  }

  /**
   * Fetch fresh market data from CoinMarketCap
   */
  private async fetchMarketData(): Promise<MarketData> {
    console.log("Fetching real market data from CoinMarketCap...");

    if (!this.isInitialized) {
      console.error("CoinMarketCap API not initialized, returning mock data");
      return this.generateMockMarketData();
    }

    try {
      // Get latest cryptocurrency quotes
      const quotesResponse = await this.client.getQuotes({
        symbol: this.SUPPORTED_ASSETS.join(","),
      });

      // Get global market metrics
      const globalResponse = await this.client.getGlobal();

      // Prepare result structure
      const assets: Record<string, AssetData> = {};
      const timestamp = Date.now();

      // Process data
      if (quotesResponse && quotesResponse.data) {
        for (const symbol of this.SUPPORTED_ASSETS) {
          const assetData = quotesResponse.data[symbol];

          if (assetData) {
            const quote = assetData.quote.USD;

            // Calculate volatility using price change percentage
            // This is an approximation since real volatility needs historical data
            const volatility = Math.abs(quote.percent_change_24h) / 100;

            // Create exchange data (CoinMarketCap doesn't provide per-exchange data in free tier)
            // We'll simulate multiple exchanges with slight variations
            const exchanges: Record<string, ExchangeData> = {};

            this.DEFAULT_EXCHANGE_LIST.forEach((exchange) => {
              // Add some random variation to price and volume for simulated exchanges
              const priceVariation =
                quote.price * (1 + (Math.random() * 2 - 1) / 100);
              const volumeVariation =
                quote.volume_24h * (0.8 + Math.random() * 0.4);

              exchanges[exchange] = {
                price: priceVariation,
                volume24h: volumeVariation,
                liquidity: volumeVariation * 0.5, // Approximate liquidity based on volume
              };
            });

            // Add to assets
            assets[symbol] = {
              symbol,
              price: quote.price,
              priceChange24h: quote.percent_change_24h,
              volume24h: quote.volume_24h,
              volatility,
              exchanges,
            };
          }
        }
      }

      // Calculate global metrics
      const globalMetrics = {
        volatilityIndex: globalResponse?.data?.volatility_24h / 100 || 0.1,
        sentimentScore: 50, // Not provided by CMC API, using default
        trendStrength: Math.abs(globalResponse?.data?.btc_dominance - 50) / 50, // Use BTC dominance as a proxy
      };

      // Create market data
      const marketData: MarketData = {
        timestamp,
        assets,
        globalMetrics,
      };

      // Cache the result
      this.cachedMarketData = marketData;
      this.lastUpdateTimestamp = timestamp;

      console.log(
        `Fetched data for ${
          Object.keys(assets).length
        } assets from CoinMarketCap`
      );
      return marketData;
    } catch (error) {
      console.error("Error fetching data from CoinMarketCap:", error);

      // If we have any cached data, return it as fallback
      if (this.cachedMarketData) {
        console.log("Returning cached market data as fallback");
        return this.cachedMarketData;
      }

      // Otherwise, return mock data
      console.log("Returning mock market data as fallback");
      return this.generateMockMarketData();
    }
  }

  /**
   * Get historical market data for a specific period
   * This implementation tries to fetch real historical data from CryptoCompare API
   * as CoinMarketCap historical data requires premium API
   */
  public async getHistoricalMarketData(
    startTime: number,
    endTime: number,
    interval: "hour" | "day" | "week" = "day"
  ): Promise<HistoricalMarketData[]> {
    console.log(
      `Getting historical market data from ${new Date(
        startTime
      ).toISOString()} to ${new Date(endTime).toISOString()}`
    );

    // Generate cache key
    const cacheKey = `${startTime}_${endTime}_${interval}`;

    // Check if we have this data in cache
    if (this.cachedHistoricalData.has(cacheKey)) {
      console.log(`Using cached historical data for ${cacheKey}`);
      return this.cachedHistoricalData.get(cacheKey) || [];
    }

    try {
      // CoinMarketCap historical data requires premium API
      // We'll use CryptoCompare API instead which has a free tier with historical data

      const results: HistoricalMarketData[] = [];
      const currentData = await this.getMarketData();

      // Calculate interval in seconds
      let intervalSeconds: number;
      switch (interval) {
        case "hour":
          intervalSeconds = 60 * 60;
          break;
        case "day":
          intervalSeconds = 24 * 60 * 60;
          break;
        case "week":
          intervalSeconds = 7 * 24 * 60 * 60;
          break;
        default:
          intervalSeconds = 24 * 60 * 60;
      }

      // Determine CryptoCompare endpoint
      let endpoint: string;
      switch (interval) {
        case "hour":
          endpoint = "histohour";
          break;
        case "day":
          endpoint = "histoday";
          break;
        case "week":
          endpoint = "histoday";
          break; // Use day and then aggregate for week
        default:
          endpoint = "histoday";
      }

      // Go through each supported asset
      for (const symbol of this.SUPPORTED_ASSETS) {
        try {
          // Calculate number of data points needed
          const timeRange = endTime - startTime;
          const limit = Math.min(
            2000,
            Math.ceil(timeRange / (intervalSeconds * 1000))
          ); // CryptoCompare limit is 2000

          // Prepare the URL
          const apiUrl = `https://min-api.cryptocompare.com/data/v2/${endpoint}?fsym=${symbol}&tsym=USD&limit=${limit}&toTs=${Math.floor(
            endTime / 1000
          )}`;

          // Make the API call
          const response = await axios.get(apiUrl);

          if (response.data && response.data.Response === "Success") {
            const histData = response.data.Data.Data;

            // Process each data point
            histData.forEach((item: any, index: number) => {
              const timestamp = item.time * 1000;

              // Ensure we have a result for this timestamp
              if (!results[index]) {
                // Clone the current market data
                const dataPoint = JSON.parse(
                  JSON.stringify(currentData)
                ) as HistoricalMarketData;
                dataPoint.timestamp = timestamp;
                dataPoint.candles = {};
                results[index] = dataPoint;
              }

              // Add candle data for this asset
              if (!results[index].candles) {
                results[index].candles = {};
              }

              const candle: CandleData = {
                timestamp: timestamp,
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volumefrom,
              };

              // Add to candles
              if (!results[index].candles[symbol]) {
                results[index].candles[symbol] = [];
              }
              results[index].candles[symbol].push(candle);

              // Update the asset price
              if (results[index].assets[symbol]) {
                results[index].assets[symbol].price = item.close;
                results[index].assets[symbol].priceChange24h =
                  index > 0
                    ? ((item.close - histData[index - 1].close) /
                        histData[index - 1].close) *
                      100
                    : 0;
                results[index].assets[symbol].volume24h = item.volumeto;
              }
            });
          }
        } catch (error) {
          console.error(`Error fetching historical data for ${symbol}:`, error);
        }
      }

      // If interval is 'week', aggregate the daily data
      if (interval === "week") {
        const weeklyResults: HistoricalMarketData[] = [];
        for (let i = 0; i < results.length; i += 7) {
          if (i + 6 < results.length) {
            const weekData = results[i].candles
              ? JSON.parse(JSON.stringify(results[i]))
              : results[i];
            weekData.timestamp = results[i].timestamp;

            // Aggregate candles
            if (weekData.candles) {
              Object.keys(weekData.candles).forEach((symbol) => {
                const weekCandles: CandleData[] = [
                  {
                    timestamp: results[i].timestamp,
                    open: results[i].candles?.[symbol]?.[0]?.open || 0,
                    high: Math.max(
                      ...results
                        .slice(i, i + 7)
                        .map((r) =>
                          Math.max(
                            ...(r.candles?.[symbol]?.map((c) => c.high) || [0])
                          )
                        )
                    ),
                    low: Math.min(
                      ...results
                        .slice(i, i + 7)
                        .map((r) =>
                          Math.min(
                            ...(r.candles?.[symbol]?.map((c) => c.low) || [
                              Infinity,
                            ])
                          )
                        )
                    ),
                    close: results[i + 6].candles?.[symbol]?.[0]?.close || 0,
                    volume: results
                      .slice(i, i + 7)
                      .reduce(
                        (sum, r) =>
                          sum +
                          (r.candles?.[symbol]?.reduce(
                            (s, c) => s + c.volume,
                            0
                          ) || 0),
                        0
                      ),
                  },
                ];
                weekData.candles[symbol] = weekCandles;
              });
            }

            weeklyResults.push(weekData);
          }
        }

        // Use weekly results instead
        if (weeklyResults.length > 0) {
          results.length = 0;
          results.push(...weeklyResults);
        }
      }

      // Cache the results
      this.cachedHistoricalData.set(cacheKey, results);
      this.saveHistoricalDataCache();

      return results;
    } catch (error) {
      console.error("Error getting historical market data:", error);

      // Return simulated historical data as fallback
      return this.generateMockHistoricalData(startTime, endTime, interval);
    }
  }

  /**
   * Get detailed data for a specific asset
   */
  public async getAssetData(symbol: string): Promise<AssetData | null> {
    try {
      if (!this.isInitialized) {
        throw new Error("CoinMarketCap API not initialized");
      }

      // Get data for the specific symbol
      const response = await this.client.getQuotes({
        symbol,
      });

      if (response && response.data && response.data[symbol]) {
        const assetData = response.data[symbol];
        const quote = assetData.quote.USD;

        // Calculate volatility
        const volatility = Math.abs(quote.percent_change_24h) / 100;

        // Create exchange data
        const exchanges: Record<string, ExchangeData> = {};

        this.DEFAULT_EXCHANGE_LIST.forEach((exchange) => {
          const priceVariation =
            quote.price * (1 + (Math.random() * 2 - 1) / 100);
          const volumeVariation =
            quote.volume_24h * (0.8 + Math.random() * 0.4);

          exchanges[exchange] = {
            price: priceVariation,
            volume24h: volumeVariation,
            liquidity: volumeVariation * 0.5,
          };
        });

        return {
          symbol,
          price: quote.price,
          priceChange24h: quote.percent_change_24h,
          volume24h: quote.volume_24h,
          volatility,
          exchanges,
        };
      }

      return null;
    } catch (error) {
      console.error(`Error getting data for asset ${symbol}:`, error);

      // Check if we have the asset in cache
      if (this.cachedMarketData && this.cachedMarketData.assets[symbol]) {
        return this.cachedMarketData.assets[symbol];
      }

      return null;
    }
  }

  /**
   * Get order book data for a specific symbol and exchange
   * Since CoinMarketCap doesn't provide order book data, this uses CryptoCompare's API
   */
  public async getOrderBook(
    symbol: string,
    exchange: string = "Binance"
  ): Promise<OrderBook | null> {
    const cacheKey = `${symbol}_${exchange}`;
    const now = Date.now();

    // Check if we have recent order book data
    if (this.cachedOrderBooks.has(cacheKey)) {
      const cachedBook = this.cachedOrderBooks.get(cacheKey)!;
      // Only use cache if it's less than 1 minute old
      if (now - cachedBook.timestamp < 60000) {
        return cachedBook;
      }
    }

    try {
      // Convert exchange name to CryptoCompare format
      let cryptoCompareExchange: string;
      switch (exchange.toLowerCase()) {
        case "binance":
          cryptoCompareExchange = "Binance";
          break;
        case "coinbase":
        case "coinbase exchange":
          cryptoCompareExchange = "Coinbase";
          break;
        case "kraken":
          cryptoCompareExchange = "Kraken";
          break;
        case "huobi":
          cryptoCompareExchange = "Huobi";
          break;
        default:
          cryptoCompareExchange = "Binance"; // Fallback to Binance
      }

      // Make API call to CryptoCompare
      const apiUrl = `https://min-api.cryptocompare.com/data/v2/ob/l2/snapshot?fsym=${symbol}&tsym=USD&e=${cryptoCompareExchange}`;
      const response = await axios.get(apiUrl);

      if (response.data && response.data.Response === "Success") {
        const data = response.data.Data;

        // Create order book
        const orderBook: OrderBook = {
          symbol,
          exchange,
          timestamp: now,
          bids: data.Bid.map((bid: any) => ({
            price: bid.P,
            quantity: bid.Q,
          })),
          asks: data.Ask.map((ask: any) => ({
            price: ask.P,
            quantity: ask.Q,
          })),
        };

        // Cache the result
        this.cachedOrderBooks.set(cacheKey, orderBook);

        return orderBook;
      }

      throw new Error(
        `Failed to get order book data: ${response.data.Message}`
      );
    } catch (error) {
      console.error(
        `Error getting order book for ${symbol} on ${exchange}:`,
        error
      );

      // Return mock order book as fallback
      return this.generateMockOrderBook(symbol, exchange);
    }
  }

  /**
   * Compare prices across exchanges to find arbitrage opportunities
   */
  public async findArbitrageOpportunities(
    minPriceGap: number = 0.005
  ): Promise<any[]> {
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
          const priceDiffPercent =
            Math.abs(dataA.price - dataB.price) /
            Math.min(dataA.price, dataB.price);

          // If difference exceeds threshold, it's an arbitrage opportunity
          if (priceDiffPercent > minPriceGap) {
            // Determine buy and sell exchanges
            const [buyExchange, buyPrice, sellExchange, sellPrice] =
              dataA.price < dataB.price
                ? [exchangeA, dataA.price, exchangeB, dataB.price]
                : [exchangeB, dataB.price, exchangeA, dataA.price];

            // Get order book data to validate if there's enough liquidity
            let buyOrderBook, sellOrderBook;
            try {
              buyOrderBook = await this.getOrderBook(symbol, buyExchange);
              sellOrderBook = await this.getOrderBook(symbol, sellExchange);
            } catch (error) {
              console.warn(
                `Error getting order book data for ${symbol}:`,
                error
              );
            }

            // Calculate effective price after slippage (if order book data is available)
            let effectiveBuyPrice = buyPrice;
            let effectiveSellPrice = sellPrice;
            let executionRisk = "high";

            if (buyOrderBook && sellOrderBook) {
              // Simple slippage estimate based on order book depth
              const buyDepth = buyOrderBook.asks.reduce(
                (sum, ask) => sum + ask.quantity,
                0
              );
              const sellDepth = sellOrderBook.bids.reduce(
                (sum, bid) => sum + bid.quantity,
                0
              );

              // Estimate execution risk
              if (buyDepth > 10 && sellDepth > 10) {
                executionRisk = "low";
              } else if (buyDepth > 5 && sellDepth > 5) {
                executionRisk = "medium";
              }

              // Simulate slippage for a trade of 1 unit
              const tradeAmount = 1;
              if (
                buyOrderBook.asks.length > 0 &&
                sellOrderBook.bids.length > 0
              ) {
                // Simple weighted average price calculation for slippage
                let remainingAmount = tradeAmount;
                let totalCost = 0;

                for (const ask of buyOrderBook.asks) {
                  const fillAmount = Math.min(remainingAmount, ask.quantity);
                  totalCost += fillAmount * ask.price;
                  remainingAmount -= fillAmount;

                  if (remainingAmount <= 0) break;
                }

                if (remainingAmount <= 0) {
                  effectiveBuyPrice = totalCost / tradeAmount;
                }

                // Same for sell side
                remainingAmount = tradeAmount;
                let totalRevenue = 0;

                for (const bid of sellOrderBook.bids) {
                  const fillAmount = Math.min(remainingAmount, bid.quantity);
                  totalRevenue += fillAmount * bid.price;
                  remainingAmount -= fillAmount;

                  if (remainingAmount <= 0) break;
                }

                if (remainingAmount <= 0) {
                  effectiveSellPrice = totalRevenue / tradeAmount;
                }
              }
            }

            // Recalculate profit with effective prices
            const effectiveProfitPercent =
              ((effectiveSellPrice - effectiveBuyPrice) * 100) /
              effectiveBuyPrice;

            // Only include if still profitable after slippage
            if (effectiveProfitPercent > 0) {
              opportunities.push({
                symbol,
                buyExchange,
                buyPrice,
                effectiveBuyPrice,
                sellExchange,
                sellPrice,
                effectiveSellPrice,
                priceDiffPercent,
                profitPotential: ((sellPrice - buyPrice) * 100) / buyPrice,
                effectiveProfitPotential: effectiveProfitPercent,
                executionRisk,
              });
            }
          }
        }
      }
    }

    // Sort by profit potential
    return opportunities.sort(
      (a, b) => b.effectiveProfitPotential - a.effectiveProfitPotential
    );
  }

  /**
   * Generate a mock order book for a symbol and exchange
   */
  private generateMockOrderBook(symbol: string, exchange: string): OrderBook {
    // Get base price from cached market data or generate one
    let basePrice: number;

    if (this.cachedMarketData && this.cachedMarketData.assets[symbol]) {
      basePrice = this.cachedMarketData.assets[symbol].price;
    } else {
      basePrice = this.getBasePrice(symbol);
    }

    const timestamp = Date.now();
    const bids: { price: number; quantity: number }[] = [];
    const asks: { price: number; quantity: number }[] = [];

    // Generate 20 bid prices (below base price)
    for (let i = 0; i < 20; i++) {
      const price = basePrice * (1 - i * 0.001 - Math.random() * 0.001);
      const quantity = Math.random() * 10 + 0.1; // Random quantity between 0.1 and 10.1
      bids.push({ price, quantity });
    }

    // Generate 20 ask prices (above base price)
    for (let i = 0; i < 20; i++) {
      const price = basePrice * (1 + i * 0.001 + Math.random() * 0.001);
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
      asks,
    };
  }

  /**
   * Generate mock market data as a fallback
   */
  private generateMockMarketData(): MarketData {
    const timestamp = Date.now();

    // Create mock global metrics
    const volatilityIndex = 0.05 + Math.random() * 0.25;
    const sentimentScore = 30 + Math.random() * 60;
    const trendStrength = 0.3 + Math.random() * 0.6;

    // Create mock asset data
    const assets: Record<string, AssetData> = {};

    for (const symbol of this.SUPPORTED_ASSETS) {
      // Base price for each asset
      const basePrice = this.getBasePrice(symbol);

      // Generate random price change (-10% to +10%)
      const priceChangePercent = Math.random() * 20 - 10;
      const price = basePrice * (1 + priceChangePercent / 100);

      // Generate random volume
      const volume = basePrice * (10000 + Math.random() * 100000);

      // Generate random volatility
      const volatility = 0.01 + Math.random() * 0.3;

      // Generate exchange data
      const exchangeData: Record<string, ExchangeData> = {};

      for (const exchange of this.DEFAULT_EXCHANGE_LIST) {
        // Add slight price variations between exchanges (up to 2%)
        const exchangePrice = price * (1 + (Math.random() * 4 - 2) / 100);

        // Different volume on each exchange
        const exchangeVolume = volume * (0.1 + Math.random() * 0.9);

        // Random liquidity on each exchange
        const liquidity = exchangeVolume * (1 + Math.random());

        exchangeData[exchange] = {
          price: exchangePrice,
          volume24h: exchangeVolume,
          liquidity,
        };
      }

      assets[symbol] = {
        symbol,
        price,
        priceChange24h: priceChangePercent,
        volume24h: volume,
        volatility,
        exchanges: exchangeData,
      };
    }

    return {
      timestamp,
      assets,
      globalMetrics: {
        volatilityIndex,
        sentimentScore,
        trendStrength,
      },
    };
  }

  /**
   * Generate mock historical data for a specific period
   */
  private generateMockHistoricalData(
    startTime: number,
    endTime: number,
    interval: "hour" | "day" | "week" = "day"
  ): HistoricalMarketData[] {
    const now = Date.now();
    const results: HistoricalMarketData[] = [];

    // Ensure valid time range
    const validEndTime = endTime > now ? now : endTime;

    // Calculate interval in milliseconds
    let intervalMs: number;
    switch (interval) {
      case "hour":
        intervalMs = 60 * 60 * 1000;
        break;
      case "day":
        intervalMs = 24 * 60 * 60 * 1000;
        break;
      case "week":
        intervalMs = 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        intervalMs = 24 * 60 * 60 * 1000;
    }

    // Generate data points
    for (
      let timestamp = startTime;
      timestamp <= validEndTime;
      timestamp += intervalMs
    ) {
      const mockData = this.generateMockMarketData() as HistoricalMarketData;
      mockData.timestamp = timestamp;

      // Add candle data
      mockData.candles = {};

      for (const symbol of this.SUPPORTED_ASSETS) {
        const asset = mockData.assets[symbol];
        const basePrice = asset.price;

        // Generate a candle
        const open = basePrice * (1 - 0.01 + Math.random() * 0.02);
        const close = basePrice;
        const high = Math.max(open, close) * (1 + Math.random() * 0.01);
        const low = Math.min(open, close) * (1 - Math.random() * 0.01);

        mockData.candles[symbol] = [
          {
            timestamp,
            open,
            high,
            low,
            close,
            volume: asset.volume24h,
          },
        ];
      }

      results.push(mockData);
    }

    return results;
  }

  /**
   * Get a realistic base price for each asset
   */
  private getBasePrice(symbol: string): number {
    // Realistic prices as of early 2023
    switch (symbol) {
      case "BTC":
        return 60000 + Math.random() * 5000;
      case "ETH":
        return 3500 + Math.random() * 500;
      case "LINK":
        return 15 + Math.random() * 5;
      case "UNI":
        return 5 + Math.random() * 2;
      case "AAVE":
        return 80 + Math.random() * 20;
      case "SOL":
        return 100 + Math.random() * 30;
      case "DOT":
        return 20 + Math.random() * 5;
      case "USDC":
        return 1 + Math.random() * 0.01; // Small variations around $1
      case "USDT":
        return 1 + Math.random() * 0.01; // Small variations around $1
      default:
        return 10 + Math.random() * 10; // Default for unknown tokens
    }
  }
}
