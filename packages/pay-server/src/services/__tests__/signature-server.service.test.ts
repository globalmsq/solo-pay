import { describe, it, expect, beforeEach } from 'vitest';
import { recoverTypedDataAddress, keccak256, encodePacked } from 'viem';
import { ServerSigningService } from '../signature-server.service';

describe('ServerSigningService', () => {
  let serverSigningService: ServerSigningService;
  // Test private key (DO NOT use in production)
  const testPrivateKey =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
  const gatewayAddress = '0x1234567890123456789012345678901234567890' as const;
  const chainId = 31337;

  beforeEach(() => {
    serverSigningService = new ServerSigningService(testPrivateKey, chainId, gatewayAddress);
  });

  describe('initialization', () => {
    it('should initialize with valid config', () => {
      expect(serverSigningService).toBeDefined();
    });

    it('should throw error with invalid private key', () => {
      expect(
        () => new ServerSigningService('invalid' as `0x${string}`, chainId, gatewayAddress)
      ).toThrow('Invalid private key format');
    });

    it('should throw error with short private key', () => {
      expect(
        () => new ServerSigningService('0xabc' as `0x${string}`, chainId, gatewayAddress)
      ).toThrow('Invalid private key format');
    });

    it('should throw error with invalid chain ID', () => {
      expect(() => new ServerSigningService(testPrivateKey, 0, gatewayAddress)).toThrow(
        'Invalid chain ID'
      );
    });

    it('should throw error with negative chain ID', () => {
      expect(() => new ServerSigningService(testPrivateKey, -1, gatewayAddress)).toThrow(
        'Invalid chain ID'
      );
    });

    it('should throw error with invalid gateway address', () => {
      expect(
        () => new ServerSigningService(testPrivateKey, chainId, 'invalid' as `0x${string}`)
      ).toThrow('Invalid gateway address');
    });

    it('should throw error with short gateway address', () => {
      expect(
        () => new ServerSigningService(testPrivateKey, chainId, '0x1234' as `0x${string}`)
      ).toThrow('Invalid gateway address');
    });
  });

  describe('getDomain', () => {
    it('should return valid EIP-712 domain', () => {
      const domain = serverSigningService.getDomain();

      expect(domain).toBeDefined();
      expect(domain.name).toBe('MSQPayGateway');
      expect(domain.version).toBe('1');
      expect(domain.chainId).toBe(chainId);
      expect(domain.verifyingContract).toBe(gatewayAddress);
    });

    it('should return consistent domain on multiple calls', () => {
      const domain1 = serverSigningService.getDomain();
      const domain2 = serverSigningService.getDomain();

      expect(domain1).toEqual(domain2);
    });
  });

  describe('getPaymentRequestTypes', () => {
    it('should return PaymentRequest type definition', () => {
      const types = serverSigningService.getPaymentRequestTypes();

      expect(types).toBeDefined();
      expect(types.PaymentRequest).toBeDefined();
      expect(Array.isArray(types.PaymentRequest)).toBe(true);
    });

    it('should include all required fields', () => {
      const types = serverSigningService.getPaymentRequestTypes();
      const fieldNames = types.PaymentRequest.map((field) => field.name);

      expect(fieldNames).toContain('paymentId');
      expect(fieldNames).toContain('tokenAddress');
      expect(fieldNames).toContain('amount');
      expect(fieldNames).toContain('recipientAddress');
      expect(fieldNames).toContain('merchantId');
      expect(fieldNames).toContain('feeBps');
    });

    it('should have correct types for each field', () => {
      const types = serverSigningService.getPaymentRequestTypes();
      const fieldMap = Object.fromEntries(
        types.PaymentRequest.map((field) => [field.name, field.type])
      );

      expect(fieldMap.paymentId).toBe('bytes32');
      expect(fieldMap.tokenAddress).toBe('address');
      expect(fieldMap.amount).toBe('uint256');
      expect(fieldMap.recipientAddress).toBe('address');
      expect(fieldMap.merchantId).toBe('bytes32');
      expect(fieldMap.feeBps).toBe('uint16');
    });
  });

  describe('getSignerAddress', () => {
    it('should return the correct signer address', () => {
      const address = serverSigningService.getSignerAddress();

      expect(address).toBeDefined();
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      // Known address for the test private key (Hardhat account #0)
      expect(address.toLowerCase()).toBe('0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266');
    });
  });

  describe('merchantKeyToId', () => {
    it('should convert merchant key to bytes32', () => {
      const merchantKey = 'merchant_demo_001';
      const merchantId = ServerSigningService.merchantKeyToId(merchantKey);

      expect(merchantId).toBeDefined();
      expect(merchantId).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should return consistent hash for same key', () => {
      const merchantKey = 'merchant_demo_001';
      const merchantId1 = ServerSigningService.merchantKeyToId(merchantKey);
      const merchantId2 = ServerSigningService.merchantKeyToId(merchantKey);

      expect(merchantId1).toBe(merchantId2);
    });

    it('should return different hash for different keys', () => {
      const merchantId1 = ServerSigningService.merchantKeyToId('merchant_001');
      const merchantId2 = ServerSigningService.merchantKeyToId('merchant_002');

      expect(merchantId1).not.toBe(merchantId2);
    });

    it('should match keccak256 encoding', () => {
      const merchantKey = 'test_merchant';
      const expected = keccak256(encodePacked(['string'], [merchantKey]));
      const actual = ServerSigningService.merchantKeyToId(merchantKey);

      expect(actual).toBe(expected);
    });
  });

  describe('signPaymentRequest', () => {
    const validPaymentRequest = {
      paymentId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const,
      tokenAddress: '0x0000000000000000000000000000000000000001' as const,
      amount: 1000000n,
      recipientAddress: '0x0000000000000000000000000000000000000002' as const,
      merchantId: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as const,
      feeBps: 100,
    };

    it('should return a valid signature', async () => {
      const signature = await serverSigningService.signPaymentRequest(
        validPaymentRequest.paymentId,
        validPaymentRequest.tokenAddress,
        validPaymentRequest.amount,
        validPaymentRequest.recipientAddress,
        validPaymentRequest.merchantId,
        validPaymentRequest.feeBps
      );

      expect(signature).toBeDefined();
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/); // 65 bytes = 130 hex chars
    });

    it('should produce verifiable signature', async () => {
      const signature = await serverSigningService.signPaymentRequest(
        validPaymentRequest.paymentId,
        validPaymentRequest.tokenAddress,
        validPaymentRequest.amount,
        validPaymentRequest.recipientAddress,
        validPaymentRequest.merchantId,
        validPaymentRequest.feeBps
      );

      const recoveredAddress = await recoverTypedDataAddress({
        domain: serverSigningService.getDomain(),
        types: serverSigningService.getPaymentRequestTypes(),
        primaryType: 'PaymentRequest',
        message: validPaymentRequest,
        signature,
      });

      expect(recoveredAddress.toLowerCase()).toBe(
        serverSigningService.getSignerAddress().toLowerCase()
      );
    });

    it('should produce different signatures for different payment IDs', async () => {
      const signature1 = await serverSigningService.signPaymentRequest(
        validPaymentRequest.paymentId,
        validPaymentRequest.tokenAddress,
        validPaymentRequest.amount,
        validPaymentRequest.recipientAddress,
        validPaymentRequest.merchantId,
        validPaymentRequest.feeBps
      );

      const differentPaymentId =
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as const;
      const signature2 = await serverSigningService.signPaymentRequest(
        differentPaymentId,
        validPaymentRequest.tokenAddress,
        validPaymentRequest.amount,
        validPaymentRequest.recipientAddress,
        validPaymentRequest.merchantId,
        validPaymentRequest.feeBps
      );

      expect(signature1).not.toBe(signature2);
    });

    it('should produce different signatures for different amounts', async () => {
      const signature1 = await serverSigningService.signPaymentRequest(
        validPaymentRequest.paymentId,
        validPaymentRequest.tokenAddress,
        validPaymentRequest.amount,
        validPaymentRequest.recipientAddress,
        validPaymentRequest.merchantId,
        validPaymentRequest.feeBps
      );

      const signature2 = await serverSigningService.signPaymentRequest(
        validPaymentRequest.paymentId,
        validPaymentRequest.tokenAddress,
        2000000n, // Different amount
        validPaymentRequest.recipientAddress,
        validPaymentRequest.merchantId,
        validPaymentRequest.feeBps
      );

      expect(signature1).not.toBe(signature2);
    });

    it('should produce different signatures for different fee bps', async () => {
      const signature1 = await serverSigningService.signPaymentRequest(
        validPaymentRequest.paymentId,
        validPaymentRequest.tokenAddress,
        validPaymentRequest.amount,
        validPaymentRequest.recipientAddress,
        validPaymentRequest.merchantId,
        100 // 1%
      );

      const signature2 = await serverSigningService.signPaymentRequest(
        validPaymentRequest.paymentId,
        validPaymentRequest.tokenAddress,
        validPaymentRequest.amount,
        validPaymentRequest.recipientAddress,
        validPaymentRequest.merchantId,
        200 // 2%
      );

      expect(signature1).not.toBe(signature2);
    });

    it('should produce different signatures for different recipient addresses', async () => {
      const signature1 = await serverSigningService.signPaymentRequest(
        validPaymentRequest.paymentId,
        validPaymentRequest.tokenAddress,
        validPaymentRequest.amount,
        validPaymentRequest.recipientAddress,
        validPaymentRequest.merchantId,
        validPaymentRequest.feeBps
      );

      const signature2 = await serverSigningService.signPaymentRequest(
        validPaymentRequest.paymentId,
        validPaymentRequest.tokenAddress,
        validPaymentRequest.amount,
        '0x0000000000000000000000000000000000000003' as const,
        validPaymentRequest.merchantId,
        validPaymentRequest.feeBps
      );

      expect(signature1).not.toBe(signature2);
    });
  });
});
