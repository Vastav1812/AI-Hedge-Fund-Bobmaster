declare module "coinmarketcap-api" {
  class CoinMarketCap {
    constructor(apiKey: string);

    getQuotes(options: { symbol: string }): Promise<{
      data: Record<
        string,
        {
          id: number;
          name: string;
          symbol: string;
          slug: string;
          quote: {
            USD: {
              price: number;
              volume_24h: number;
              percent_change_24h: number;
              market_cap: number;
            };
          };
        }
      >;
    }>;

    getGlobal(): Promise<{
      data: {
        active_cryptocurrencies: number;
        total_market_cap: number;
        total_volume_24h: number;
        btc_dominance: number;
        eth_dominance: number;
        volatility_24h: number;
      };
    }>;
  }

  export default CoinMarketCap;
}
