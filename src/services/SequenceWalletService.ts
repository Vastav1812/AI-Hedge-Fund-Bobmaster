import { ethers } from "ethers";
import { Session } from "@0xsequence/auth";
import { findSupportedNetwork } from "@0xsequence/network";
import { WalletInfo, Transaction, TokenBalance } from "../models/types";
import { IWalletService } from "./IWalletService";
import dotenv from "dotenv";

dotenv.config();

/**
 * Sequence Wallet Service for the AI Hedge Fund Agent
 * This service allows the agent to interact with blockchain using Sequence wallet
 */
export class SequenceWalletService implements IWalletService {
  private provider: ethers.JsonRpcProvider | null = null;
  private smartAccount: any = null;
  private signer: ethers.Signer | null = null;
  private chainId: number;
  private initialized: boolean = false;
  private readonly SEQUENCE_RPC_URL: string;
  private readonly PROJECT_ACCESS_KEY: string;
  private readonly PRIVATE_KEY: string;

  private mode: boolean;

  constructor() {
    this.SEQUENCE_RPC_URL = process.env.SEQUENCE_RPC_URL || "";
    this.PROJECT_ACCESS_KEY = process.env.PROJECT_ACCESS_KEY || "";
    this.PRIVATE_KEY = process.env.EVM_PRIVATE_KEY || "";
    this.chainId = Number(process.env.CHAIN_ID || "1");
    this.mode = process.env.MOCK_WALLET === "true" || !this.SEQUENCE_RPC_URL;

    if (this.mode) {
      console.log("Sequence Wallet Service initialized in MOCK mode");
    }
  }

  /**
   * Initialize the wallet service
   */
  public async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    if (this.mode) {
      this.initialized = true;
      return true;
    }

