import { Strategy, StrategyType } from "../models/types";
import { MomentumStrategy } from "./MomentumStrategy";
import { ArbitrageStrategy } from "./ArbitrageStrategy";
import { CopyTradingStrategy } from "./CopyTradingStrategy";
import { IWalletService } from "../services/IWalletService";
import { DEXService } from "../services/DEXService";
import { GeminiService } from "../services/GeminiService";

/**
 * Factory function to load a strategy by type
 */
export function loadStrategy(
  strategyType: StrategyType,
  walletService: IWalletService,
  dexService: DEXService,
  geminiService?: GeminiService
): Strategy | null {
  switch (strategyType) {
    case StrategyType.Momentum:
      return new MomentumStrategy(walletService, dexService);
    case StrategyType.Arbitrage:
      return new ArbitrageStrategy(walletService, dexService);
    case StrategyType.CopyTrading:
      if (!geminiService) {
        console.error("GeminiService is required for CopyTrading strategy");
        return null;
      }
      return new CopyTradingStrategy(walletService, dexService, geminiService);
    default:
      console.error(`Unknown strategy type: ${strategyType}`);
      return null;
  }
}

/**
 * Get all available strategies
 * Note: This function is no longer used because strategies require service dependencies
 */
export function getAllStrategies(
  walletService: IWalletService,
  dexService: DEXService,
  geminiService: GeminiService
): Strategy[] {
  return [
    new MomentumStrategy(walletService, dexService),
    new ArbitrageStrategy(walletService, dexService),
    new CopyTradingStrategy(walletService, dexService, geminiService),
  ];
}
