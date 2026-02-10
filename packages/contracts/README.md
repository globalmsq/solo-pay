# Solo Pay Contracts

[English](README.md) | [한국어](README.ko.md)

Smart contract package for the Solo Pay payment system.

## Supported Networks

| Network          | Chain ID | Type        | RPC Fallback                      |
| ---------------- | -------- | ----------- | --------------------------------- |
| Hardhat Local    | 31337    | Development | localhost:8545                    |
| Polygon Amoy     | 80002    | Testnet     | rpc-amoy.polygon.technology       |
| Polygon          | 137      | Mainnet     | polygon-rpc.com                   |
| Ethereum Sepolia | 11155111 | Testnet     | rpc.sepolia.org                   |
| Ethereum         | 1        | Mainnet     | cloudflare-eth.com                |
| BNB Testnet      | 97       | Testnet     | data-seed-prebsc-1-s1.binance.org |
| BNB              | 56       | Mainnet     | bsc-dataseed.binance.org          |

## Installation

```bash
cd packages/contracts
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

### Deploy with Existing Forwarder

To deploy PaymentGateway with an existing ERC2771Forwarder (e.g., from external relayer service):

```bash
# 1. Remove existing deployment artifacts (if redeploying)
rm -rf ignition/deployments/chain-{CHAIN_ID}

# 2. Create parameters file
mkdir -p ignition/parameters
cat > ignition/parameters/network.json << EOF
{
  "PaymentGateway": {
    "forwarderAddress": "0xYourExistingForwarderAddress"
  }
}
EOF

# 3. Deploy with parameters
npx hardhat ignition deploy ignition/modules/PaymentGateway.ts \
  --network default \
  --parameters ignition/parameters/network.json
```

**Example for Polygon Amoy with msq-relayer-service Forwarder:**

```bash
# Set environment
export PRIVATE_KEY="0x..."
export RPC_URL="https://rpc-amoy.polygon.technology"
export CHAIN_ID=80002

# Create parameters for Amoy
cat > ignition/parameters/amoy.json << EOF
{
  "PaymentGateway": {
    "forwarderAddress": "0xE8a3C8e530dddd14e02DA1C81Df6a15f41ad78DE"
  }
}
EOF

# Deploy
npx hardhat ignition deploy ignition/modules/PaymentGateway.ts \
  --network default \
  --parameters ignition/parameters/amoy.json
```

### After Deployment

1. **Update database**: Update `gateway_address` and `forwarder_address` in `docker/init.sql`
2. **Update docker-compose**: Remove `GATEWAY_ADDRESS` and `FORWARDER_ADDRESS` from the `server` service, and update them in other services (e.g., `simple-relayer`) if needed
3. **Verify contract** (optional): `npx hardhat ignition verify chain-{CHAIN_ID}`

## Contract Verification

Verify source code on Block Explorer after deployment:

```bash
npx hardhat ignition verify chain-{CHAIN_ID}
```

## Deployed Contracts

### Polygon Amoy (Testnet)

| Contract            | Address                                      |
| ------------------- | -------------------------------------------- |
| PaymentGatewayProxy | `0x57F7E705d10e0e94DFB880fFaf58064210bAaf8d` |
| PaymentGatewayV1    | `0x6b08b0EaD9370605AC9F34A17897515aACa0954a` |
| ERC2771Forwarder    | `0xE8a3C8e530dddd14e02DA1C81Df6a15f41ad78DE` |
| SUT Token           | `0xE4C687167705Abf55d709395f92e254bdF5825a2` |

> [View on Polygonscan](https://amoy.polygonscan.com/address/0x57F7E705d10e0e94DFB880fFaf58064210bAaf8d)

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
├── PaymentGatewayV1.sol      # Payment Gateway (Upgradeable, EIP-712 signature verification)
├── PaymentGatewayProxy.sol   # UUPS Proxy Contract
├── interfaces/
│   └── IPaymentGateway.sol   # Payment Gateway Interface
└── mocks/
    └── MockERC20.sol         # ERC20 Token for Testing
```

### PaymentGatewayV1 Features

- **Server Signature Verification**: EIP-712 typed data signature verification
- **Treasury Model**: Fees sent to treasury, remainder to merchant recipient
- **Token Whitelist**: Optional token support enforcement
- **Gasless Support**: ERC2771 meta-transaction support
- **Upgradeable**: UUPS proxy pattern for future upgrades

## License

MIT License
