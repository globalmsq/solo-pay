import { ethers, Wallet, Interface } from 'ethers';
import { CONTRACT_ADDRESSES, TEST_CHAIN_ID } from '../setup/wallets';
import { PaymentGatewayABI, getProvider } from './blockchain';

export interface ForwardRequest {
  from: string;
  to: string;
  value: bigint;
  gas: bigint;
  nonce: bigint;
  deadline: bigint;
  data: string;
}

export interface ForwardRequestData {
  from: string;
  to: string;
  value: bigint;
  gas: bigint;
  deadline: bigint;
  data: string;
  signature: string;
}

const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint48' },
    { name: 'data', type: 'bytes' },
  ],
};

export function getEIP712Domain(forwarderAddress: string, chainId: number = TEST_CHAIN_ID) {
  return {
    name: 'MSQForwarder',
    version: '1',
    chainId: chainId,
    verifyingContract: forwarderAddress,
  };
}

export async function signForwardRequest(
  request: ForwardRequest,
  privateKey: string,
  forwarderAddress: string = CONTRACT_ADDRESSES.forwarder,
  chainId: number = TEST_CHAIN_ID
): Promise<string> {
  const provider = getProvider();
  const wallet = new Wallet(privateKey, provider);
  const domain = getEIP712Domain(forwarderAddress, chainId);

  const message = {
    from: request.from,
    to: request.to,
    value: request.value,
    gas: request.gas,
    nonce: request.nonce,
    deadline: request.deadline,
    data: request.data,
  };

  const signature = await wallet.signTypedData(domain, FORWARD_REQUEST_TYPES, message);
  return signature;
}

export function encodePayFunctionData(
  paymentId: string,
  tokenAddress: string,
  amount: bigint
): string {
  const iface = new Interface(PaymentGatewayABI);
  return iface.encodeFunctionData('pay', [paymentId, tokenAddress, amount]);
}

export function generatePaymentId(orderId: string): string {
  return ethers.id(orderId);
}

export function buildForwardRequestData(
  request: ForwardRequest,
  signature: string
): ForwardRequestData {
  return {
    from: request.from,
    to: request.to,
    value: request.value,
    gas: request.gas,
    deadline: request.deadline,
    data: request.data,
    signature,
  };
}

export function getDeadline(hoursFromNow: number = 1): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + hoursFromNow * 3600);
}
