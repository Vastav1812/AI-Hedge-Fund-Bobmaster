// Risk profile types
export enum RiskProfileType {
  Aggressive = 'aggressive',
  Balanced = 'balanced',
  LowRisk = 'low-risk'
}

// User-defined risk profile
export interface RiskProfile {
  type: 'aggressive' | 'balanced' | 'low-risk';
  maxDrawdown: number;
  leverage: number;
  positionSizeFactor: number;
  maxExposurePerAsset: number;
  stopLossPercentage: number;
  takeProfitPercentage: number;
}

// Strategy types
export enum StrategyType {
  Momentum = 'momentum',
  Arbitrage = 'arbitrage',
  CopyTrading = 'copy-trading'
}

export interface Strategy {
  type: StrategyType;
  name: string;
  description: string;
  riskProfileSupport: RiskProfileType[];
  execute: (marketData: MarketData, allocation: number, riskProfile: RiskProfile) => Promise<TradeResult>;
  evaluate: (marketData: MarketData) => Promise<StrategyScore>;
}

// Market data types
export interface MarketData {
  timestamp: number;
  assets: Record<string, AssetData>;
  globalMetrics: {
    volatilityIndex: number;
    sentimentScore: number;
    trendStrength: number;
  };
}

// Individual asset data
export interface AssetData {
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  volatility: number;
  exchanges: Record<string, ExchangeData>;
}

// Exchange-specific data for an asset
export interface ExchangeData {
  price: number;
  volume24h: number;
  liquidity: number;
}

// Trade and performance types
export interface TradeResult {
  timestamp: number;
  strategy: string;
  asset: string;
  tradeType: 'buy' | 'sell';
  amount: number;
  price: number;
  fee: number;
  success: boolean;
  error?: string;
}

export interface StrategyScore {
  score: number; // 0-100 ranking
  confidence: number; // 0-1 confidence level
  reasoning: string;
}

// Portfolio allocation across strategies
export type PortfolioAllocation = Record<string, number>;

// User settings
export interface UserSettings {
  riskProfile: RiskProfile;
  preferredStrategies: StrategyType[];
  maxFeePercentage: number;
  rebalancingFrequency: 'hourly' | 'daily' | 'weekly';
  notificationPreferences: {
    email: boolean;
    push: boolean;
    tradingUpdates: boolean;
    performanceReports: boolean;
  };
}

// Performance metrics for tracking portfolio performance
export interface PerformanceMetrics {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  dailyReturns: Record<string, number>;
}

// Token balance
export interface TokenBalance {
  symbol: string;
  amount: number;
  usdValue: number;
}

// Wallet information
export interface WalletInfo {
  address: string;
  balances: Record<string, TokenBalance>;
}

// Agent status information
export interface AgentStatus {
  id: string;
  isRunning: boolean;
  lastRunTimestamp: number;
  riskProfile: RiskProfile;
  currentAllocation: PortfolioAllocation;
  performanceMetrics: PerformanceMetrics;
  marketAnalysis: any;
  walletInfo: WalletInfo;
  recentDecisions: any[];
}

// Transaction information
export interface Transaction {
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  value: number;
  asset: string;
  status: 'pending' | 'completed' | 'failed';
  blockNumber?: number;
}

// Order Book Types
export interface OrderBookEntry {
  price: number;
  quantity: number;
}

export interface OrderBook {
  symbol: string;
  timestamp: number;
  bids: OrderBookEntry[];  // Price ordered from highest to lowest
  asks: OrderBookEntry[];  // Price ordered from lowest to highest
  exchange: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'ticker' | 'trade' | 'orderbook' | 'candle' | 'error';
  exchange: string;
  symbol: string;
  data: any;
  timestamp: number;
}

export interface TickerUpdate {
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  exchange: string;
  timestamp: number;
}

export interface TradeUpdate {
  symbol: string;
  price: number;
  quantity: number;
  side: 'buy' | 'sell';
  exchange: string;
  timestamp: number;
}

export interface OrderBookUpdate {
  symbol: string;
  exchange: string;
  timestamp: number;
  bids?: OrderBookEntry[];
  asks?: OrderBookEntry[];
  isSnapshot: boolean;
}

// Historical Data Types
export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalMarketData extends MarketData {
  candles?: Record<string, CandleData[]>;
} 