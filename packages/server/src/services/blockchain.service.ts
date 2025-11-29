import { createPublicClient, http, PublicClient, Address, Abi } from 'viem';
import { polygon } from 'viem/chains';
import { PaymentStatus } from '../schemas/payment.schema';

/**
 * 스마트 컨트랙트에서 반환되는 결제 데이터 인터페이스
 */
interface ContractPaymentData {
  userId: string;
  amount: bigint;
  currency: 'USD' | 'EUR' | 'KRW';
  tokenAddress: string;
  recipientAddress: string;
  status: number;
  transactionHash?: `0x${string}`;
  createdAt: bigint;
  updatedAt: bigint;
}

/**
 * 블록체인 서비스 - viem을 통한 스마트 컨트랙트 상호작용
 * 무상태 아키텍처: 모든 데이터는 스마트 컨트랙트에서 조회
 */
export class BlockchainService {
  private publicClient: PublicClient;
  private contractAddress: Address;
  private contractAbi: Abi;

  constructor(rpcUrl: string = 'https://polygon-rpc.com', contractAddress: string) {
    this.publicClient = createPublicClient({
      chain: polygon,
      transport: http(rpcUrl),
    });

    this.contractAddress = contractAddress as Address;
    // 실제 ABI는 .env에서 로드하거나 별도 파일에서 가져옴
    this.contractAbi = [] as Abi;
  }

  /**
   * 결제 정보를 스마트 컨트랙트에서 조회
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus | null> {
    try {
      // 스마트 컨트랙트에서 결제 데이터 조회
      const rawData = await this.publicClient.readContract({
        address: this.contractAddress,
        abi: this.contractAbi,
        functionName: 'getPayment',
        args: [paymentId],
      });

      if (!rawData) {
        return null;
      }

      // 타입 캐스팅
      const paymentData = rawData as unknown as ContractPaymentData;

      // 트랜잭션 수신 확인 조회
      const receipt = await this.publicClient.getTransactionReceipt({
        hash: paymentData.transactionHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
      }).catch(() => null);

      return {
        id: paymentId,
        userId: paymentData.userId,
        amount: Number(paymentData.amount),
        currency: paymentData.currency,
        tokenAddress: paymentData.tokenAddress,
        recipientAddress: paymentData.recipientAddress,
        status: this.mapContractStatusToEnum(paymentData.status),
        transactionHash: paymentData.transactionHash,
        blockNumber: receipt ? Number(receipt.blockNumber) : undefined,
        createdAt: new Date(Number(paymentData.createdAt) * 1000).toISOString(),
        updatedAt: new Date(Number(paymentData.updatedAt) * 1000).toISOString(),
      };
    } catch (error) {
      console.error('스마트 컨트랙트에서 결제 정보 조회 실패:', error);
      throw new Error('결제 정보를 조회할 수 없습니다');
    }
  }

  /**
   * 결제를 스마트 컨트랙트에 기록
   */
  async recordPaymentOnChain(paymentData: {
    userId: string;
    amount: bigint;
    currency: string;
    tokenAddress: Address;
    recipientAddress: Address;
    description?: string;
  }): Promise<string> {
    try {
      // 실제 구현에서는 트랜잭션 서명 및 전송
      // 여기서는 데이터 검증만 수행
      if (!paymentData.userId || !paymentData.amount || !paymentData.tokenAddress) {
        throw new Error('필수 결제 정보가 누락되었습니다');
      }

      // 트랜잭션 해시 반환 (실제로는 sendTransaction 결과)
      return '0x' + 'a'.repeat(64);
    } catch (error) {
      console.error('스마트 컨트랙트에 결제 기록 실패:', error);
      // 원본 에러 메시지를 그대로 전파하지 않고, 구체적인 메시지는 보존
      if (error instanceof Error && error.message === '필수 결제 정보가 누락되었습니다') {
        throw error;
      }
      throw new Error('결제를 기록할 수 없습니다');
    }
  }

  /**
   * 계약의 상태 값을 enum으로 매핑
   */
  private mapContractStatusToEnum(
    status: number
  ): 'pending' | 'confirmed' | 'failed' | 'completed' {
    const statusMap: Record<number, 'pending' | 'confirmed' | 'failed' | 'completed'> = {
      0: 'pending',
      1: 'confirmed',
      2: 'failed',
      3: 'completed',
    };
    return statusMap[status] || 'pending';
  }

  /**
   * 트랜잭션 수신 확인 확인
   */
  async waitForConfirmation(
    transactionHash: string,
    _confirmations: number = 1
  ): Promise<{ status: string; blockNumber: bigint; transactionHash: string } | null> {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: transactionHash as `0x${string}`,
        confirmations: _confirmations,
      });
      return {
        status: receipt.status === 'success' ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.transactionHash,
      };
    } catch (error) {
      console.error('트랜잭션 확인 대기 실패:', error);
      return null;
    }
  }

  /**
   * 가스 비용 추정
   */
  async estimateGasCost(
    _tokenAddress: Address,
    _amount: bigint,
    _recipientAddress: Address
  ): Promise<bigint> {
    try {
      // 실제 구현에서는 eth_estimateGas 호출
      // 여기서는 고정 값 반환 (파라미터는 향후 실제 추정에 사용)
      return BigInt('200000');
    } catch (error) {
      console.error('가스 비용 추정 실패:', error);
      throw new Error('가스 비용을 추정할 수 없습니다');
    }
  }
}
