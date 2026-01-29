import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get deployed contract address from Ignition deployment artifacts.
 */
function getDeployedAddress(contractId: string): string | null {
  const deploymentPath = path.join(
    __dirname,
    '../ignition/deployments/chain-31337/deployed_addresses.json'
  );

  if (fs.existsSync(deploymentPath)) {
    const addresses = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    if (addresses[contractId]) {
      return addresses[contractId];
    }
  }

  return null;
}

/**
 * Mint tokens to test user account for local development.
 *
 * Supports both:
 * - MockERC20 (deployed by msqpay standalone)
 * - SampleToken (deployed by msq-relayer-service)
 *
 * Both tokens have mint(address, uint256) with onlyOwner modifier.
 * Account #0 is the owner for both.
 */
async function main() {
  // Token address priority: env var > Ignition artifacts
  const TOKEN_ADDRESS =
    process.env.TOKEN_ADDRESS || getDeployedAddress('MockERC20#MockERC20') || '';

  if (!TOKEN_ADDRESS) {
    throw new Error(
      'TOKEN_ADDRESS not found. Please deploy contracts first or set TOKEN_ADDRESS env var.'
    );
  }

  // Test user account (Hardhat Account #3 - Payer)
  const TEST_USER_ADDRESS = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
  const MINT_AMOUNT = ethers.parseUnits('1000000', 18); // 1,000,000 tokens

  // Get Account #0 (owner of both MockERC20 and SampleToken)
  const [owner] = await ethers.getSigners();

  // Use minimal ABI for mint function (works with both MockERC20 and SampleToken)
  const mintAbi = [
    'function mint(address to, uint256 amount) external',
    'function balanceOf(address account) view returns (uint256)',
    'function symbol() view returns (string)',
  ];

  const token = new ethers.Contract(TOKEN_ADDRESS, mintAbi, owner);

  // Try to get token symbol for display
  let tokenSymbol = 'TOKEN';
  try {
    tokenSymbol = await token.symbol();
  } catch {
    // Some tokens may not have symbol(), use default
  }

  console.log(`\n🪙 Minting ${tokenSymbol} tokens...`);
  console.log(`   Token: ${TOKEN_ADDRESS}`);
  console.log(`   To: ${TEST_USER_ADDRESS}`);
  console.log(`   Amount: ${ethers.formatUnits(MINT_AMOUNT, 18)} ${tokenSymbol}`);
  console.log(`   Minter: ${owner.address} (Account #0)`);

  // Set explicit gas limit to avoid gas cap issues with external RPC providers
  const tx = await token.mint(TEST_USER_ADDRESS, MINT_AMOUNT, {
    gasLimit: 1000000,
  });
  await tx.wait();

  const balance = await token.balanceOf(TEST_USER_ADDRESS);
  console.log(`\n✅ Minting complete!`);
  console.log(`   Balance: ${ethers.formatUnits(balance, 18)} ${tokenSymbol}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
