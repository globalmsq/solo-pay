import { describe, it, expect, beforeAll } from 'vitest';
import {
  getWallet,
  getContract,
  getTokenBalance,
  approveToken,
  mintTokens,
  parseUnits,
  PaymentGatewayABI,
  ERC2771ForwarderABI,
} from '../helpers/blockchain';
import {
  signForwardRequest,
  encodePayFunctionData,
  generatePaymentId,
  getDeadline,
  type ForwardRequest,
} from '../helpers/signature';
import { HARDHAT_ACCOUNTS, CONTRACT_ADDRESSES } from '../setup/wallets';
import { getToken } from '../fixtures/token';

describe('Payment Lifecycle Integration', () => {
  const token = getToken('mockUSDT');
  const payerPrivateKey = HARDHAT_ACCOUNTS.payer.privateKey;
  const relayerPrivateKey = HARDHAT_ACCOUNTS.relayer.privateKey;
  const payerAddress = HARDHAT_ACCOUNTS.payer.address;
  const gatewayAddress = CONTRACT_ADDRESSES.paymentGateway;
  const forwarderAddress = CONTRACT_ADDRESSES.forwarder;

  beforeAll(async () => {
    const balance = await getTokenBalance(token.address, payerAddress);
    if (balance < parseUnits('1000', token.decimals)) {
      await mintTokens(token.address, payerAddress, parseUnits('10000', token.decimals));
    }
  });

  async function getNonce(address: string): Promise<bigint> {
    const forwarder = getContract(forwarderAddress, ERC2771ForwarderABI);
    return forwarder.nonces(address);
  }

  describe('Direct Payment Lifecycle', () => {
    it('should transition: NOT_PROCESSED -> PROCESSED (direct)', async () => {
      const paymentId = generatePaymentId(`LIFECYCLE_DIRECT_${Date.now()}`);
      const amount = parseUnits('10', token.decimals);

      const gateway = getContract(gatewayAddress, PaymentGatewayABI);

      const beforeProcessed = await gateway.isPaymentProcessed(paymentId);
      expect(beforeProcessed).toBe(false);

      await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

      const wallet = getWallet(payerPrivateKey);
      const gatewayWithSigner = getContract(gatewayAddress, PaymentGatewayABI, wallet);
      const tx = await gatewayWithSigner.pay(paymentId, token.address, amount);
      await tx.wait();

      const afterProcessed = await gateway.isPaymentProcessed(paymentId);
      expect(afterProcessed).toBe(true);
    });
  });

  describe('Gasless Payment Lifecycle', () => {
    it('should transition: NOT_PROCESSED -> PROCESSED (gasless)', async () => {
      const paymentId = generatePaymentId(`LIFECYCLE_GASLESS_${Date.now()}`);
      const amount = parseUnits('10', token.decimals);

      const gateway = getContract(gatewayAddress, PaymentGatewayABI);

      const beforeProcessed = await gateway.isPaymentProcessed(paymentId);
      expect(beforeProcessed).toBe(false);

      await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

      const data = encodePayFunctionData(paymentId, token.address, amount);
      const nonce = await getNonce(payerAddress);
      const deadline = getDeadline(1);

      const request: ForwardRequest = {
        from: payerAddress,
        to: gatewayAddress,
        value: 0n,
        gas: 500000n,
        nonce,
        deadline,
        data,
      };

      const signature = await signForwardRequest(request, payerPrivateKey);

      const relayerWallet = getWallet(relayerPrivateKey);
      const forwarder = getContract(forwarderAddress, ERC2771ForwarderABI, relayerWallet);

      const requestData = {
        from: request.from,
        to: request.to,
        value: request.value,
        gas: request.gas,
        deadline: request.deadline,
        data: request.data,
        signature,
      };

      const tx = await forwarder.execute(requestData);
      await tx.wait();

      const afterProcessed = await gateway.isPaymentProcessed(paymentId);
      expect(afterProcessed).toBe(true);
    });
  });

  describe('Payment Finality', () => {
    it('should not allow re-processing of completed payment', async () => {
      const paymentId = generatePaymentId(`FINALITY_${Date.now()}`);
      const amount = parseUnits('10', token.decimals);

      await approveToken(token.address, gatewayAddress, amount * 2n, payerPrivateKey);

      const wallet = getWallet(payerPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);

      const tx = await gateway.pay(paymentId, token.address, amount);
      await tx.wait();

      await expect(gateway.pay(paymentId, token.address, amount)).rejects.toThrow();
    });

    it('should correctly track multiple independent payments', async () => {
      const paymentIds = [
        generatePaymentId(`MULTI_1_${Date.now()}`),
        generatePaymentId(`MULTI_2_${Date.now()}`),
        generatePaymentId(`MULTI_3_${Date.now()}`),
      ];
      const amount = parseUnits('5', token.decimals);
      const totalAmount = amount * BigInt(paymentIds.length);

      await approveToken(token.address, gatewayAddress, totalAmount, payerPrivateKey);

      // Create fresh wallet for each payment to avoid nonce caching issues
      for (const paymentId of paymentIds) {
        const wallet = getWallet(payerPrivateKey);
        const gateway = getContract(gatewayAddress, PaymentGatewayABI, wallet);
        const tx = await gateway.pay(paymentId, token.address, amount);
        await tx.wait();
      }

      const gatewayReadOnly = getContract(gatewayAddress, PaymentGatewayABI);
      for (const paymentId of paymentIds) {
        const isProcessed = await gatewayReadOnly.isPaymentProcessed(paymentId);
        expect(isProcessed).toBe(true);
      }
    });
  });
});
