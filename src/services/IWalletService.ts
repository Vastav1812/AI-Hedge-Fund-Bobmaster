import { WalletInfo, Transaction } from "../models/types";

/**
 * Interface for blockchain wallet services
 */
export interface IWalletService {
  /**
   * Initialize the wallet service
   */
  initialize(privateKey?: string): Promise<boolean>;

  /**
   * Get wallet information and balances
   */
  getWalletInfo(): Promise<WalletInfo>;

  /**
   * Execute a trade (buy/sell)
   */
  executeTrade(
    tokenAddress: string,
    amount: number,
    isBuy: boolean
  ): Promise<Transaction | null>;

  /**
   * Get transaction history
   */
  getTransactionHistory(limit?: number): Promise<Transaction[]>;
}
