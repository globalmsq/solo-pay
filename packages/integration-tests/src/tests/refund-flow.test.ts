import { describe, it, expect, beforeAll } from 'vitest';
import {
  getProvider,
  getWallet,
  getContract,
  getTokenBalance,
  approveToken,
  mintTokens,
  parseUnits,
  PaymentGatewayABI,
  ERC2771ForwarderABI,
} from '../helpers/blockchain';
import { HARDHAT_ACCOUNTS, CONTRACT_ADDRESSES, TEST_CHAIN_ID } from '../setup/wallets';
import { getToken } from '../fixtures/token';
import {
  generatePaymentId,
  signPaymentRequest,
  signRefundRequest,
  signForwardRequest,
  encodeRefundFunctionData,
  buildForwardRequestData,
  merchantKeyToId,
  getDeadline,
  ZERO_PERMIT,
  type PaymentParams,
  type RefundParams,
  type ForwardRequest,
} from '../helpers/signature';

describe('Refund Flow Integration', () => {
  const token = getToken('mockUSDT');
  const payerPrivateKey = HARDHAT_ACCOUNTS.payer.privateKey;
  const signerPrivateKey = HARDHAT_ACCOUNTS.signer.privateKey;
  const relayerPrivateKey = HARDHAT_ACCOUNTS.relayer.privateKey;
  const recipientPrivateKey = HARDHAT_ACCOUNTS.recipient.privateKey;
  const payerAddress = HARDHAT_ACCOUNTS.payer.address;
  const recipientAddress = HARDHAT_ACCOUNTS.recipient.address;
  const gatewayAddress = CONTRACT_ADDRESSES.paymentGateway;
  const forwarderAddress = CONTRACT_ADDRESSES.forwarder;

  const merchantKey = 'merchant_demo_001';
  const merchantId = merchantKeyToId(merchantKey);

  let blockchainRunning = false;

  async function checkBlockchain(): Promise<boolean> {
    try {
      const provider = getProvider();
      await provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Execute a payment (payer -> recipient) and return the paymentId.
   * The contract uses safeTransferFrom(payer, recipient, amount).
   */
  async function executePayment(
    orderId: string,
    amount: bigint,
    feeBps: number = 0
  ): Promise<string> {
    const paymentId = generatePaymentId(orderId);

    const paymentParams: PaymentParams = {
      paymentId,
      tokenAddress: token.address,
      amount,
      recipientAddress,
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

    return paymentId;
  }

  /**
   * Helper: Execute a refund from recipient (merchant) to payer.
   * The contract uses safeTransferFrom(msg.sender=recipient, payerAddress, amount).
   * Recipient must approve the gateway before calling refund.
   */
  async function executeRefund(paymentId: string, amount: bigint): Promise<void> {
    const refundParams: RefundParams = {
      originalPaymentId: paymentId,
      tokenAddress: token.address,
      amount,
      payerAddress,
      merchantId,
    };
    const refundSignature = await signRefundRequest(refundParams, signerPrivateKey);

    // Recipient approves gateway to spend tokens for the refund
    await approveToken(token.address, gatewayAddress, amount, recipientPrivateKey);

    // Recipient calls refund (msg.sender = recipient)
    const recipientWallet = getWallet(recipientPrivateKey);
    const gateway = getContract(gatewayAddress, PaymentGatewayABI, recipientWallet);

    const tx = await gateway.refund(
      paymentId,
      token.address,
      amount,
      payerAddress,
      merchantId,
      refundSignature,
      ZERO_PERMIT
    );
    await tx.wait();
  }

  beforeAll(async () => {
    blockchainRunning = await checkBlockchain();
    if (!blockchainRunning) {
      console.warn(
        '\n⚠️  Hardhat node is not running. Refund flow tests will be skipped.\n' +
          '   Run: pnpm --filter @globalmsq/integration-tests test:setup\n'
      );
      return;
    }

    // Ensure payer has enough tokens for payments
    const payerBalance = await getTokenBalance(token.address, payerAddress);
    if (payerBalance < parseUnits('5000', token.decimals)) {
      await mintTokens(token.address, payerAddress, parseUnits('10000', token.decimals));
    }

    // Ensure recipient has enough tokens for refunds
    // Payment proceeds go to recipient; recipient uses those to refund
    const recipientBalance = await getTokenBalance(token.address, recipientAddress);
    if (recipientBalance < parseUnits('5000', token.decimals)) {
      await mintTokens(token.address, recipientAddress, parseUnits('10000', token.decimals));
    }
  });

  describe('Direct Refund', () => {
    it('should complete a direct refund after successful payment', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('100', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_OK_${Date.now()}`, amount);

      const initialPayerBalance = await getTokenBalance(token.address, payerAddress);
      const initialRecipientBalance = await getTokenBalance(token.address, recipientAddress);

      await executeRefund(paymentId, amount);

      // Verify refund is recorded on-chain
      const gateway = getContract(gatewayAddress, PaymentGatewayABI);
      const isRefunded = await gateway.refundedPayments(paymentId);
      expect(isRefunded).toBe(true);

      // Verify balance changes: recipient -> payer
      const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
      const finalRecipientBalance = await getTokenBalance(token.address, recipientAddress);

      expect(finalPayerBalance).toBe(initialPayerBalance + amount);
      expect(finalRecipientBalance).toBe(initialRecipientBalance - amount);
    });

    it('should verify payer receives exact refund amount', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('250', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_EXACT_${Date.now()}`, amount);

      const initialPayerBalance = await getTokenBalance(token.address, payerAddress);

      await executeRefund(paymentId, amount);

      const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
      expect(finalPayerBalance - initialPayerBalance).toBe(amount);
    });
  });

  describe('Duplicate Refund Prevention', () => {
    it('should reject duplicate refund for the same payment', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('50', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_DUP_${Date.now()}`, amount);

      // First refund succeeds
      await executeRefund(paymentId, amount);

      // Second refund with same paymentId should revert
      const refundParams: RefundParams = {
        originalPaymentId: paymentId,
        tokenAddress: token.address,
        amount,
        payerAddress,
        merchantId,
      };
      const refundSignature = await signRefundRequest(refundParams, signerPrivateKey);

      await approveToken(token.address, gatewayAddress, amount, recipientPrivateKey);

      const recipientWallet = getWallet(recipientPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, recipientWallet);

      await expect(
        gateway.refund(paymentId, token.address, amount, payerAddress, merchantId, refundSignature, ZERO_PERMIT)
      ).rejects.toThrow();
    });
  });

  describe('Signature Validation', () => {
    it('should reject refund with invalid server signature', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('50', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_BADSIG_${Date.now()}`, amount);

      const refundParams: RefundParams = {
        originalPaymentId: paymentId,
        tokenAddress: token.address,
        amount,
        payerAddress,
        merchantId,
      };

      // Sign with wrong key (relayer instead of signer)
      const wrongSignature = await signRefundRequest(
        refundParams,
        HARDHAT_ACCOUNTS.relayer.privateKey
      );

      await approveToken(token.address, gatewayAddress, amount, recipientPrivateKey);

      const recipientWallet = getWallet(recipientPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, recipientWallet);

      await expect(
        gateway.refund(paymentId, token.address, amount, payerAddress, merchantId, wrongSignature, ZERO_PERMIT)
      ).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should reject refund for non-existent payment', async () => {
      if (!blockchainRunning) return;

      const fakePaymentId = generatePaymentId(`ORDER_FAKE_${Date.now()}`);
      const amount = parseUnits('50', token.decimals);

      const refundParams: RefundParams = {
        originalPaymentId: fakePaymentId,
        tokenAddress: token.address,
        amount,
        payerAddress,
        merchantId,
      };
      const refundSignature = await signRefundRequest(refundParams, signerPrivateKey);

      const recipientWallet = getWallet(recipientPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, recipientWallet);

      await expect(
        gateway.refund(
          fakePaymentId,
          token.address,
          amount,
          payerAddress,
          merchantId,
          refundSignature,
          ZERO_PERMIT
        )
      ).rejects.toThrow();
    });

    it('should reject refund with zero amount', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('50', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_ZERO_${Date.now()}`, amount);

      const refundParams: RefundParams = {
        originalPaymentId: paymentId,
        tokenAddress: token.address,
        amount: 0n,
        payerAddress,
        merchantId,
      };
      const refundSignature = await signRefundRequest(refundParams, signerPrivateKey);

      const recipientWallet = getWallet(recipientPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, recipientWallet);

      await expect(
        gateway.refund(paymentId, token.address, 0n, payerAddress, merchantId, refundSignature, ZERO_PERMIT)
      ).rejects.toThrow();
    });

    it('should reject refund with zero token address', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('50', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_ZEROTOKEN_${Date.now()}`, amount);
      const zeroAddress = '0x0000000000000000000000000000000000000000';

      const refundParams: RefundParams = {
        originalPaymentId: paymentId,
        tokenAddress: zeroAddress,
        amount,
        payerAddress,
        merchantId,
      };
      const refundSignature = await signRefundRequest(refundParams, signerPrivateKey);

      const recipientWallet = getWallet(recipientPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, recipientWallet);

      await expect(
        gateway.refund(paymentId, zeroAddress, amount, payerAddress, merchantId, refundSignature, ZERO_PERMIT)
      ).rejects.toThrow();
    });

    it('should reject refund with zero payer address', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('50', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_ZEROPAYER_${Date.now()}`, amount);
      const zeroAddress = '0x0000000000000000000000000000000000000000';

      const refundParams: RefundParams = {
        originalPaymentId: paymentId,
        tokenAddress: token.address,
        amount,
        payerAddress: zeroAddress,
        merchantId,
      };
      const refundSignature = await signRefundRequest(refundParams, signerPrivateKey);

      const recipientWallet = getWallet(recipientPrivateKey);
      const gateway = getContract(gatewayAddress, PaymentGatewayABI, recipientWallet);

      await expect(
        gateway.refund(paymentId, token.address, amount, zeroAddress, merchantId, refundSignature, ZERO_PERMIT)
      ).rejects.toThrow();
    });
  });

  describe('Gasless Refund (Meta-Transaction)', () => {
    it('should process refund via forwarder meta-transaction', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('75', token.decimals);
      const paymentId = await executePayment(`ORDER_REFUND_GASLESS_${Date.now()}`, amount);

      const initialPayerBalance = await getTokenBalance(token.address, payerAddress);

      const refundParams: RefundParams = {
        originalPaymentId: paymentId,
        tokenAddress: token.address,
        amount,
        payerAddress,
        merchantId,
      };
      const refundSignature = await signRefundRequest(refundParams, signerPrivateKey);

      // Recipient (merchant) approves gateway for the refund amount
      // In meta-tx, _msgSender() = recipient (from ForwardRequest.from)
      await approveToken(token.address, gatewayAddress, amount, recipientPrivateKey);

      // Encode refund calldata
      const refundCalldata = encodeRefundFunctionData(
        paymentId,
        token.address,
        amount,
        payerAddress,
        merchantId,
        refundSignature
      );

      // Build ForwardRequest - from = recipient (merchant)
      // The forwarder will set _msgSender() to recipientAddress
      const relayerWallet = getWallet(relayerPrivateKey);
      const forwarder = getContract(forwarderAddress, ERC2771ForwarderABI, relayerWallet);

      const recipientNonce = await forwarder.nonces(recipientAddress);
      const forwardDeadline = getDeadline(1);

      const forwardRequest: ForwardRequest = {
        from: recipientAddress,
        to: gatewayAddress,
        value: 0n,
        gas: 500000n,
        nonce: recipientNonce,
        deadline: forwardDeadline,
        data: refundCalldata,
      };

      // Recipient signs the forward request (gasless for recipient)
      const forwardSignature = await signForwardRequest(
        forwardRequest,
        recipientPrivateKey,
        forwarderAddress,
        TEST_CHAIN_ID
      );

      const forwardRequestData = buildForwardRequestData(forwardRequest, forwardSignature);

      // Relayer submits meta-transaction
      const tx = await forwarder.execute(forwardRequestData);
      await tx.wait();

      // Verify refund completed
      const gateway = getContract(gatewayAddress, PaymentGatewayABI);
      const isRefunded = await gateway.refundedPayments(paymentId);
      expect(isRefunded).toBe(true);

      // Verify payer got tokens back
      const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
      expect(finalPayerBalance).toBe(initialPayerBalance + amount);
    });
  });

  describe('Payment-Refund Full Lifecycle', () => {
    it('should handle complete payment -> refund cycle with balance verification', async () => {
      if (!blockchainRunning) return;

      const amount = parseUnits('200', token.decimals);

      const initialPayerBalance = await getTokenBalance(token.address, payerAddress);
      const initialRecipientBalance = await getTokenBalance(token.address, recipientAddress);

      // Step 1: Execute payment (payer -> recipient)
      const paymentId = await executePayment(`ORDER_LIFECYCLE_${Date.now()}`, amount);

      // Verify payment deducted from payer, sent to recipient
      const afterPaymentPayerBalance = await getTokenBalance(token.address, payerAddress);
      const afterPaymentRecipientBalance = await getTokenBalance(token.address, recipientAddress);
      expect(afterPaymentPayerBalance).toBe(initialPayerBalance - amount);
      expect(afterPaymentRecipientBalance).toBe(initialRecipientBalance + amount);

      // Step 2: Execute refund (recipient -> payer)
      // Recipient uses the tokens they received from the payment
      await executeRefund(paymentId, amount);

      // Verify final balances
      const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
      const finalRecipientBalance = await getTokenBalance(token.address, recipientAddress);

      // Payer recovered the refund amount
      expect(finalPayerBalance).toBe(afterPaymentPayerBalance + amount);

      // Recipient balance back to initial (payment received, then refunded)
      expect(finalRecipientBalance).toBe(initialRecipientBalance);

      // Verify on-chain state
      const gateway = getContract(gatewayAddress, PaymentGatewayABI);
      const isRefunded = await gateway.refundedPayments(paymentId);
      expect(isRefunded).toBe(true);
    });
  });
});
