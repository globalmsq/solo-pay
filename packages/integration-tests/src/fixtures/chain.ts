import { CONTRACT_ADDRESSES, TEST_CHAIN_ID } from '../setup/wallets';

export interface ChainFixture {
  chainId: number;
  name: string;
  rpcUrl: string;
  gatewayAddress: string;
  forwarderAddress: string;
}

export const TEST_CHAINS: Record<string, ChainFixture> = {
  hardhat: {
    chainId: TEST_CHAIN_ID,
    name: 'Hardhat',
    rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545',
    gatewayAddress: CONTRACT_ADDRESSES.paymentGateway,
    forwarderAddress: CONTRACT_ADDRESSES.forwarder,
  },
};

export function getChain(name: string = 'hardhat'): ChainFixture {
  const chain = TEST_CHAINS[name];
  if (!chain) {
    throw new Error(`Unknown chain: ${name}`);
  }
  return chain;
}
