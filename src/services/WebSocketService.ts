import WebSocket from 'ws';
import { WebSocketMessage, TickerUpdate, TradeUpdate, OrderBookUpdate } from '../models/types';
import EventEmitter from 'events';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Service to manage WebSocket connections to cryptocurrency exchanges
 */
export class WebSocketService extends EventEmitter {
  private connections: Map<string, WebSocket> = new Map();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private subscriptions: Map<string, string[]> = new Map();
  private isReady: boolean = false;
  
  // Supported exchanges and their WebSocket endpoints
  private readonly EXCHANGE_WS_ENDPOINTS: Record<string, string> = {
    'binance': 'wss://stream.binance.com:9443/ws',
    'coinbase': 'wss://ws-feed.exchange.coinbase.com',
    'kraken': 'wss://ws.kraken.com'
  };
  
  // Maximum reconnection attempts
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  
  constructor() {
    super();
    this.initialize();
  }
  
  /**
   * Initialize the WebSocket service
   */
  private initialize(): void {
    try {
      this.isReady = true;
      console.log('WebSocket service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WebSocket service:', error);
      this.isReady = false;
    }
  }
  
  /**
   * Subscribe to market data for a specific symbol and exchange
   */
  public async subscribeToMarketData(
    symbol: string, 
    exchange: string,
    channels: ('ticker' | 'trade' | 'orderbook')[] = ['ticker']
  ): Promise<boolean> {
    try {
      if (!this.isReady) {
        throw new Error('WebSocket service not initialized');
      }
      
      // Check if exchange is supported
      if (!this.EXCHANGE_WS_ENDPOINTS[exchange.toLowerCase()]) {
        throw new Error(`Exchange ${exchange} is not supported`);
      }
      
      const exchangeKey = exchange.toLowerCase();
      const connectionId = `${exchangeKey}`;
      
      // Create a new connection if one doesn't exist
      if (!this.connections.has(connectionId)) {
        await this.createConnection(connectionId, exchangeKey);
      }
      
      // Add to subscriptions
      const subscriptionId = `${exchangeKey}:${symbol}`;
      if (!this.subscriptions.has(subscriptionId)) {
        this.subscriptions.set(subscriptionId, []);
      }
      
      // Update channels for this subscription
      const existingChannels = this.subscriptions.get(subscriptionId) || [];
      channels.forEach(channel => {
        if (!existingChannels.includes(channel)) {
          existingChannels.push(channel);
        }
      });
      this.subscriptions.set(subscriptionId, existingChannels);
      
      // Send subscription message based on exchange
      const ws = this.connections.get(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        this.sendSubscriptionMessage(ws, symbol, exchangeKey, channels);
        console.log(`Subscribed to ${symbol} on ${exchange} for channels: ${channels.join(', ')}`);
        return true;
      } else {
        console.warn(`WebSocket for ${exchange} not ready, subscription will be sent when connected`);
        return false;
      }
    } catch (error) {
      console.error(`Error subscribing to ${symbol} on ${exchange}:`, error);
      return false;
    }
  }
  
