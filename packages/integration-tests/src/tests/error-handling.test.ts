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
import { generatePaymentId } from '../helpers/signature';
import { HARDHAT_ACCOUNTS, CONTRACT_ADDRESSES } from '../setup/wallets';
import { getToken } from '../fixtures/token';
import { getMerchant } from '../fixtures/merchant';

describe('Error Handling Integration', () => {
  const token = getToken('mockUSDT');
  const merchant = getMerchant('default');
  const payerPrivateKey = HARDHAT_ACCOUNTS.payer.privateKey;
  const payerAddress = HARDHAT_ACCOUNTS.payer.address;
  const merchantAddress = merchant.recipientAddress;
  const gatewayAddress = CONTRACT_ADDRESSES.paymentGateway;

  beforeAll(async () => {
    const balance = await getTokenBalance(token.address, payerAddress);
    if (balance < parseUnits('1000', token.decimals)) {
      await mintTokens(token.address, payerAddress, parseUnits('10000', token.decimals));
    }
  });

  describe('Invalid Payment Parameters', () => {
    it('should reject zero amount', async () => {
      const paymentId = generatePaymentId(`ERROR_ZERO_AMOUNT_${Date.now()}`);
      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

      await expect(gateway.pay(paymentId, token.address, 0n, merchantAddress)).rejects.toThrow();
    });

    it('should reject zero merchant address', async () => {
      const paymentId = generatePaymentId(`ERROR_ZERO_MERCHANT_${Date.now()}`);
      const amount = parseUnits('10', token.decimals);

      await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

      await expect(
        gateway.pay(paymentId, token.address, amount, ethers.ZeroAddress)
      ).rejects.toThrow();
    });

    it('should reject zero token address', async () => {
      const paymentId = generatePaymentId(`ERROR_ZERO_TOKEN_${Date.now()}`);
      const amount = parseUnits('10', token.decimals);

      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

      await expect(
        gateway.pay(paymentId, ethers.ZeroAddress, amount, merchantAddress)
      ).rejects.toThrow();
    });
  });

  describe('Token Approval Errors', () => {
    it('should reject payment without approval', async () => {
      const paymentId = generatePaymentId(`ERROR_NO_APPROVAL_${Date.now()}`);
      const amount = parseUnits('1000000', token.decimals);

      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

      await expect(
        gateway.pay(paymentId, token.address, amount, merchantAddress)
      ).rejects.toThrow();
    });

    it('should reject payment with insufficient approval', async () => {
      const paymentId = generatePaymentId(`ERROR_LOW_APPROVAL_${Date.now()}`);
      const approvalAmount = parseUnits('50', token.decimals);
      const paymentAmount = parseUnits('100', token.decimals);

      await approveToken(token.address, gatewayAddress, approvalAmount, payerPrivateKey);

      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

      await expect(
        gateway.pay(paymentId, token.address, paymentAmount, merchantAddress)
      ).rejects.toThrow();
    });
  });

  describe('Balance Errors', () => {
    it('should reject payment exceeding balance', async () => {
      const paymentId = generatePaymentId(`ERROR_EXCEED_BALANCE_${Date.now()}`);
      const balance = await getTokenBalance(token.address, payerAddress);
      const amount = balance + parseUnits('1', token.decimals);

      await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

      await expect(
        gateway.pay(paymentId, token.address, amount, merchantAddress)
      ).rejects.toThrow();
    });
  });

  describe('Duplicate Payment Errors', () => {
    it('should reject duplicate payment ID', async () => {
      const paymentId = generatePaymentId(`ERROR_DUPLICATE_${Date.now()}`);
      const amount = parseUnits('10', token.decimals);

      await approveToken(token.address, gatewayAddress, amount * 2n, payerPrivateKey);

      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

      const tx = await gateway.pay(paymentId, token.address, amount, merchantAddress);
      await tx.wait();

      await expect(
        gateway.pay(paymentId, token.address, amount, merchantAddress)
      ).rejects.toThrow();
    });
  });
});
