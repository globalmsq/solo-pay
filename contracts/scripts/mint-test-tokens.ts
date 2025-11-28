import { ethers } from "hardhat";

/**
 * Mint TEST tokens to Hardhat Account #0 for local development
 * This script is executed automatically by docker-compose after contract deployment
 */
async function main() {
  // MockERC20 (TEST) token address - Hardhat deterministic
  const TOKEN_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const MINT_AMOUNT = ethers.parseUnits("1000000", 18); // 1,000,000 TEST

  const [deployer] = await ethers.getSigners();
  const token = await ethers.getContractAt("MockERC20", TOKEN_ADDRESS);

  console.log(`\n🪙 Minting TEST tokens...`);
  console.log(`   Token: ${TOKEN_ADDRESS}`);
  console.log(`   To: ${deployer.address}`);
  console.log(`   Amount: ${ethers.formatUnits(MINT_AMOUNT, 18)} TEST`);

  const tx = await token.mint(deployer.address, MINT_AMOUNT);
  await tx.wait();

  const balance = await token.balanceOf(deployer.address);
  console.log(`\n✅ Minting complete!`);
  console.log(`   Balance: ${ethers.formatUnits(balance, 18)} TEST\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
