import { IWalletService } from "./IWalletService";
import { SoneiumWalletService } from "./SoneiumWalletService";
import { SequenceWalletService } from "./SequenceWalletService";
import dotenv from "dotenv";

dotenv.config();

export enum WalletType {
  SONEIUM = "soneium",
  SEQUENCE = "sequence",
}

/**
 * Factory for creating wallet services
 */
export class WalletServiceFactory {
  /**
   * Create a wallet service of the specified type
   */
  public static createWalletService(
    type: WalletType = WalletType.SONEIUM
  ): IWalletService {
    const walletType = (process.env.WALLET_TYPE as WalletType) || type;

    switch (walletType) {
      case WalletType.SEQUENCE:
        console.log("Creating Sequence wallet service");
        return new SequenceWalletService();

      case WalletType.SONEIUM:
      default:
        console.log("Creating Soneium wallet service");
        return new SoneiumWalletService();
    }
  }
}
