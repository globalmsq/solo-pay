import { ethers, JsonRpcProvider, Wallet, Contract, parseUnits, formatUnits } from 'ethers';
import { HARDHAT_ACCOUNTS } from '../setup/wallets';

// Import ABIs from contracts package
import PaymentGatewayArtifact from '@msq/pay-contracts/artifacts/src/PaymentGatewayV1.sol/PaymentGatewayV1.json';
import MockERC20Artifact from '@msq/pay-contracts/artifacts/src/mocks/MockERC20.sol/MockERC20.json';
import ERC2771ForwarderArtifact from '@msq/pay-contracts/artifacts/@openzeppelin/contracts/metatx/ERC2771Forwarder.sol/ERC2771Forwarder.json';

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8546';

// Export ABIs for use in tests
export const PaymentGatewayABI = PaymentGatewayArtifact.abi;
export const MockERC20ABI = MockERC20Artifact.abi;
export const ERC2771ForwarderABI = ERC2771ForwarderArtifact.abi;

/**
 * Create a new provider instance.
 * Note: Each call creates a new provider to avoid nonce caching issues
 * when running multiple tests sequentially.
 */
export function getProvider(): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URL);
}

/**
 * Create a wallet connected to a fresh provider.
 * This ensures each transaction gets the latest nonce from the network.
 */
export function getWallet(privateKey: string): Wallet {
  const provider = getProvider();
  return new Wallet(privateKey, provider);
}

export function getContract(
  address: string,
  abi: ethers.InterfaceAbi,
  signerOrProvider?: Wallet | JsonRpcProvider
): Contract {
  return new Contract(address, abi, signerOrProvider || getProvider());
}

export async function getTokenBalance(
  tokenAddress: string,
  accountAddress: string
): Promise<bigint> {
  const token = getContract(tokenAddress, MockERC20ABI);
  return token.balanceOf(accountAddress);
}

export async function getTokenAllowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<bigint> {
  const token = getContract(tokenAddress, MockERC20ABI);
  return token.allowance(ownerAddress, spenderAddress);
}

export async function approveToken(
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint,
  privateKey: string
): Promise<string> {
  const wallet = getWallet(privateKey);
  const token = getContract(tokenAddress, MockERC20ABI, wallet);
  const tx = await token.approve(spenderAddress, amount);
  await tx.wait();
  return tx.hash;
}

export async function mintTokens(
  tokenAddress: string,
  toAddress: string,
  amount: bigint,
  privateKey: string = HARDHAT_ACCOUNTS.deployer.privateKey
): Promise<string> {
  const wallet = getWallet(privateKey);
  const token = getContract(tokenAddress, MockERC20ABI, wallet);
  const tx = await token.mint(toAddress, amount);
  await tx.wait();
  return tx.hash;
}

export async function waitForTransaction(hash: string): Promise<void> {
  const provider = getProvider();
  await provider.waitForTransaction(hash);
}

export { parseUnits, formatUnits, ethers };
