import { PrismaClient } from '@prisma/client';
import { createWalletClient, http, defineChain, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { BlockchainService } from './blockchain.service';
import { ChainService } from './chain.service';
import { createLogger } from '../lib/logger';

/** Gas units for a typical ERC20 approve. */
const APPROVE_GAS = 46_000n;

/** Safety margin multiplier (1.5x) for gas amount. */
const SAFETY_MARGIN_NUM = 15n;
const SAFETY_MARGIN_DEN = 10n;

/**
 * Gas Faucet Service – sends native token to a wallet for approve transaction gas.
 *
 * Grant amount: approveGas(46,000) × current gasPrice × 1.5.
 * Records each grant in WalletGasGrant (one per wallet per chain).
 *
 * Relayer/faucet wallet: set GAS_FAUCET_PRIVATE_KEY (0x-prefixed hex). If unset, grant will throw.
 */
export class GasFaucetService {
  private readonly logger = createLogger('GasFaucetService');

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly chainService: ChainService,
    private readonly prisma: PrismaClient
  ) {}

  /**
   * Checks if a grant already exists for this wallet + chain.
   */
  async hasGrant(walletAddress: string, chainId: number): Promise<boolean> {
    const existing = await this.prisma.walletGasGrant.findUnique({
      where: {
        wallet_address_chain_id: {
          wallet_address: walletAddress as Address,
          chain_id: chainId,
        },
      },
    });
    return existing != null;
  }

  /**
   * Sends native token (gas) to the wallet and records the grant.
   * Caller must ensure: no existing grant, token balance >= payment amount, native balance < approve gas cost.
   *
   * @returns Transaction hash of the native transfer
   */
  async grantGas(walletAddress: string, chainId: number): Promise<{ txHash: string }> {
    const faucetKey = process.env.GAS_FAUCET_PRIVATE_KEY;
    if (!faucetKey || !faucetKey.startsWith('0x')) {
      this.logger.warn('GAS_FAUCET_PRIVATE_KEY not set or invalid; cannot send gas');
      throw new Error('Gas faucet not configured');
    }

    const existing = await this.prisma.walletGasGrant.findUnique({
      where: {
        wallet_address_chain_id: {
          wallet_address: walletAddress as Address,
          chain_id: chainId,
        },
      },
    });
    if (existing) {
      throw new Error('Gas already granted for this wallet and chain');
    }

    if (!this.blockchainService.isChainSupported(chainId)) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    const gasPrice = await this.blockchainService.getGasPrice(chainId);
    const amountWei = (APPROVE_GAS * gasPrice * SAFETY_MARGIN_NUM) / SAFETY_MARGIN_DEN;

    const chain = await this.chainService.findByNetworkId(chainId);
    if (!chain) {
      throw new Error(`Chain not found: ${chainId}`);
    }

    const chainDef = defineChain({
      id: chain.network_id,
      name: chain.name,
      nativeCurrency: { name: 'Native', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [chain.rpc_url] } },
    });

    const account = privateKeyToAccount(faucetKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: chainDef,
      transport: http(chain.rpc_url),
    });

    const hash = await walletClient.sendTransaction({
      to: walletAddress as Address,
      value: amountWei,
    });

    await this.prisma.walletGasGrant.create({
      data: {
        wallet_address: walletAddress,
        chain_id: chainId,
        amount: amountWei.toString(),
        tx_hash: hash,
      },
    });

    this.logger.info(
      { walletAddress, chainId, amountWei: amountWei.toString(), txHash: hash },
      'Gas grant sent'
    );

    return { txHash: hash };
  }
}
