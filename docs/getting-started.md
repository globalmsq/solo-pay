[English](getting-started.md) | [한국어](getting-started.ko.md)

# MSQPay - Getting Started

A blockchain payment gateway that enables integration for multiple stores

## What is MSQPay?

MSQPay is an ERC-20 token-based blockchain payment system. Store servers can create payments through the SDK, and users can pay via Direct Payment (paying gas fees directly) or Gasless Payment (gas fees subsidized).

**Key Features**:

- Smart contract as the single source of truth (Contract = Source of Truth)
- Support for both Direct Payment and Gasless Payment
- TypeScript SDK provided
- Complete separation between store servers and blockchain

## Get Started in 5 Minutes

### 1. Run Local Demo with Docker

```bash
# Start Docker Desktop (if not running)
# Docker Desktop must be installed and running

# Start Docker Compose
cd docker
docker-compose up -d

# Check service status
docker-compose ps
```

### 2. Access Services

| Service        | URL                   | Description      |
| -------------- | --------------------- | ---------------- |
| Demo App       | http://localhost:3000 | Frontend         |
| Payment Server | http://localhost:3001 | API Server       |
| Hardhat        | http://localhost:8545 | Local Blockchain |

### 3. Health Check

```bash
# Check Payment Server
curl http://localhost:3001/health

# Response: {"status":"ok","timestamp":"..."}
```

### 4. Next Steps

#### Store Developers

To integrate payment features into your store:

- [Integrate Payment](guides/integrate-payment.md) - SDK usage, Direct/Gasless payment implementation

#### Operators

To deploy payment server:

- [Deploy Server](guides/deploy-server.md) - Docker, environment variables, production checklist

#### Contributors

To contribute to the project:

- [Contribute Code](guides/contribute.md) - Local development setup, PR process

#### Reference

For detailed information:

- [API Reference](reference/api.md) - All API endpoints
- [SDK Reference](reference/sdk.md) - MSQPayClient methods
- [System Architecture](reference/architecture.md) - Complete system diagram
- [Error Codes](reference/errors.md) - Error codes and solutions

## System Architecture

```
Frontend → Store Server (SDK) → Payment Server (API) → Smart Contract
                                                        (Source of Truth)
```

## Core Principles

1. **Contract = Source of Truth**: Payment completion is only trusted from the smart contract
2. **Store Server ↔ Blockchain Separation**: Store servers only call Payment Server API, no direct blockchain access
3. **Server-Issued paymentId**: Payment server is the sole generator of paymentId

## Payment Methods

### Direct Payment

Users pay gas fees directly:

1. Store Server: Create payment with SDK
2. Frontend: Send transaction via Metamask
3. Store Server: Query payment status (polling)

### Gasless Payment

Service subsidizes gas fees:

1. Store Server: Create payment with SDK
2. Frontend: EIP-712 signature (no gas fees)
3. Store Server: Submit signature
4. Payment Server: Execute transaction through Forwarder

## Supported Networks

| Network                | Chain ID | Token |
| ---------------------- | -------- | ----- |
| Polygon Amoy (Testnet) | 80002    | SUT   |
| Hardhat (Local)        | 31337    | TEST  |

## Troubleshooting

### Docker Services Not Starting

```bash
# Check port conflicts
lsof -i :3306
lsof -i :3001

# Reset volumes and restart
docker-compose down -v
docker-compose up -d
```

### MySQL Permission Errors

```bash
# Restart MySQL
docker-compose restart mysql
```

### Cannot Connect to Hardhat

```bash
# Check Hardhat logs
docker-compose logs hardhat

# Restart Hardhat
docker-compose restart hardhat
```

## Additional Resources

- [DOCKER_TEST_GUIDE.md](../DOCKER_TEST_GUIDE.md) - Docker detailed guide
- [README.md](../README.md) - Project overview
