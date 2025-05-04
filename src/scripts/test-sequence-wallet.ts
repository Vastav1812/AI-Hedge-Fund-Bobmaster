/**
 * Script to test the Sequence wallet integration for AI Hedge Fund
 */
import { SequenceWalletService } from "../services/SequenceWalletService";
import {
  WalletServiceFactory,
  WalletType,
} from "../services/WalletServiceFactory";
import dotenv from "dotenv";

dotenv.config();

async function testSequenceWallet() {
  console.log("Testing Sequence Wallet Integration");
  console.log("---------------------------------");

  // Method 1: Direct instantiation
  console.log("\nMethod 1: Direct instantiation");
  const sequenceWallet = new SequenceWalletService();
  await sequenceWallet.initialize();

  // Get wallet info
  const walletInfo = await sequenceWallet.getWalletInfo();
  console.log("Wallet Address:", walletInfo.address);
  console.log("Wallet Balances:");

  for (const [symbol, balance] of Object.entries(walletInfo.balances)) {
    console.log(`- ${symbol}: ${balance.amount} (${balance.usdValue} USD)`);
  }

  // Method 2: Using factory
  console.log("\nMethod 2: Using WalletServiceFactory");
  const walletService = WalletServiceFactory.createWalletService(
    WalletType.SEQUENCE
  );
  await walletService.initialize();

  // Get wallet info
  const factoryWalletInfo = await walletService.getWalletInfo();
  console.log("Factory Wallet Address:", factoryWalletInfo.address);

  // Test transaction
  console.log("\nSimulating a transaction (in mock mode)");
  const tx = await sequenceWallet.sendTransaction(
    "0xMockRecipient",
    "0.01",
    "0x"
  );

  if (tx) {
    console.log("Transaction Hash:", tx.hash);
    console.log("Status:", tx.status);
    console.log("Block Number:", tx.blockNumber);
  } else {
    console.log("Transaction failed");
  }

  // Test trade
  console.log("\nSimulating a trade (in mock mode)");
  const trade = await sequenceWallet.executeTrade(
    "0xUSDCTokenAddress",
    1000,
    true // buy
  );

  if (trade) {
    console.log("Trade Transaction Hash:", trade.hash);
    console.log("Asset:", trade.asset);
    console.log("Value:", trade.value);
  } else {
    console.log("Trade failed");
  }

  console.log("\nTest completed");
}

// Run the test
testSequenceWallet().catch((error) => {
  console.error("Error testing Sequence wallet:", error);
});
