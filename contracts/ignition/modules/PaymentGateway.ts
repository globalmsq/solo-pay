import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deployment module for PaymentGateway contracts
 *
 * Deploys:
 * 1. ERC2771Forwarder - Trusted forwarder for meta-transactions
 * 2. PaymentGatewayV1 - Implementation contract
 * 3. ERC1967Proxy - Proxy contract pointing to implementation
 * 4. MockERC20 - Test token for local development
 */
const PaymentGatewayModule = buildModule("PaymentGateway", (m) => {
  // Get deployment parameters
  const owner = m.getParameter("owner", m.getAccount(0));

  // Deploy ERC2771Forwarder (OpenZeppelin's trusted forwarder)
  const forwarder = m.contract("ERC2771Forwarder", ["MSQPayForwarder"]);

  // Deploy PaymentGatewayV1 implementation (with trustedForwarder in constructor)
  const implementation = m.contract("PaymentGatewayV1", [forwarder]);

  // Encode initialization data (owner only - forwarder is set in constructor)
  const initData = m.encodeFunctionCall(implementation, "initialize", [
    owner,
  ]);

  // Deploy ERC1967Proxy
  const proxy = m.contract("ERC1967Proxy", [implementation, initData], {
    id: "PaymentGatewayProxy",
  });

  // Deploy MockERC20 for testing (only for local/testnet)
  const mockToken = m.contract("MockERC20", ["Test Token", "TEST", 18]);

  return {
    forwarder,
    implementation,
    proxy,
    mockToken,
  };
});

export default PaymentGatewayModule;
