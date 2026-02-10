import { describe, it, expect, beforeAll } from 'vitest';
import {
  getProvider,
  getContract,
  PaymentGatewayABI,
  MockERC20ABI,
  ERC2771ForwarderABI,
} from '../helpers/blockchain';
import { CONTRACT_ADDRESSES, HARDHAT_ACCOUNTS } from '../setup/wallets';
import { getToken } from '../fixtures/token';

describe('Contract Deployment Verification', () => {
  const provider = getProvider();
  let blockchainRunning = false;

  // Check if blockchain node is running
  async function checkBlockchain(): Promise<boolean> {
    try {
      await provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  beforeAll(async () => {
    blockchainRunning = await checkBlockchain();
    if (!blockchainRunning) {
      console.warn(
        '\n⚠️  Hardhat node is not running. Contract deployment tests will be skipped.\n' +
          '   Run: pnpm --filter @globalmsq/integration-tests test:setup\n'
      );
    }
  });

  describe('ERC2771Forwarder', () => {
    const forwarderAddress = CONTRACT_ADDRESSES.forwarder;

    it('should have code deployed at forwarder address', async () => {
      if (!blockchainRunning) return;

      const code = await provider.getCode(forwarderAddress);
      expect(code).not.toBe('0x');
      expect(code.length).toBeGreaterThan(2);
    });

    it('should have correct EIP-712 domain name', async () => {
      if (!blockchainRunning) return;

      const forwarder = getContract(forwarderAddress, ERC2771ForwarderABI);
      const domain = await forwarder.eip712Domain();
      expect(domain[1]).toBe('SoloForwarder');
      expect(domain[2]).toBe('1');
    });

    it('should return nonce for address', async () => {
      if (!blockchainRunning) return;

      const forwarder = getContract(forwarderAddress, ERC2771ForwarderABI);
      const nonce = await forwarder.nonces(HARDHAT_ACCOUNTS.payer.address);
      expect(typeof nonce).toBe('bigint');
    });
  });

  describe('MockERC20 Token', () => {
    const token = getToken('test');

    it('should have code deployed at token address', async () => {
      if (!blockchainRunning) return;

      const code = await provider.getCode(token.address);
      expect(code).not.toBe('0x');
      expect(code.length).toBeGreaterThan(2);
    });

    it('should have correct symbol', async () => {
      if (!blockchainRunning) return;

      const tokenContract = getContract(token.address, MockERC20ABI);
      const symbol = await tokenContract.symbol();
      expect(symbol).toBe(token.symbol);
    });

    it('should have correct decimals', async () => {
      if (!blockchainRunning) return;

      const tokenContract = getContract(token.address, MockERC20ABI);
      const decimals = await tokenContract.decimals();
      expect(Number(decimals)).toBe(token.decimals);
    });

    it('should have mint function available (mock token)', () => {
      const tokenContract = getContract(token.address, MockERC20ABI);
      expect(typeof tokenContract.mint).toBe('function');
    });
  });

  describe('PaymentGatewayV1 (Proxy)', () => {
    const gatewayAddress = CONTRACT_ADDRESSES.paymentGateway;
    const forwarderAddress = CONTRACT_ADDRESSES.forwarder;

    it('should have code deployed at gateway proxy address', async () => {
      if (!blockchainRunning) return;

      const code = await provider.getCode(gatewayAddress);
      expect(code).not.toBe('0x');
      expect(code.length).toBeGreaterThan(2);
    });

    it('should have correct trusted forwarder set', async () => {
      if (!blockchainRunning) return;

      const gateway = getContract(gatewayAddress, PaymentGatewayABI);
      const trustedForwarder = await gateway.getTrustedForwarder();
      expect(trustedForwarder.toLowerCase()).toBe(forwarderAddress.toLowerCase());
    });

    it('should have correct owner (deployer)', async () => {
      if (!blockchainRunning) return;

      const gateway = getContract(gatewayAddress, PaymentGatewayABI);
      const owner = await gateway.owner();
      expect(owner.toLowerCase()).toBe(HARDHAT_ACCOUNTS.deployer.address.toLowerCase());
    });

    it('should have token whitelist disabled by default', async () => {
      if (!blockchainRunning) return;

      const gateway = getContract(gatewayAddress, PaymentGatewayABI);
      const enforceWhitelist = await gateway.enforceTokenWhitelist();
      expect(enforceWhitelist).toBe(false);
    });

    it('should have isPaymentProcessed return false for unused payment ID', async () => {
      if (!blockchainRunning) return;

      const gateway = getContract(gatewayAddress, PaymentGatewayABI);
      const unusedPaymentId = '0x' + '00'.repeat(32);
      const isProcessed = await gateway.isPaymentProcessed(unusedPaymentId);
      expect(isProcessed).toBe(false);
    });

    it('should have pay function available', () => {
      const gateway = getContract(gatewayAddress, PaymentGatewayABI);
      expect(typeof gateway.pay).toBe('function');
    });

    it('should have setSupportedToken function available', () => {
      const gateway = getContract(gatewayAddress, PaymentGatewayABI);
      expect(typeof gateway.setSupportedToken).toBe('function');
    });
  });

  describe('Contract Relationships', () => {
    it('should have gateway trust the forwarder', async () => {
      if (!blockchainRunning) return;

      const gateway = getContract(CONTRACT_ADDRESSES.paymentGateway, PaymentGatewayABI);
      const trustedForwarder = await gateway.getTrustedForwarder();
      expect(trustedForwarder.toLowerCase()).toBe(CONTRACT_ADDRESSES.forwarder.toLowerCase());
    });

    it('should have all contract addresses be different', () => {
      const addresses = [
        CONTRACT_ADDRESSES.forwarder,
        CONTRACT_ADDRESSES.mockToken,
        CONTRACT_ADDRESSES.paymentGateway,
      ];

      const uniqueAddresses = new Set(addresses.map((a) => a.toLowerCase()));
      expect(uniqueAddresses.size).toBe(addresses.length);
    });

    it('should have all contract addresses be non-zero', () => {
      const zeroAddress = '0x0000000000000000000000000000000000000000';

      expect(CONTRACT_ADDRESSES.forwarder.toLowerCase()).not.toBe(zeroAddress);
      expect(CONTRACT_ADDRESSES.mockToken.toLowerCase()).not.toBe(zeroAddress);
      expect(CONTRACT_ADDRESSES.paymentGateway.toLowerCase()).not.toBe(zeroAddress);
    });
  });

  describe('UUPS Proxy Verification', () => {
    it('should have implementation slot set (ERC1967)', async () => {
      if (!blockchainRunning) return;

      const IMPLEMENTATION_SLOT =
        '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
      const implAddress = await provider.getStorage(
        CONTRACT_ADDRESSES.paymentGateway,
        IMPLEMENTATION_SLOT
      );
      expect(implAddress).not.toBe('0x' + '00'.repeat(32));
    });

    it('should have admin slot empty (UUPS has no admin)', async () => {
      if (!blockchainRunning) return;

      const ADMIN_SLOT = '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
      const adminAddress = await provider.getStorage(CONTRACT_ADDRESSES.paymentGateway, ADMIN_SLOT);
      expect(adminAddress).toBe('0x' + '00'.repeat(32));
    });
  });
});