  /**
   * Unsubscribe from market data for a specific symbol and exchange
   */
  public unsubscribeFromMarketData(
    symbol: string, 
    exchange: string,
    channels?: ('ticker' | 'trade' | 'orderbook')[]
  ): boolean {
    try {
      const exchangeKey = exchange.toLowerCase();
      const connectionId = `${exchangeKey}`;
      const subscriptionId = `${exchangeKey}:${symbol}`;
      
      // Check if we have this subscription
      if (!this.subscriptions.has(subscriptionId)) {
        return true;  // Nothing to unsubscribe from
      }
      
      // If channels specified, remove only those channels
      if (channels && channels.length > 0) {
        const existingChannels = this.subscriptions.get(subscriptionId) || [];
        const updatedChannels = existingChannels.filter(ch => {
          // Ensure type safety by validating channel type
          return !channels.includes(ch as 'ticker' | 'trade' | 'orderbook');
        });
        
        if (updatedChannels.length > 0) {
          this.subscriptions.set(subscriptionId, updatedChannels);
        } else {
          this.subscriptions.delete(subscriptionId);
        }
      } else {
        // Remove all channels for this symbol
        this.subscriptions.delete(subscriptionId);
      }
      
      // Send unsubscribe message if connection exists
      const ws = this.connections.get(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        this.sendUnsubscriptionMessage(ws, symbol, exchangeKey, channels);
        console.log(`Unsubscribed from ${symbol} on ${exchange}${channels ? ` for channels: ${channels.join(', ')}` : ''}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error unsubscribing from ${symbol} on ${exchange}:`, error);
      return false;
    }
  }
  
  /**
   * Create a WebSocket connection to an exchange
   */
  private async createConnection(connectionId: string, exchange: string): Promise<void> {
    try {
      const endpoint = this.EXCHANGE_WS_ENDPOINTS[exchange];
      
      console.log(`Creating WebSocket connection to ${exchange} at ${endpoint}`);
      
      const ws = new WebSocket(endpoint);
      
      ws.on('open', () => {
        console.log(`WebSocket connection to ${exchange} established`);
        this.connections.set(connectionId, ws);
        this.reconnectAttempts.set(connectionId, 0);
        
        // Setup heartbeat for this connection
        this.setupHeartbeat(connectionId, exchange);
        
        // Send subscriptions for this exchange
        this.sendPendingSubscriptions(ws, exchange);
      });
      
      ws.on('message', (data: WebSocket.Data) => {
        try {
          this.handleMessage(data, exchange);
        } catch (error) {
          console.error(`Error handling WebSocket message from ${exchange}:`, error);
        }
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${exchange}:`, error);
      });
      
      ws.on('close', (code, reason) => {
        console.log(`WebSocket connection to ${exchange} closed: ${code} - ${reason}`);
        
        // Clear heartbeat interval
        const interval = this.heartbeatIntervals.get(connectionId);
        if (interval) {
          clearInterval(interval);
          this.heartbeatIntervals.delete(connectionId);
        }
        
        // Attempt to reconnect
        this.attemptReconnect(connectionId, exchange);
      });
    } catch (error) {
      console.error(`Error creating WebSocket connection to ${exchange}:`, error);
      throw error;
    }
  }
  
  /**
   * Attempt to reconnect to an exchange
   */
  private attemptReconnect(connectionId: string, exchange: string): void {
    const attempts = this.reconnectAttempts.get(connectionId) || 0;
    
    if (attempts < this.MAX_RECONNECT_ATTEMPTS) {
      const backoff = Math.pow(2, attempts) * 1000;
      console.log(`Attempting to reconnect to ${exchange} in ${backoff}ms (attempt ${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
      
      this.reconnectAttempts.set(connectionId, attempts + 1);
      
      setTimeout(() => {
        this.createConnection(connectionId, exchange).catch(error => {
          console.error(`Failed to reconnect to ${exchange}:`, error);
        });
      }, backoff);
    } else {
      console.error(`Maximum reconnection attempts reached for ${exchange}`);
      this.emit('connection_failed', exchange);
    }
  }
  
  /**
   * Set up a heartbeat to keep the connection alive
   */
  private setupHeartbeat(connectionId: string, exchange: string): void {
    // Clear any existing heartbeat
    const existingInterval = this.heartbeatIntervals.get(connectionId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    
    // Set up a new heartbeat based on the exchange
    let interval: NodeJS.Timeout;
    
    switch (exchange) {
      case 'binance':
        interval = setInterval(() => {
          const ws = this.connections.get(connectionId);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ method: 'ping' }));
          }
        }, 30000);
        break;
        
      case 'coinbase':
        interval = setInterval(() => {
          const ws = this.connections.get(connectionId);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
          }
        }, 30000);
        break;
        
      case 'kraken':
        interval = setInterval(() => {
          const ws = this.connections.get(connectionId);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ping: Date.now() }));
          }
        }, 30000);
        break;
        
      default:
        interval = setInterval(() => {
          // Generic ping, may not work for all exchanges
          const ws = this.connections.get(connectionId);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          }
        }, 30000);
    }
    
    this.heartbeatIntervals.set(connectionId, interval);
  }
  
  /**
   * Send pending subscriptions for an exchange
   */
  private sendPendingSubscriptions(ws: WebSocket, exchange: string): void {
    // Find all subscriptions for this exchange
    const subscriptions = Array.from(this.subscriptions.entries())
      .filter(([key]) => key.startsWith(`${exchange}:`))
      .map(([key, channels]) => ({
        symbol: key.split(':')[1],
        channels
      }));
    
    // Send subscription messages
    subscriptions.forEach(sub => {
      this.sendSubscriptionMessage(ws, sub.symbol, exchange, sub.channels);
    });
  }
  
  /**
   * Send a subscription message based on the exchange
   */
  private sendSubscriptionMessage(
    ws: WebSocket, 
    symbol: string, 
    exchange: string, 
    channels: string[]
  ): void {
    try {
      let message: any;
      
      switch (exchange) {
        case 'binance':
          channels.forEach(channel => {
            let streamName: string;
            switch (channel) {
              case 'ticker':
                streamName = `${symbol.toLowerCase()}@ticker`;
                break;
              case 'trade':
                streamName = `${symbol.toLowerCase()}@trade`;
                break;
              case 'orderbook':
                streamName = `${symbol.toLowerCase()}@depth`;
                break;
              default:
                streamName = `${symbol.toLowerCase()}@ticker`;
            }
            
            message = {
              method: 'SUBSCRIBE',
              params: [streamName],
              id: Date.now()
            };
            ws.send(JSON.stringify(message));
          });
          break;
          
        case 'coinbase':
          message = {
            type: 'subscribe',
            product_ids: [symbol],
            channels: channels.map(channel => {
              switch (channel) {
                case 'ticker': return 'ticker';
                case 'trade': return 'matches';
                case 'orderbook': return 'level2';
                default: return 'ticker';
              }
            })
          };
          ws.send(JSON.stringify(message));
          break;
          
        case 'kraken':
          message = {
            name: 'subscribe',
            reqid: Date.now(),
            pair: [symbol],
            subscription: {
              name: channels.map(channel => {
                switch (channel) {
                  case 'ticker': return 'ticker';
                  case 'trade': return 'trade';
                  case 'orderbook': return 'book';
                  default: return 'ticker';
                }
              })[0]
            }
          };
          ws.send(JSON.stringify(message));
          break;
          
        default:
          console.warn(`Subscription format for ${exchange} not implemented`);
      }
    } catch (error) {
      console.error(`Error sending subscription message to ${exchange}:`, error);
    }
  }
  
  /**
   * Send an unsubscription message based on the exchange
   */
  private sendUnsubscriptionMessage(
    ws: WebSocket, 
    symbol: string, 
    exchange: string, 
    channels?: string[]
  ): void {
    try {
      let message: any;
      
      switch (exchange) {
        case 'binance':
          (channels || ['ticker', 'trade', 'orderbook']).forEach(channel => {
            let streamName: string;
            switch (channel) {
              case 'ticker':
                streamName = `${symbol.toLowerCase()}@ticker`;
                break;
              case 'trade':
                streamName = `${symbol.toLowerCase()}@trade`;
                break;
              case 'orderbook':
                streamName = `${symbol.toLowerCase()}@depth`;
                break;
              default:
                streamName = `${symbol.toLowerCase()}@ticker`;
            }
            
            message = {
              method: 'UNSUBSCRIBE',
              params: [streamName],
              id: Date.now()
            };
            ws.send(JSON.stringify(message));
          });
          break;
          
        case 'coinbase':
          message = {
            type: 'unsubscribe',
            product_ids: [symbol],
            channels: (channels || ['ticker', 'trade', 'orderbook']).map(channel => {
              switch (channel) {
                case 'ticker': return 'ticker';
                case 'trade': return 'matches';
                case 'orderbook': return 'level2';
                default: return 'ticker';
              }
            })
          };
          ws.send(JSON.stringify(message));
          break;
          
        case 'kraken':
          message = {
            name: 'unsubscribe',
            reqid: Date.now(),
            pair: [symbol],
            subscription: {
              name: (channels || ['ticker', 'trade', 'orderbook']).map(channel => {
                switch (channel) {
                  case 'ticker': return 'ticker';
                  case 'trade': return 'trade';
                  case 'orderbook': return 'book';
                  default: return 'ticker';
                }
              })[0]
            }
          };
          ws.send(JSON.stringify(message));
          break;
          
        default:
          console.warn(`Unsubscription format for ${exchange} not implemented`);
      }
    } catch (error) {
      console.error(`Error sending unsubscription message to ${exchange}:`, error);
    }
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data, exchange: string): void {
    if (!data) return;
    
    const message = data.toString();
    
    // Parse message based on exchange format
    switch (exchange) {
      case 'binance':
        this.handleBinanceMessage(message);
        break;
        
      case 'coinbase':
        this.handleCoinbaseMessage(message);
        break;
        
      case 'kraken':
        this.handleKrakenMessage(message);
        break;
        
      default:
        console.warn(`Message handling for ${exchange} not implemented`);
    }
  }
  
  /**
   * Handle Binance WebSocket messages
   */
  private handleBinanceMessage(message: string): void {
    try {
      const data = JSON.parse(message);
      
      // Handle pong response
      if (data.result === null) {
        return;
      }
      
      // Handle ticker updates
      if (data.e === '24hrTicker') {
        const ticker: TickerUpdate = {
          symbol: data.s,
          price: parseFloat(data.c),
          priceChange24h: parseFloat(data.P),
          volume24h: parseFloat(data.v) * parseFloat(data.c), // Convert to quote currency volume
          exchange: 'binance',
          timestamp: data.E
        };
        
        this.emit('ticker', ticker);
        return;
      }
      
      // Handle trade updates
      if (data.e === 'trade') {
        const trade: TradeUpdate = {
          symbol: data.s,
          price: parseFloat(data.p),
          quantity: parseFloat(data.q),
          side: data.m ? 'sell' : 'buy', // m is true when the buyer is the market maker
          exchange: 'binance',
          timestamp: data.T
        };
        
        this.emit('trade', trade);
        return;
      }
      
      // Handle orderbook updates
      if (data.e === 'depthUpdate') {
        const orderbook: OrderBookUpdate = {
          symbol: data.s,
          exchange: 'binance',
          timestamp: data.E,
          bids: data.b?.map((bid: string[]) => ({ price: parseFloat(bid[0]), quantity: parseFloat(bid[1]) })),
          asks: data.a?.map((ask: string[]) => ({ price: parseFloat(ask[0]), quantity: parseFloat(ask[1]) })),
          isSnapshot: false
        };
        
        this.emit('orderbook', orderbook);
        return;
      }
    } catch (error) {
      console.error('Error handling Binance message:', error, message);
    }
  }
  
  /**
   * Handle Coinbase WebSocket messages
   */
  private handleCoinbaseMessage(message: string): void {
    try {
      const data = JSON.parse(message);
      
      // Handle heartbeat or subscription confirmation
      if (data.type === 'heartbeat' || data.type === 'subscriptions') {
        return;
      }
      
      // Handle ticker updates
      if (data.type === 'ticker') {
        const ticker: TickerUpdate = {
          symbol: data.product_id,
          price: parseFloat(data.price),
          priceChange24h: parseFloat(data.price_change_24h || '0'),
          volume24h: parseFloat(data.volume_24h || '0'),
          exchange: 'coinbase',
          timestamp: new Date(data.time).getTime()
        };
        
        this.emit('ticker', ticker);
        return;
      }
      
      // Handle trade updates
      if (data.type === 'match' || data.type === 'last_match') {
        const trade: TradeUpdate = {
          symbol: data.product_id,
          price: parseFloat(data.price),
          quantity: parseFloat(data.size),
          side: data.side === 'sell' ? 'sell' : 'buy',
          exchange: 'coinbase',
          timestamp: new Date(data.time).getTime()
        };
        
        this.emit('trade', trade);
        return;
      }
      
      // Handle orderbook updates
      if (data.type === 'snapshot') {
        const orderbook: OrderBookUpdate = {
          symbol: data.product_id,
          exchange: 'coinbase',
          timestamp: Date.now(),
          bids: data.bids?.map((bid: string[]) => ({ price: parseFloat(bid[0]), quantity: parseFloat(bid[1]) })),
          asks: data.asks?.map((ask: string[]) => ({ price: parseFloat(ask[0]), quantity: parseFloat(ask[1]) })),
          isSnapshot: true
        };
        
        this.emit('orderbook', orderbook);
        return;
      }
      
      if (data.type === 'l2update') {
        const orderbook: OrderBookUpdate = {
          symbol: data.product_id,
          exchange: 'coinbase',
          timestamp: new Date(data.time).getTime(),
          bids: data.changes
            .filter((change: string[]) => change[0] === 'buy')
            .map((change: string[]) => ({ price: parseFloat(change[1]), quantity: parseFloat(change[2]) })),
          asks: data.changes
            .filter((change: string[]) => change[0] === 'sell')
            .map((change: string[]) => ({ price: parseFloat(change[1]), quantity: parseFloat(change[2]) })),
          isSnapshot: false
        };
        
        this.emit('orderbook', orderbook);
        return;
      }
    } catch (error) {
      console.error('Error handling Coinbase message:', error, message);
    }
  }
  
  /**
   * Handle Kraken WebSocket messages
   */
  private handleKrakenMessage(message: string): void {
    try {
      const data = JSON.parse(message);
      
      // Handle heartbeat
      if (Array.isArray(data) && data[1] === 'heartbeat') {
        return;
      }
      
      // Handle ticker updates
      if (Array.isArray(data) && data[2] === 'ticker') {
        const tickerData = data[1];
        const symbol = data[3];
        
        const ticker: TickerUpdate = {
          symbol,
          price: parseFloat(tickerData.c[0]),
          priceChange24h: 0, // Kraken doesn't provide this directly
          volume24h: parseFloat(tickerData.v[1]),
          exchange: 'kraken',
          timestamp: Date.now()
        };
        
        this.emit('ticker', ticker);
        return;
      }
      
      // Handle trade updates
      if (Array.isArray(data) && data[2] === 'trade') {
        const trades = data[1];
        const symbol = data[3];
        
        trades.forEach((trade: string[]) => {
          const tradeUpdate: TradeUpdate = {
            symbol,
            price: parseFloat(trade[0]),
            quantity: parseFloat(trade[1]),
            side: trade[3] === 's' ? 'sell' : 'buy',
            exchange: 'kraken',
            timestamp: Math.floor(parseFloat(trade[2]) * 1000)
          };
          
          this.emit('trade', tradeUpdate);
        });
        return;
      }
      
      // Handle orderbook updates
      if (Array.isArray(data) && (data[2] === 'book-10' || data[2] === 'book-25' || data[2] === 'book-100' || data[2] === 'book-500' || data[2] === 'book-1000')) {
        const symbol = data[3];
        const bookData = data[1];
        
        // Check if it's a snapshot
        const isSnapshot = bookData.as !== undefined || bookData.bs !== undefined;
        
        const orderbook: OrderBookUpdate = {
          symbol,
          exchange: 'kraken',
          timestamp: Date.now(),
          bids: [],
          asks: [],
          isSnapshot
        };
        
        // Process asks
        if (bookData.as) {
          orderbook.asks = bookData.as.map((ask: string[]) => ({ 
            price: parseFloat(ask[0]), 
            quantity: parseFloat(ask[1]) 
          }));
        } else if (bookData.a) {
          orderbook.asks = bookData.a.map((ask: string[]) => ({ 
            price: parseFloat(ask[0]), 
            quantity: parseFloat(ask[1]) 
          }));
        }
        
        // Process bids
        if (bookData.bs) {
          orderbook.bids = bookData.bs.map((bid: string[]) => ({ 
            price: parseFloat(bid[0]), 
            quantity: parseFloat(bid[1]) 
          }));
        } else if (bookData.b) {
          orderbook.bids = bookData.b.map((bid: string[]) => ({ 
            price: parseFloat(bid[0]), 
            quantity: parseFloat(bid[1]) 
          }));
        }
        
        this.emit('orderbook', orderbook);
        return;
      }
    } catch (error) {
      console.error('Error handling Kraken message:', error, message);
    }
  }
  
  /**
   * Close all WebSocket connections
   */
  public closeAll(): void {
    // Clear all heartbeat intervals
    for (const [connectionId, interval] of this.heartbeatIntervals.entries()) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(connectionId);
    }
    
    // Close all connections
    for (const [connectionId, ws] of this.connections.entries()) {
      try {
        ws.close();
        this.connections.delete(connectionId);
      } catch (error) {
        console.error(`Error closing WebSocket connection ${connectionId}:`, error);
      }
    }
    
    // Clear subscriptions
    this.subscriptions.clear();
    
    console.log('All WebSocket connections closed');
  }
} 