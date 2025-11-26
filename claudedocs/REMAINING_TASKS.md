# MSQ Pay Onchain - Remaining Tasks

Last Updated: 2025-11-26
Status: MVP Local Development Complete

## Current State

### Completed Work
- [x] Smart Contracts (PaymentGateway, UUPS Proxy, ERC2771Forwarder)
- [x] OpenZeppelin v5 compatibility fixes
- [x] 16 unit tests passing
- [x] Local deployment working (Hardhat Ignition)
- [x] SDK package structure with constants
- [x] Demo App with RainbowKit wallet connection
- [x] Chain-aware token selection (TEST on localhost, SUT on Amoy)
- [x] Direct payment flow (Approve + Pay) working
- [x] Git repository initialized with initial commit

### Deployed Addresses (localhost - chainId 31337)
```
Gateway Proxy: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
Forwarder:     0x5FbDB2315678afecb367f032d93F642f64180aa3
MockERC20:     0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

---

## Remaining Tasks

### Priority 1: Gasless Payment Implementation

**Location**: `apps/demo/src/components/PaymentModal.tsx:196-204`

**Current State**: TODO placeholder in `handleGaslessPayment()`

**Implementation Steps**:
1. Get nonce from ERC2771Forwarder contract
2. Create EIP-712 typed data structure for ForwardRequest
3. Request signature from user via wallet
4. Submit signed request to Forwarder contract (local test)
5. Later: Submit to OZ Defender Relayer (production)

**EIP-712 TypedData Structure**:
```typescript
const ForwardRequest = {
  types: {
    ForwardRequest: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'gas', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint48' },
      { name: 'data', type: 'bytes' },
    ],
  },
  primaryType: 'ForwardRequest',
  domain: {
    name: 'ERC2771Forwarder',
    version: '1',
    chainId: chainId,
    verifyingContract: forwarderAddress,
  },
};
```

**Files to Modify**:
- `apps/demo/src/components/PaymentModal.tsx` - Add meta-tx signing
- `packages/sdk/src/index.ts` - Add `signMetaTransaction()` helper

---

### Priority 2: Polygon Amoy Testnet Deployment

**Prerequisites**:
- Polygon Amoy MATIC for gas (faucet: https://faucet.polygon.technology/)
- Private key for deployer account

**Steps**:
1. Add Amoy network config to `contracts/hardhat.config.ts`:
   ```typescript
   networks: {
     amoy: {
       url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
       accounts: [process.env.PRIVATE_KEY],
       chainId: 80002,
     },
   },
   ```

2. Create `.env` file with:
   ```
   PRIVATE_KEY=your_deployer_private_key
   AMOY_RPC_URL=https://rpc-amoy.polygon.technology
   POLYGONSCAN_API_KEY=your_api_key
   ```

3. Deploy:
   ```bash
   cd contracts
   npx hardhat ignition deploy ignition/modules/PaymentGateway.ts --network amoy
   ```

4. Verify on Polygonscan:
   ```bash
   npx hardhat verify --network amoy <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
   ```

5. Update SDK constants with deployed addresses:
   - `packages/sdk/src/constants.ts` - POLYGON_AMOY contracts

---

### Priority 3: OpenZeppelin Defender Setup

**Purpose**: Relay gasless transactions to pay gas on behalf of users

**Steps**:
1. Create OZ Defender account: https://defender.openzeppelin.com/
2. Create a new Relayer for Polygon Amoy
3. Fund the Relayer with MATIC
4. Get API Key and Secret
5. Create Autotask or use Relay API directly

**Environment Variables**:
```
OZ_DEFENDER_API_KEY=your_api_key
OZ_DEFENDER_API_SECRET=your_api_secret
OZ_DEFENDER_RELAYER_ID=your_relayer_id
```

**Files to Create**:
- `apps/demo/src/lib/defender.ts` - OZ Defender client
- `apps/demo/api/relay/route.ts` - API route for relay submission

---

### Priority 4: Subgraph Deployment

**Location**: `subgraph/` directory

**Purpose**: Index payment events for Payment History feature

**Steps**:
1. Install Graph CLI:
   ```bash
   npm install -g @graphprotocol/graph-cli
   ```

2. Authenticate with The Graph Studio:
   ```bash
   graph auth --studio <DEPLOY_KEY>
   ```

3. Update `subgraph/subgraph.yaml` with deployed contract addresses

4. Generate code and build:
   ```bash
   cd subgraph
   graph codegen
   graph build
   ```

5. Deploy to The Graph Studio:
   ```bash
   graph deploy --studio msq-pay
   ```

**Schema** (`subgraph/schema.graphql`):
```graphql
type Payment @entity {
  id: ID!
  paymentId: Bytes!
  payer: Bytes!
  merchant: Bytes!
  token: Bytes!
  amount: BigInt!
  timestamp: BigInt!
  blockNumber: BigInt!
  transactionHash: Bytes!
}
```

---

### Priority 5: Payment History Integration

**Location**: `apps/demo/src/components/PaymentHistory.tsx`

**Current State**: Component exists but needs Subgraph integration

**Steps**:
1. Install GraphQL client:
   ```bash
   cd apps/demo
   pnpm add graphql-request graphql
   ```

2. Create Subgraph client:
   ```typescript
   // apps/demo/src/lib/subgraph.ts
   import { GraphQLClient, gql } from 'graphql-request';

   const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/<ID>/msq-pay/v0.0.1';

   export const subgraphClient = new GraphQLClient(SUBGRAPH_URL);

   export const GET_PAYMENTS = gql`
     query GetPayments($payer: Bytes!) {
       payments(where: { payer: $payer }, orderBy: timestamp, orderDirection: desc) {
         id
         paymentId
         merchant
         token
         amount
         timestamp
         transactionHash
       }
     }
   `;
   ```

3. Update PaymentHistory component to fetch real data

---

### Priority 6: SDK Meta-Transaction Support

**Location**: `packages/sdk/src/`

**Files to Create/Modify**:
- `packages/sdk/src/meta-tx.ts` - Meta-transaction signing utilities
- `packages/sdk/src/index.ts` - Export meta-tx functions

**Functions to Implement**:
```typescript
// Create typed data for signing
export function createForwardRequestTypedData(
  chainId: number,
  forwarderAddress: Address,
  request: ForwardRequest
): TypedData;

