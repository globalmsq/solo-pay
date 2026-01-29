import { describe, it, expect, beforeAll } from 'vitest';
import { ethers } from 'ethers';
import {
  getWallet,
  getContract,
  getTokenBalance,
  approveToken,
  mintTokens,
  parseUnits,
  PaymentGatewayABI,
} from '../helpers/blockchain';
import {
  generatePaymentId,
  signPaymentRequest,
  merchantKeyToId,
  type PaymentParams,
} from '../helpers/signature';
import { HARDHAT_ACCOUNTS, CONTRACT_ADDRESSES } from '../setup/wallets';
import { getToken } from '../fixtures/token';

describe('Error Handling Integration', () => {
  const token = getToken('mockUSDT');
  const payerPrivateKey = HARDHAT_ACCOUNTS.payer.privateKey;
  const signerPrivateKey = HARDHAT_ACCOUNTS.signer.privateKey;
  const payerAddress = HARDHAT_ACCOUNTS.payer.address;
  const recipientAddress = HARDHAT_ACCOUNTS.merchantRecipient.address;
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

  describe('Invalid Payment Parameters', () => {
    it('should reject zero amount', async () => {
      const paymentId = generatePaymentId(`ERROR_ZERO_AMOUNT_${Date.now()}`);
      const feeBps = 0;

      const paymentParams: PaymentParams = {
        paymentId,
        tokenAddress: token.address,
        amount: 0n,
        recipientAddress,
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
          serverSignature
        )
      ).rejects.toThrow();
    });

    it('should reject zero token address', async () => {
      const paymentId = generatePaymentId(`ERROR_ZERO_TOKEN_${Date.now()}`);
      const amount = parseUnits('10', token.decimals);
      const feeBps = 0;

      const paymentParams: PaymentParams = {
        paymentId,
        tokenAddress: ethers.ZeroAddress,
        amount,
        recipientAddress,
        merchantId,
        feeBps,
      };
      const serverSignature = await signPaymentRequest(paymentParams, signerPrivateKey);

      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

      await expect(
        gateway.pay(
          paymentId,
          ethers.ZeroAddress,
          amount,
          recipientAddress,
          merchantId,
          feeBps,
          serverSignature
        )
      ).rejects.toThrow();
    });
  });

  describe('Token Approval Errors', () => {
    it('should reject payment without approval', async () => {
      const paymentId = generatePaymentId(`ERROR_NO_APPROVAL_${Date.now()}`);
      const amount = parseUnits('1000000', token.decimals);
      const feeBps = 0;

      const paymentParams: PaymentParams = {
        paymentId,
        tokenAddress: token.address,
        amount,
        recipientAddress,
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
          amount,
          recipientAddress,
          merchantId,
          feeBps,
          serverSignature
        )
      ).rejects.toThrow();
    });

    it('should reject payment with insufficient approval', async () => {
      const paymentId = generatePaymentId(`ERROR_LOW_APPROVAL_${Date.now()}`);
      const approvalAmount = parseUnits('50', token.decimals);
      const paymentAmount = parseUnits('100', token.decimals);
      const feeBps = 0;

      await approveToken(token.address, gatewayAddress, approvalAmount, payerPrivateKey);

      const paymentParams: PaymentParams = {
        paymentId,
        tokenAddress: token.address,
        amount: paymentAmount,
        recipientAddress,
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
          paymentAmount,
          recipientAddress,
          merchantId,
          feeBps,
          serverSignature
        )
      ).rejects.toThrow();
    });
  });

  describe('Balance Errors', () => {
    it('should reject payment exceeding balance', async () => {
      const paymentId = generatePaymentId(`ERROR_EXCEED_BALANCE_${Date.now()}`);
      const balance = await getTokenBalance(token.address, payerAddress);
      const amount = balance + parseUnits('1', token.decimals);
      const feeBps = 0;

      await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

      const paymentParams: PaymentParams = {
        paymentId,
        tokenAddress: token.address,
        amount,
        recipientAddress,
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
          amount,
          recipientAddress,
          merchantId,
          feeBps,
          serverSignature
        )
      ).rejects.toThrow();
    });
  });

  describe('Duplicate Payment Errors', () => {
    it('should reject duplicate payment ID', async () => {
      const paymentId = generatePaymentId(`ERROR_DUPLICATE_${Date.now()}`);
      const amount = parseUnits('10', token.decimals);
      const feeBps = 0;

      await approveToken(token.address, gatewayAddress, amount * 2n, payerPrivateKey);

      const paymentParams: PaymentParams = {
        paymentId,
        tokenAddress: token.address,
        amount,
        recipientAddress,
        merchantId,
        feeBps,
      };
      const serverSignature = await signPaymentRequest(paymentParams, signerPrivateKey);

      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

      const tx = await gateway.pay(
        paymentId,
        token.address,
        amount,
        recipientAddress,
        merchantId,
        feeBps,
        serverSignature
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
          serverSignature
        )
      ).rejects.toThrow();
    });
  });

  describe('Signature Errors', () => {
    it('should reject invalid server signature', async () => {
      const paymentId = generatePaymentId(`ERROR_INVALID_SIG_${Date.now()}`);
      const amount = parseUnits('10', token.decimals);
      const feeBps = 0;

      await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

      // Sign with wrong key (relayer instead of signer)
      const paymentParams: PaymentParams = {
        paymentId,
        tokenAddress: token.address,
        amount,
        recipientAddress,
        merchantId,
        feeBps,
      };
      const wrongSignature = await signPaymentRequest(
        paymentParams,
        HARDHAT_ACCOUNTS.relayer.privateKey
      );

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
          wrongSignature
        )
      ).rejects.toThrow();
    });

    it('should reject tampered amount in payment', async () => {
      const paymentId = generatePaymentId(`ERROR_TAMPERED_AMOUNT_${Date.now()}`);
      const signedAmount = parseUnits('10', token.decimals);
      const tamperedAmount = parseUnits('100', token.decimals);
      const feeBps = 0;

      await approveToken(token.address, gatewayAddress, tamperedAmount, payerPrivateKey);

      // Sign with original amount
      const paymentParams: PaymentParams = {
        paymentId,
        tokenAddress: token.address,
        amount: signedAmount,
        recipientAddress,
        merchantId,
        feeBps,
      };
      const serverSignature = await signPaymentRequest(paymentParams, signerPrivateKey);

      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

      // Try to pay with tampered amount
      await expect(
        gateway.pay(
          paymentId,
          token.address,
          tamperedAmount,
          recipientAddress,
          merchantId,
          feeBps,
          serverSignature
        )
      ).rejects.toThrow();
    });
  });
});
