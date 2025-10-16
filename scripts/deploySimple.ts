import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Deploy FeeSplitterSimple contract (non-upgradeable)
 * 
 * Configuration can be set via environment variables or modified below
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying FeeSplitterSimple with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Configuration - can be overridden by environment variables
  const OWNER = process.env.DEPLOYER_ADDRESS || "0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A"; // Multi-sig (Gnosis Safe)
  
  const PAYEES = process.env.INITIAL_PAYEES?.split(',') || [
    "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333", // Nick
    "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261", // Ignas
  ];
  
  const SHARES = process.env.INITIAL_SHARES?.split(',').map(s => parseInt(s)) || [1, 1]; // 50/50 split

  console.log("\n=== Deployment Configuration ===");
  console.log("Owner:", OWNER);
  console.log("Payees:", PAYEES);
  console.log("Shares:", SHARES);

  // Validate configuration
  if (PAYEES.length !== SHARES.length || PAYEES.length === 0) {
    throw new Error("Invalid configuration: PAYEES and SHARES must have same length and not be empty");
  }

  // Deploy
  const FeeSplitter = await ethers.getContractFactory("FeeSplitterSimple");
  
  console.log("\nDeploying contract...");
  const splitter = await FeeSplitter.deploy(OWNER, PAYEES, SHARES);
  await splitter.waitForDeployment();

  const contractAddress = await splitter.getAddress();

  console.log("\n=== Deployment Successful ===");
  console.log("Contract address:", contractAddress);

  // Verify configuration
  console.log("\n=== Configuration Verification ===");
  console.log("Owner:", await splitter.owner());
  console.log("Total shares:", await splitter.totalShares());
  console.log("Payees:", await splitter.payees());
  
  for (let i = 0; i < PAYEES.length; i++) {
    console.log(`Shares for ${PAYEES[i]}:`, await splitter.shares(PAYEES[i]));
  }

  console.log("\n=== Next Steps ===");
  console.log("1. Verify contract on block explorer:");
  console.log(`   npx hardhat verify --network <network> ${contractAddress} "${OWNER}" "[${PAYEES.map(p => `\\"${p}\\"`).join(',')}]" "[${SHARES.join(',')}]"`);
  console.log("2. Transfer ownership to multi-sig (if using test owner):");
  console.log(`   Use transferOwnership()`);
  console.log("3. Fund the contract with ETH or ERC20 tokens");
  console.log("4. Payees can call releaseETH() or releaseToken()");
  console.log("5. To change payees, ensure all balances are claimed first, then call setPayees()");

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contract: contractAddress,
    owner: OWNER,
    payees: PAYEES,
    shares: SHARES,
  };

  console.log("\n=== Deployment Info (save this) ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