// Sign forward request
export async function signForwardRequest(
  walletClient: WalletClient,
  typedData: TypedData
): Promise<Hex>;

// Submit to relay
export async function submitToRelay(
  signedRequest: SignedForwardRequest,
  relayUrl: string
): Promise<string>;
```

---

## Quick Start Commands

### Resume Local Development
```bash
# Terminal 1: Start Hardhat node
cd /Users/harry/Work/mufin/msq-pay-onchain/contracts
npx hardhat node

# Terminal 2: Deploy contracts
cd /Users/harry/Work/mufin/msq-pay-onchain/contracts
pnpm deploy:local

# Terminal 3: Start Demo App
cd /Users/harry/Work/mufin/msq-pay-onchain/apps/demo
pnpm dev
```

### Mint TEST Tokens (in Hardhat console)
```bash
cd /Users/harry/Work/mufin/msq-pay-onchain/contracts
npx hardhat console --network localhost
```
```javascript
const [owner] = await ethers.getSigners()
const token = await ethers.getContractAt("MockERC20", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512")
await token.mint(owner.address, ethers.parseEther("1000"))
```

### Run Tests
```bash
cd /Users/harry/Work/mufin/msq-pay-onchain/contracts
pnpm test
```

---

## Architecture Reference

```
msq-pay-onchain/
├── contracts/           # Solidity smart contracts (Hardhat)
│   ├── src/
│   │   ├── PaymentGateway.sol      # Main payment contract (UUPS)
│   │   ├── PaymentGatewayStorage.sol
│   │   └── utils/
│   │       └── ForwarderImport.sol # ERC2771Forwarder import
│   ├── ignition/modules/           # Deployment modules
│   └── test/                       # Foundry tests
├── packages/
│   └── sdk/             # TypeScript SDK
│       └── src/
│           └── constants.ts        # Contract addresses & tokens
├── apps/
│   └── demo/            # Next.js Demo Application
│       └── src/
│           ├── app/page.tsx
│           ├── components/
│           │   ├── PaymentModal.tsx  # Payment flow
│           │   ├── ProductCard.tsx
│           │   └── PaymentHistory.tsx
│           └── lib/wagmi.ts          # Chain config & helpers
└── subgraph/            # The Graph indexer
    ├── schema.graphql
    └── src/mapping.ts
```

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @openzeppelin/contracts | ^5.0.0 | Smart contract base |
| @openzeppelin/contracts-upgradeable | ^5.0.0 | UUPS proxy |
| hardhat | ^2.22.0 | Development framework |
| wagmi | ^2.x | React Ethereum hooks |
| @rainbow-me/rainbowkit | ^2.x | Wallet connection |
| viem | ^2.x | Ethereum utilities |
