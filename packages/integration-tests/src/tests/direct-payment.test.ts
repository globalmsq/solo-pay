import { describe, it, expect, beforeAll } from 'vitest';
import {
  getWallet,
  getContract,
  getTokenBalance,
  approveToken,
  mintTokens,
  parseUnits,
  PaymentGatewayABI,
} from '../helpers/blockchain';
import { HARDHAT_ACCOUNTS, CONTRACT_ADDRESSES } from '../setup/wallets';
import { getToken } from '../fixtures/token';
import {
  generatePaymentId,
  signPaymentRequest,
  merchantKeyToId,
  ZERO_PERMIT,
  type PaymentParams,
} from '../helpers/signature';

describe('Direct Payment Integration', () => {
  const token = getToken('mockUSDT');
  const payerPrivateKey = HARDHAT_ACCOUNTS.payer.privateKey;
  const signerPrivateKey = HARDHAT_ACCOUNTS.signer.privateKey;
  const payerAddress = HARDHAT_ACCOUNTS.payer.address;
  // Treasury receives platform fees (Account #5 - contract config)
  const treasuryAddress = HARDHAT_ACCOUNTS.treasury.address;
  // Recipient receives payments (Account #1 - matches init.sql)
  const recipientAddress = HARDHAT_ACCOUNTS.recipient.address;
  const gatewayAddress = CONTRACT_ADDRESSES.paymentGateway;

  // Test merchant ID
  const merchantKey = 'merchant_demo_001';
  const merchantId = merchantKeyToId(merchantKey);

  beforeAll(async () => {
    const balance = await getTokenBalance(token.address, payerAddress);
    if (balance < parseUnits('1000', token.decimals)) {
      await mintTokens(token.address, payerAddress, parseUnits('10000', token.decimals));
    }
  });

  it('should complete a direct payment successfully with no fee', async () => {
    const paymentId = generatePaymentId(`ORDER_DIRECT_${Date.now()}`);
    const amount = parseUnits('100', token.decimals);
    const feeBps = 0;

    const initialPayerBalance = await getTokenBalance(token.address, payerAddress);
    const initialRecipientBalance = await getTokenBalance(token.address, recipientAddress);

    // Create server signature
    const paymentParams: PaymentParams = {
      paymentId,
      tokenAddress: token.address,
      amount,
      recipientAddress: recipientAddress,
      merchantId,
      feeBps,
    };
    const serverSignature = await signPaymentRequest(paymentParams, signerPrivateKey);

    await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

    const wallet = getWallet(payerPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

    const tx = await gateway.pay(
      paymentId,
      token.address,
      amount,
      recipientAddress,
      merchantId,
      feeBps,
      serverSignature,
      ZERO_PERMIT
    );
    await tx.wait();

    const isProcessed = await gateway.isPaymentProcessed(paymentId);
    expect(isProcessed).toBe(true);

    const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
    const finalRecipientBalance = await getTokenBalance(token.address, recipientAddress);

    expect(finalPayerBalance).toBe(initialPayerBalance - amount);
    expect(finalRecipientBalance).toBe(initialRecipientBalance + amount);
  });

  it('should split payment with fee: fee to treasury, rest to recipient', async () => {
    const paymentId = generatePaymentId(`ORDER_FEE_${Date.now()}`);
    const amount = parseUnits('100', token.decimals);
    const feeBps = 500; // 5%

    const initialPayerBalance = await getTokenBalance(token.address, payerAddress);
    const initialTreasuryBalance = await getTokenBalance(token.address, treasuryAddress);
    const initialRecipientBalance = await getTokenBalance(token.address, recipientAddress);

    // Create server signature with fee
    const paymentParams: PaymentParams = {
      paymentId,
      tokenAddress: token.address,
      amount,
      recipientAddress: recipientAddress,
      merchantId,
      feeBps,
    };
    const serverSignature = await signPaymentRequest(paymentParams, signerPrivateKey);

    await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

    const wallet = getWallet(payerPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

    const tx = await gateway.pay(
      paymentId,
      token.address,
      amount,
      recipientAddress,
      merchantId,
      feeBps,
      serverSignature,
      ZERO_PERMIT
    );
    await tx.wait();

    const expectedFee = (amount * BigInt(feeBps)) / 10000n;
    const expectedRecipientAmount = amount - expectedFee;

    const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
    const finalTreasuryBalance = await getTokenBalance(token.address, treasuryAddress);
    const finalRecipientBalance = await getTokenBalance(token.address, recipientAddress);

    expect(finalPayerBalance).toBe(initialPayerBalance - amount);
    expect(finalTreasuryBalance).toBe(initialTreasuryBalance + expectedFee);
    expect(finalRecipientBalance).toBe(initialRecipientBalance + expectedRecipientAmount);
  });

  it('should reject duplicate payment ID', async () => {
    const paymentId = generatePaymentId(`ORDER_DUP_${Date.now()}`);
    const amount = parseUnits('50', token.decimals);
    const feeBps = 0;

    const paymentParams: PaymentParams = {
      paymentId,
      tokenAddress: token.address,
      amount,
      recipientAddress: recipientAddress,
      merchantId,
      feeBps,
    };
    const serverSignature = await signPaymentRequest(paymentParams, signerPrivateKey);

    await approveToken(token.address, gatewayAddress, amount * 2n, payerPrivateKey);

    const wallet = getWallet(payerPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

    const tx = await gateway.pay(
      paymentId,
      token.address,
      amount,
      recipientAddress,
      merchantId,
      feeBps,
      serverSignature,
      ZERO_PERMIT
    );
    await tx.wait();

    await expect(
      gateway.pay(
        paymentId,
        token.address,
        amount,
        recipientAddress,
        merchantId,
        feeBps,
        serverSignature,
        ZERO_PERMIT
      )
    ).rejects.toThrow();
  });

  it('should reject zero amount payment', async () => {
    const paymentId = generatePaymentId(`ORDER_ZERO_${Date.now()}`);
    const feeBps = 0;

    const paymentParams: PaymentParams = {
      paymentId,
      tokenAddress: token.address,
      amount: 0n,
      recipientAddress: recipientAddress,
      merchantId,
      feeBps,
    };
    const serverSignature = await signPaymentRequest(paymentParams, signerPrivateKey);

    const wallet = getWallet(payerPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

    await expect(
      gateway.pay(
        paymentId,
        token.address,
        0n,
        recipientAddress,
        merchantId,
        feeBps,
        serverSignature,
        ZERO_PERMIT
      )
    ).rejects.toThrow();
  });

  it('should reject invalid server signature', async () => {
    const paymentId = generatePaymentId(`ORDER_INVALID_SIG_${Date.now()}`);
    const amount = parseUnits('50', token.decimals);
    const feeBps = 0;

    // Sign with wrong key (relayer instead of signer)
    const paymentParams: PaymentParams = {
      paymentId,
      tokenAddress: token.address,
      amount,
      recipientAddress: recipientAddress,
      merchantId,
      feeBps,
    };
    const wrongSignature = await signPaymentRequest(
      paymentParams,
      HARDHAT_ACCOUNTS.relayer.privateKey
    );

    await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

    const wallet = getWallet(payerPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

    await expect(
      gateway.pay(
        paymentId,
        token.address,
        amount,
        recipientAddress,
        merchantId,
        feeBps,
        wrongSignature,
        ZERO_PERMIT
      )
    ).rejects.toThrow();
  });

  it('should reject payment with insufficient balance', async () => {
    const paymentId = generatePaymentId(`ORDER_INSUFFICIENT_${Date.now()}`);
    const balance = await getTokenBalance(token.address, payerAddress);
    const amount = balance + parseUnits('1000', token.decimals);
    const feeBps = 0;

    const paymentParams: PaymentParams = {
      paymentId,
      tokenAddress: token.address,
      amount,
      recipientAddress: recipientAddress,
      merchantId,
      feeBps,
    };
    const serverSignature = await signPaymentRequest(paymentParams, signerPrivateKey);

    await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

    const wallet = getWallet(payerPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

    await expect(
      gateway.pay(
        paymentId,
        token.address,
        amount,
        recipientAddress,
        merchantId,
        feeBps,
        serverSignature,
        ZERO_PERMIT
      )
    ).rejects.toThrow();
  });
});
