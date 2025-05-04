# AI DeFi Hedge Fund Platform

An autonomous decision-making AI agent for a no-code DeFi hedge fund platform. The platform enables users to select risk profiles and trading strategies, dynamically adapting to market conditions and user preferences.

## Features

- **Autonomous Strategy Selection & Execution**: Evaluates market data and selects strategies based on user risk tolerance
- **Risk Profile Customization**: Adjusts leverage, position sizes, and stop-loss parameters
- **Strategy Diversity & Adaptation**: Supports momentum trading, arbitrage, and copy-trading strategies
- **Real-Time Performance Tracking**: Tracks bot performance transparently

## Technologies

- TypeScript
- Sequence Wallet SDK
- OpenAI API
- Ethereum/EVM Blockchain
- DeFi Protocols (Uniswap, etc.)

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Sequence wallet credentials
- OpenAI API key

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/ai-hedge-fund.git
cd ai-hedge-fund
```

2. Install dependencies
```
npm install
```

3. Copy the environment variables file and update with your credentials
```
cp .env.example .env
```

4. Build the project
```
npm run build
```

5. Start the application
```
npm start
```

## Project Structure

- `src/models/` - Core data models and interfaces
- `src/strategies/` - Trading strategy implementations
- `src/services/` - Service integrations (wallet, market data, AI)
- `src/utils/` - Utility functions
- `src/agent/` - AI agent implementation

## License

MIT 

# AI Hedge Fund - Real-time Market Data Features

This document describes the implementation of advanced real-time market data features to enhance the AI Hedge Fund platform.

## Features Implemented

### 1. WebSocket Integration for Real-time Price Updates

We've implemented a WebSocket service that connects to cryptocurrency exchanges to receive real-time market data:

- **Supported Exchanges**: Binance, Coinbase, and Kraken
- **Data Types**: Ticker updates (price/volume), Trade executions, Order book updates
- **Resilient Connections**: Automatic reconnection with exponential backoff
- **Event-based Architecture**: Uses EventEmitter pattern for real-time data handling

### 2. Historical Data Retrieval

Enhanced historical data handling with:

- **CandleStick Data**: OHLCV (Open, High, Low, Close, Volume) data
- **Multiple Timeframes**: Support for hourly, daily, and weekly data
- **Caching System**: Local storage of historical data to reduce API calls
- **Fallback Mechanisms**: Graceful degradation to mock data when API limits are reached

### 3. Order Book Data

Implemented depth-of-market information for better trade execution:

- **Real Order Books**: Access to bid/ask orders for any trading pair
- **Liquidity Analysis**: Calculate available liquidity at different price levels
- **Spread Calculations**: Analyze bid-ask spreads across exchanges
- **Slippage Estimation**: Model the price impact of large orders

## Architecture

The implementation follows a service-oriented architecture:

- `WebSocketService`: Manages real-time connections to exchanges
- `CoinMarketCapService`: Enhanced with order book and historical data features
- `IMarketDataService`: Updated interface to include new data types
- New data models in `types.ts` for WebSocket messages, order books, and candle data

## Usage Examples

### WebSocket Real-Time Data

```typescript
const wsService = new WebSocketService();

// Subscribe to real-time ticker updates
wsService.subscribeToMarketData('BTCUSDT', 'binance', ['ticker']);

// Listen for price updates
wsService.on('ticker', (ticker) => {
  console.log(`${ticker.symbol}: $${ticker.price}`);
});

// Listen for trades
wsService.on('trade', (trade) => {
  console.log(`${trade.symbol}: ${trade.side} ${trade.quantity} @ $${trade.price}`);
});
```

### Historical Data

```typescript
const marketDataService = new CoinMarketCapService();

// Get daily data for the last 7 days
const endTime = Date.now();
const startTime = endTime - (7 * 24 * 60 * 60 * 1000);
const historicalData = await marketDataService.getHistoricalMarketData(
  startTime, 
  endTime, 
  'day'
);

// Access OHLCV data
const btcCandles = historicalData[0].candles?.['BTC'] || [];
```

### Order Book Data

```typescript
const marketDataService = new CoinMarketCapService();

// Get order book for BTC on Binance
const orderBook = await marketDataService.getOrderBook('BTC', 'Binance');

// Calculate available liquidity within 1% of mid price
const midPrice = (orderBook.asks[0].price + orderBook.bids[0].price) / 2;
const bidLiquidity = orderBook.bids
  .filter(bid => bid.price >= midPrice * 0.99)
  .reduce((sum, bid) => sum + bid.price * bid.quantity, 0);
```

## Testing

The implementation includes comprehensive test scripts:

- `npm run test:market`: Run all market data tests
- `npm run test:history`: Test historical data retrieval
- `npm run test:orderbook`: Test order book functionality
- `npm run test:websocket`: Test WebSocket real-time updates

## Future Enhancements

1. **Multiple Exchange Integration**: Add support for more cryptocurrency exchanges
2. **Cross-Exchange Aggregation**: Combine order books across exchanges for better liquidity
3. **Trading Signals**: Generate automated signals based on real-time data
4. **Machine Learning Models**: Train models on historical and real-time data
5. **Custom Streaming APIs**: Develop custom data streams for specific trading strategies 