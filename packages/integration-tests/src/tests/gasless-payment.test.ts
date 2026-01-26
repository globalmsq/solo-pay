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

describe('Gasless Payment Integration', () => {
  const token = getToken('mockUSDT');
  const payerPrivateKey = HARDHAT_ACCOUNTS.payer.privateKey;
  const relayerPrivateKey = HARDHAT_ACCOUNTS.relayer.privateKey;
  const payerAddress = HARDHAT_ACCOUNTS.payer.address;
  // Treasury is set to merchant address (Account #2) during contract deployment
  const treasuryAddress = HARDHAT_ACCOUNTS.merchant.address;
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

  it('should complete a gasless payment via forwarder', async () => {
    const paymentId = generatePaymentId(`ORDER_GASLESS_${Date.now()}`);
    const amount = parseUnits('100', token.decimals);

    const initialPayerBalance = await getTokenBalance(token.address, payerAddress);
    const initialTreasuryBalance = await getTokenBalance(token.address, treasuryAddress);

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

    // OZ v5 ForwardRequestData struct (includes signature, excludes nonce)
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

    const gateway = getContract(gatewayAddress, PaymentGatewayABI);
    const isProcessed = await gateway.isPaymentProcessed(paymentId);
    expect(isProcessed).toBe(true);

    const finalPayerBalance = await getTokenBalance(token.address, payerAddress);
    const finalTreasuryBalance = await getTokenBalance(token.address, treasuryAddress);

    expect(finalPayerBalance).toBe(initialPayerBalance - amount);
    expect(finalTreasuryBalance).toBe(initialTreasuryBalance + amount);
  });

  it('should reject expired deadline', async () => {
    const paymentId = generatePaymentId(`ORDER_EXPIRED_${Date.now()}`);
    const amount = parseUnits('50', token.decimals);

    await approveToken(token.address, gatewayAddress, amount, payerPrivateKey);

    const data = encodePayFunctionData(paymentId, token.address, amount);
    const nonce = await getNonce(payerAddress);
    const expiredDeadline = BigInt(Math.floor(Date.now() / 1000) - 3600);

    const request: ForwardRequest = {
      from: payerAddress,
      to: gatewayAddress,
      value: 0n,
      gas: 500000n,
      nonce,
      deadline: expiredDeadline,
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

    await expect(forwarder.execute(requestData)).rejects.toThrow();
  });

  it('should reject invalid signature', async () => {
    const paymentId = generatePaymentId(`ORDER_INVALID_SIG_${Date.now()}`);
    const amount = parseUnits('50', token.decimals);

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

    // Sign with wrong key (relayer instead of payer)
    const wrongSignature = await signForwardRequest(request, relayerPrivateKey);

    const relayerWallet = getWallet(relayerPrivateKey);
    const forwarder = getContract(forwarderAddress, ERC2771ForwarderABI, relayerWallet);

    const requestData = {
      from: request.from,
      to: request.to,
      value: request.value,
      gas: request.gas,
      deadline: request.deadline,
      data: request.data,
      signature: wrongSignature,
    };

    await expect(forwarder.execute(requestData)).rejects.toThrow();
  });

  it('should reject replay attack (same nonce)', async () => {
    const paymentId1 = generatePaymentId(`ORDER_REPLAY_1_${Date.now()}`);
    const paymentId2 = generatePaymentId(`ORDER_REPLAY_2_${Date.now()}`);
    const amount = parseUnits('25', token.decimals);

    await approveToken(token.address, gatewayAddress, amount * 2n, payerPrivateKey);

    const nonce = await getNonce(payerAddress);
    const deadline = getDeadline(1);

    // First transaction
    const data1 = encodePayFunctionData(paymentId1, token.address, amount);
    const request1: ForwardRequest = {
      from: payerAddress,
      to: gatewayAddress,
      value: 0n,
      gas: 500000n,
      nonce,
      deadline,
      data: data1,
    };
    const signature1 = await signForwardRequest(request1, payerPrivateKey);

    const relayerWallet = getWallet(relayerPrivateKey);
    const forwarder = getContract(forwarderAddress, ERC2771ForwarderABI, relayerWallet);

    const requestData1 = {
      from: request1.from,
      to: request1.to,
      value: request1.value,
      gas: request1.gas,
      deadline: request1.deadline,
      data: request1.data,
      signature: signature1,
    };

    const tx = await forwarder.execute(requestData1);
    await tx.wait();

    // Second transaction with same nonce (replay attack)
    const data2 = encodePayFunctionData(paymentId2, token.address, amount);
    const request2: ForwardRequest = {
      from: payerAddress,
      to: gatewayAddress,
      value: 0n,
      gas: 500000n,
      nonce, // Same nonce as first transaction
      deadline,
      data: data2,
    };
    const signature2 = await signForwardRequest(request2, payerPrivateKey);

    const requestData2 = {
      from: request2.from,
      to: request2.to,
      value: request2.value,
      gas: request2.gas,
      deadline: request2.deadline,
      data: request2.data,
      signature: signature2,
    };

    await expect(forwarder.execute(requestData2)).rejects.toThrow();
  });
});
