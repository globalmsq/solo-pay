import { ethers } from "hardhat";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Get deployed contract address from Ignition deployment artifacts.
 */
function getDeployedAddress(contractId: string): string | null {
  const deploymentPath = path.join(
    __dirname,
    "../ignition/deployments/chain-31337/deployed_addresses.json"
  );

  if (fs.existsSync(deploymentPath)) {
    const addresses = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    if (addresses[contractId]) {
      return addresses[contractId];
    }
  }

  return null;
}

/**
 * Check if a contract exists on-chain at the given address.
 */
async function isContractDeployed(address: string): Promise<boolean> {
  const code = await ethers.provider.getCode(address);
  return code !== "0x";
}

/**
 * Write temporary Ignition parameters file for PaymentGateway deployment.
 */
function writeIgnitionParameters(forwarderAddress: string): string {
  const paramsPath = path.join(__dirname, "../ignition/parameters/temp-deploy.json");
  const paramsDir = path.dirname(paramsPath);

  if (!fs.existsSync(paramsDir)) {
    fs.mkdirSync(paramsDir, { recursive: true });
  }

  const params = {
    PaymentGateway: {
      forwarderAddress: forwarderAddress
    }
  };

  fs.writeFileSync(paramsPath, JSON.stringify(params, null, 2));
  return paramsPath;
}

/**
 * Environment variable based selective deployment.
 *
 * Deployment Order (to ensure consistent addresses):
 * 1. Forwarder (nonce 0) - skip if FORWARDER_ADDRESS is set
 * 2. MockERC20 (nonce 1) - skip if TOKEN_ADDRESS is set
 * 3. PaymentGateway (nonce 2-3) - always deploy if not present
 *
 * This order matches msq-relayer-service deployment:
 * - Forwarder at 0x5FbDB2315678afecb367f032d93F642f64180aa3 (nonce 0)
 * - Token at 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 (nonce 1)
 */
async function main() {
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
  const FORWARDER_ADDRESS = process.env.FORWARDER_ADDRESS;

  console.log("\n🔍 Checking deployment configuration...");
  console.log(`   TOKEN_ADDRESS: ${TOKEN_ADDRESS || "not set (will deploy MockERC20)"}`);
  console.log(`   FORWARDER_ADDRESS: ${FORWARDER_ADDRESS || "not set (will deploy new Forwarder)"}`);

  // Track the forwarder address for PaymentGateway deployment
  let forwarderAddr = FORWARDER_ADDRESS || "";

  // Step 1: Deploy Forwarder FIRST if FORWARDER_ADDRESS is not set
  // This ensures Forwarder is at nonce 0 = 0x5FbDB2315678afecb367f032d93F642f64180aa3
  if (!FORWARDER_ADDRESS) {
    const forwarderFromArtifact = getDeployedAddress("Forwarder#ERC2771Forwarder");
    let forwarderDeployed = false;

    if (forwarderFromArtifact) {
      forwarderDeployed = await isContractDeployed(forwarderFromArtifact);
      if (forwarderDeployed) {
        forwarderAddr = forwarderFromArtifact;
      }
    }

    if (forwarderDeployed) {
      console.log(`\n✅ Forwarder already deployed at ${forwarderFromArtifact}`);
    } else {
      console.log("\n📦 Deploying Forwarder (nonce 0)...");
      execSync(
        "npx hardhat ignition deploy ./ignition/modules/Forwarder.ts --network localhost",
        { stdio: "inherit" }
      );
      // Get the deployed address
      forwarderAddr = getDeployedAddress("Forwarder#ERC2771Forwarder") || "";
      console.log(`   Forwarder deployed at: ${forwarderAddr}`);
    }
  } else {
    console.log(`\n✅ Using existing Forwarder at ${FORWARDER_ADDRESS}`);
  }

  // Step 2: Deploy MockERC20 if TOKEN_ADDRESS is not set
  // This ensures Token is at nonce 1 = 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
  if (!TOKEN_ADDRESS) {
    const mockTokenFromArtifact = getDeployedAddress("MockERC20#MockERC20");
    let mockTokenDeployed = false;

    if (mockTokenFromArtifact) {
      mockTokenDeployed = await isContractDeployed(mockTokenFromArtifact);
    }

    if (mockTokenDeployed) {
      console.log(`\n✅ MockERC20 already deployed at ${mockTokenFromArtifact}`);
    } else {
      console.log("\n📦 Deploying MockERC20 (nonce 1)...");
      execSync(
        "npx hardhat ignition deploy ./ignition/modules/MockERC20.ts --network localhost",
        { stdio: "inherit" }
      );
    }
  } else {
    console.log(`\n✅ Using existing token at ${TOKEN_ADDRESS}`);
  }

  // Step 3: Deploy PaymentGateway if not already deployed
  const gatewayFromArtifact = getDeployedAddress("PaymentGateway#PaymentGatewayProxy");
  let gatewayDeployed = false;

  if (gatewayFromArtifact) {
    gatewayDeployed = await isContractDeployed(gatewayFromArtifact);
  }

  if (gatewayDeployed) {
    console.log(`\n✅ PaymentGateway already deployed at ${gatewayFromArtifact}`);
  } else {
    console.log("\n📦 Deploying PaymentGateway (nonce 2-3)...");

    if (forwarderAddr) {
      // Use existing or just-deployed Forwarder
      console.log(`   Using Forwarder: ${forwarderAddr}`);
      const paramsPath = writeIgnitionParameters(forwarderAddr);
      execSync(
        `npx hardhat ignition deploy ./ignition/modules/PaymentGateway.ts --network localhost --parameters ${paramsPath}`,
        { stdio: "inherit" }
      );
      // Clean up temp file
      fs.unlinkSync(paramsPath);
    } else {
      // This shouldn't happen, but fallback to deploying with new Forwarder
      console.log("   Warning: No forwarder address, deploying with new Forwarder");
      execSync(
        "npx hardhat ignition deploy ./ignition/modules/PaymentGateway.ts --network localhost",
        { stdio: "inherit" }
      );
    }
  }

  console.log("\n✅ Contract deployment complete!");

  // Step 4: Run mint-test-tokens
  console.log("\n🪙 Running mint-test-tokens...");
  execSync(
    "npx hardhat run scripts/mint-test-tokens.ts --network localhost",
    { stdio: "inherit" }
  );

  console.log("\n🎉 All tasks complete!\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