    try {
      // Get chain configuration
      const chainConfig = findSupportedNetwork(this.chainId.toString());
      if (!chainConfig) {
        throw new Error(`Chain config not found for chain ID: ${this.chainId}`);
      }

      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(
        this.SEQUENCE_RPC_URL,
        this.chainId
      );

      // Create wallet
      const walletEOA = new ethers.Wallet(this.PRIVATE_KEY, this.provider);

      // Initialize smart account
      this.smartAccount = await Session.singleSigner({
        signer: walletEOA,
        projectAccessKey: this.PROJECT_ACCESS_KEY,
      });

      // Get the signer
      this.signer = this.smartAccount.account.getSigner(this.chainId);

      this.initialized = true;
      console.log("Sequence Wallet Service initialized successfully");
      return true;
    } catch (error) {
      console.error("Error initializing Sequence wallet service:", error);
      console.log("Falling back to MOCK mode");
      this.mode = true;
      this.initialized = true;
      return true;
    }
  }

  /**
   * Get wallet information
   */
  public async getWalletInfo(): Promise<WalletInfo> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.mode) {
      return this.getMockWalletInfo();
    }

    try {
      // In a real implementation, we would query token balances
      // from the blockchain using the wallet address
      const address = (await this.signer?.getAddress()) || "unknown";
      const nativeBalance =
        (await this.provider?.getBalance(address)) || ethers.parseEther("0");

      // Convert to WalletInfo format
      const balances: Record<string, TokenBalance> = {
        ETH: {
          symbol: "ETH",
          amount: parseFloat(ethers.formatEther(nativeBalance)),
          usdValue: 0, // Would be calculated using price feeds
        },
      };

      // Add token balances (would be implemented based on tracked tokens)
      // await this.addTokenBalances(address, balances);

      return {
        address,
        balances,
      };
    } catch (error) {
      console.error("Error getting wallet info:", error);
      return this.getMockWalletInfo();
    }
  }

  /**
   * Execute a transaction on the blockchain
   */
  public async sendTransaction(
    to: string,
    value: string,
    data: string = "0x"
  ): Promise<Transaction | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.mode) {
      return this.getMockTransaction();
    }

    try {
      if (!this.signer) {
        throw new Error("Signer not initialized");
      }

      // Send the transaction
      const tx = await this.signer.sendTransaction({ to, value, data });

      // Wait for the transaction to be mined
      const receipt = await tx.wait();

      if (receipt && receipt.status === 0) {
        throw new Error("Transaction failed");
      }

      // Return transaction information
      return {
        hash: receipt ? receipt.hash : tx.hash,
        timestamp: Date.now(),
        from: await this.signer.getAddress(),
        to,
        value: parseFloat(ethers.formatEther(value)),
        asset: "ETH",
        status: "completed",
        blockNumber: receipt ? receipt.blockNumber : 0,
      };
    } catch (error) {
      console.error("Error sending transaction:", error);
      return null;
    }
  }

  /**
   * Execute a batch of transactions
   */
  public async sendTransactionBatch(
    transactions: { to: string; value: string; data: string }[]
  ): Promise<Transaction | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.mode) {
      return this.getMockTransaction();
    }

    try {
      if (!this.signer) {
        throw new Error("Signer not initialized");
      }

      // In ethers v6, we can't directly send transaction batch
      // We'll send the first transaction as an example
      // In a real implementation, we would use Sequence's batch transaction capability
      const firstTx = transactions[0];
      const tx = await this.signer.sendTransaction({
        to: firstTx.to,
        value: firstTx.value,
        data: firstTx.data,
      });

      // Wait for the transaction to be mined
      const receipt = await tx.wait();

      if (receipt && receipt.status === 0) {
        throw new Error("Transaction batch failed");
      }

      // Return transaction information
      return {
        hash: receipt ? receipt.hash : tx.hash,
        timestamp: Date.now(),
        from: await this.signer.getAddress(),
        to: "BATCH",
        value: 0, // Combined value would need calculation
        asset: "BATCH",
        status: "completed",
        blockNumber: receipt ? receipt.blockNumber : 0,
      };
    } catch (error) {
      console.error("Error sending transaction batch:", error);
      return null;
    }
  }

  /**
   * Execute a trade (buy/sell)
   */
  public async executeTrade(
    tokenAddress: string,
    amount: number,
    isBuy: boolean
  ): Promise<Transaction | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.mode) {
      console.log(
        `Mock executing trade: ${
          isBuy ? "Buying" : "Selling"
        } ${amount} of token at ${tokenAddress}`
      );
      return this.getMockTransaction();
    }

    try {
      // In a real implementation, this would encode a call to a DEX contract
      // like Uniswap or SushiSwap to execute the trade

      // For example, calling a DEX swap function:
      const dexAddress = "0xYourDEXAddress";
      const data = "0x"; // This would be the encoded function call for the swap

      // Execute the transaction
      return await this.sendTransaction(dexAddress, "0", data);
    } catch (error) {
      console.error("Error executing trade:", error);
      return null;
    }
  }

  /**
   * Get transaction history
   */
  public async getTransactionHistory(): Promise<Transaction[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.mode) {
      return Array(5)
        .fill(0)
        .map(() => this.getMockTransaction());
    }

    try {
      // In a real implementation, we would query transaction history
      // from an explorer API or by scanning blocks

      // For now, return mock transactions
      return Array(5)
        .fill(0)
        .map(() => this.getMockTransaction());
    } catch (error) {
      console.error("Error getting transaction history:", error);
      return [];
    }
  }

  /**
   * Generate a mock transaction for testing
   */
  private getMockTransaction(): Transaction {
    return {
      hash: "0x" + Math.random().toString(16).substring(2, 42),
      timestamp: Date.now(),
      from: "0xSequenceMockAddress",
      to: "0x" + Math.random().toString(16).substring(2, 42),
      value: Math.random() * 1000,
      asset: Math.random() > 0.5 ? "ETH" : "USDC",
      status: Math.random() > 0.9 ? "pending" : "completed",
      blockNumber: Math.floor(Math.random() * 1000000),
    };
  }

  /**
   * Generate mock wallet info for testing
   */
  private getMockWalletInfo(): WalletInfo {
    return {
      address: "0xSequenceMockAddress",
      balances: {
        ETH: {
          symbol: "ETH",
          amount: 5.5 + Math.random() * 2,
          usdValue: (5.5 + Math.random() * 2) * 3500,
        },
        USDC: {
          symbol: "USDC",
          amount: 15000 + Math.random() * 5000,
          usdValue: 15000 + Math.random() * 5000,
        },
        BTC: {
          symbol: "BTC",
          amount: 0.5 + Math.random() * 0.5,
          usdValue: (0.5 + Math.random() * 0.5) * 60000,
        },
        LINK: {
          symbol: "LINK",
          amount: 500 + Math.random() * 100,
          usdValue: (500 + Math.random() * 100) * 20,
        },
      },
    };
  }
}
