import {
  PaymentCompleted as PaymentCompletedEvent,
} from "../generated/PaymentGateway/PaymentGateway";
import {
  Payment,
  MerchantStats,
  DailyVolume,
  TokenStats,
  GlobalStats,
} from "../generated/schema";
import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";

// Constants
const GLOBAL_STATS_ID = "global";
const SECONDS_PER_DAY = 86400;

/**
 * Handle PaymentCompleted event
 * Creates/updates Payment, MerchantStats, DailyVolume, TokenStats, and GlobalStats entities
 */
export function handlePaymentCompleted(event: PaymentCompletedEvent): void {
  // Create Payment entity
  let payment = new Payment(event.params.paymentId.toHexString());
  payment.payer = event.params.payer;
  payment.merchant = event.params.merchant;
  payment.token = event.params.token;
  payment.amount = event.params.amount;
  payment.timestamp = event.params.timestamp;
  payment.transactionHash = event.transaction.hash;
  payment.blockNumber = event.block.number;

  // Determine gas mode based on transaction sender
  // If tx.from == payer, it's a direct payment
  // If tx.from != payer, it's a meta-transaction (via forwarder)
  if (event.transaction.from.equals(event.params.payer)) {
    payment.gasMode = "Direct";
  } else {
    payment.gasMode = "MetaTx";
  }

  payment.save();

  // Update MerchantStats
  updateMerchantStats(event);

  // Update DailyVolume
  updateDailyVolume(event);

  // Update TokenStats
  updateTokenStats(event);

  // Update GlobalStats
  updateGlobalStats(event);
}

/**
 * Update merchant statistics
 */
function updateMerchantStats(event: PaymentCompletedEvent): void {
  let merchantId = event.params.merchant.toHexString();
  let merchant = MerchantStats.load(merchantId);

  if (merchant == null) {
    merchant = new MerchantStats(merchantId);
    merchant.totalReceived = BigInt.fromI32(0);
    merchant.paymentCount = 0;
  }

  merchant.totalReceived = merchant.totalReceived.plus(event.params.amount);
  merchant.paymentCount = merchant.paymentCount + 1;
  merchant.lastPaymentAt = event.params.timestamp;

  merchant.save();
}

/**
 * Update daily volume statistics
 */
function updateDailyVolume(event: PaymentCompletedEvent): void {
  let dayId = getDayId(event.params.timestamp);
  let daily = DailyVolume.load(dayId);

  if (daily == null) {
    daily = new DailyVolume(dayId);
    daily.date = getDayStart(event.params.timestamp);
    daily.volume = BigInt.fromI32(0);
    daily.count = 0;
  }

  daily.volume = daily.volume.plus(event.params.amount);
  daily.count = daily.count + 1;

  daily.save();
}

/**
 * Update token statistics
 */
function updateTokenStats(event: PaymentCompletedEvent): void {
  let tokenId = event.params.token.toHexString();
  let token = TokenStats.load(tokenId);

  if (token == null) {
    token = new TokenStats(tokenId);
    token.totalVolume = BigInt.fromI32(0);
    token.transactionCount = 0;
    token.symbol = null; // Could be fetched from contract, but keeping it simple
  }

  token.totalVolume = token.totalVolume.plus(event.params.amount);
  token.transactionCount = token.transactionCount + 1;

  token.save();
}

/**
 * Update global statistics
 */
function updateGlobalStats(event: PaymentCompletedEvent): void {
  let global = GlobalStats.load(GLOBAL_STATS_ID);

  if (global == null) {
    global = new GlobalStats(GLOBAL_STATS_ID);
    global.totalPayments = 0;
    global.totalVolume = BigInt.fromI32(0);
    global.uniqueMerchants = 0;
    global.uniquePayers = 0;
  }

  global.totalPayments = global.totalPayments + 1;
  global.totalVolume = global.totalVolume.plus(event.params.amount);

  // Note: Unique counts would require additional tracking
  // For simplicity, we're not tracking unique counts accurately here
  // A production implementation would use separate entities to track unique addresses

  global.save();
}

/**
 * Get day ID string (YYYY-MM-DD format)
 */
function getDayId(timestamp: BigInt): string {
  let dayTimestamp = getDayStart(timestamp);
  let date = new Date(dayTimestamp.toI64() * 1000);

  let year = date.getUTCFullYear().toString();
  let month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  let day = date.getUTCDate().toString().padStart(2, "0");

  return year + "-" + month + "-" + day;
}

/**
 * Get the start of the day (00:00:00 UTC) for a given timestamp
 */
function getDayStart(timestamp: BigInt): BigInt {
  let seconds = timestamp.toI64();
  let dayStart = seconds - (seconds % SECONDS_PER_DAY);
  return BigInt.fromI64(dayStart);
}
