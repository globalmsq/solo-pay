# MSQ Pay Contracts

[English](README.md) | [한국어](README.ko.md)

Smart contract package for the MSQ Pay payment system.

## Supported Networks

| Network | Chain ID | Type | RPC Fallback |
|---------|----------|------|--------------|
| Hardhat Local | 31337 | Development | localhost:8545 |
| Polygon Amoy | 80002 | Testnet | rpc-amoy.polygon.technology |
| Polygon | 137 | Mainnet | polygon-rpc.com |
| Ethereum Sepolia | 11155111 | Testnet | rpc.sepolia.org |
| Ethereum | 1 | Mainnet | cloudflare-eth.com |
| BNB Testnet | 97 | Testnet | data-seed-prebsc-1-s1.binance.org |
| BNB | 56 | Mainnet | bsc-dataseed.binance.org |

## Installation

```bash
cd contracts
pnpm install
```

## Environment Setup

1. Copy `.env.example` to create `.env` file:

```bash
cp .env.example .env
```

2. Set required values in `.env` file:

```bash
# Private key for deployment (Never commit real keys!)
PRIVATE_KEY=0x...

# Network configuration (Set according to deployment chain)
RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002

# Block Explorer API Key (Etherscan API v2)
# Single API key supports 60+ chains
ETHERSCAN_API_KEY=your-etherscan-api-key
```

## Compilation

```bash
pnpm compile
```

## Testing

```bash
# Run all tests
pnpm test

# Coverage report
pnpm test:coverage
```

## Deployment

### Local Development Environment

```bash
# Start Hardhat node (separate terminal)
npx hardhat node

# Local deployment
npx hardhat ignition deploy ./ignition/modules/PaymentGateway.ts --network localhost
```

### Network Deployment

Set `RPC_URL` and `CHAIN_ID` in `.env` file, then deploy:

```bash
npx hardhat ignition deploy ./ignition/modules/PaymentGateway.ts --network default
```

## Contract Verification

Verify source code on Block Explorer after deployment:

```bash
npx hardhat ignition verify chain-{CHAIN_ID}
```

## Deployed Contracts

### Polygon Amoy (Testnet)

| Contract | Address |
|----------|---------|
| PaymentGatewayProxy | `0x2256bedB57869AF4fadF16e1ebD534A7d47513d7` |
| PaymentGatewayV1 | `0xDc40C3735163fEd63c198c3920B65B66DB54b1Bf` |
| ERC2771Forwarder | `0x0d9A0fAf9a8101368aa01B88442B38f82180520E` |
| SUT Token | `0xE4C687167705Abf55d709395f92e254bdF5825a2` |

> [View on Polygonscan](https://amoy.polygonscan.com/address/0x2256bedB57869AF4fadF16e1ebD534A7d47513d7)

## Deployment Results

Deployed contract addresses are saved in `ignition/deployments/chain-{CHAIN_ID}/deployed_addresses.json`.

## Deployment Checklist

### Before Testnet Deployment

- [ ] Set `PRIVATE_KEY` in `.env` file
- [ ] Ensure deployment wallet has test tokens (use Faucet)
  - Polygon Amoy: [Polygon Faucet](https://faucet.polygon.technology/)
  - Sepolia: [Sepolia Faucet](https://sepoliafaucet.com/)
  - BNB Testnet: [BNB Faucet](https://testnet.bnbchain.org/faucet-smart)
- [ ] Set Explorer API key for contract verification

### Before Mainnet Deployment

- [ ] Complete sufficient testing on Testnet
- [ ] Ensure deployment wallet has sufficient native tokens
- [ ] Complete security audit (recommended)
- [ ] Set up multi-sig wallet (recommended)

## Contract Structure

```
src/
├── PaymentGatewayV1.sol      # Payment Gateway (Upgradeable)
├── PaymentGatewayProxy.sol   # Proxy Contract
└── mocks/
    └── MockERC20.sol         # ERC20 Token for Testing
```

## License

MIT License
