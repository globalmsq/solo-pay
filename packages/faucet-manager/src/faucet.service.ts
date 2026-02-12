import type { RequestGasParams, RequestGasResult } from './types';
import type { GasFaucetPorts } from './ports';
import { RequestGasError } from './types';

const APPROVE_GAS_UNITS = 46_000n;
const FAUCET_GAS_UNITS = 48_000n;

/**
 * Request a one-time gas grant for a wallet on a given chain.
 * Faucet is done BEFORE approve: we give gas so the user can then sign the approve tx.
 * Conditions: payment exists; token balance >= amount; native balance < approve cost; no prior grant.
 * Grant amount: FAUCET_GAS_UNITS * gasPrice (> approve, < transfer).
 */
export async function requestGas(
  ports: GasFaucetPorts,
  params: RequestGasParams
): Promise<RequestGasResult> {
  const { paymentId, walletAddress } = params;

  const payment = await ports.getPaymentInfo(paymentId);
  if (!payment) {
    throw new RequestGasError('PAYMENT_NOT_FOUND', 'Payment not found');
  }

  const chainId = payment.networkId;

  const [tokenBalance, nativeBalance, gasPrice, existingGrant] = await Promise.all([
    ports.getTokenBalance(chainId, payment.tokenAddress, walletAddress),
    ports.getNativeBalance(chainId, walletAddress),
    ports.getGasPrice(chainId),
    ports.findWalletGasGrant(walletAddress, chainId),
  ]);

  if (tokenBalance < payment.amountWei) {
    throw new RequestGasError(
      'INSUFFICIENT_TOKEN_BALANCE',
      'Token balance is less than payment amount'
    );
  }

  const approveGasCost = APPROVE_GAS_UNITS * gasPrice;
  if (nativeBalance >= approveGasCost) {
    throw new RequestGasError('ALREADY_HAS_GAS', 'Wallet already has enough gas for approve');
  }

  if (existingGrant) {
    throw new RequestGasError(
      'ALREADY_GRANTED',
      'This wallet already received a gas grant for this chain'
    );
  }

  const amountWei = FAUCET_GAS_UNITS * gasPrice;

  let txHash: string;
  try {
    txHash = await ports.sendNative(chainId, walletAddress, amountWei);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Send failed';
    throw new RequestGasError('SEND_FAILED', message);
  }

  await ports.createWalletGasGrant({
    walletAddress,
    chainId,
    amount: amountWei.toString(),
    txHash,
  });

  return {
    txHash,
    amount: amountWei.toString(),
    chainId,
  };
}
