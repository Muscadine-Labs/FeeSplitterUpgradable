import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("Deploying FeeSplitterUpgradeable...");

  const owner = "0xD437c78a6bA1F42Dca908F3759ab8B8A42Af4D82"; // Nicholas owner
  const payees = [
    "0xD437c78a6bA1F42Dca908F3759ab8B8A42Af4D82", // Nicholas
    "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261", // Ignas
  ];
  const shares = [1, 1]; // 50/50 split

  console.log("Owner:", owner);
  console.log("Payees:", payees);
  console.log("Shares:", shares);

  const Splitter = await ethers.getContractFactory("FeeSplitterUpgradeable");
  
  const proxy = await upgrades.deployProxy(
    Splitter, 
    [owner, payees, shares], 
    {
      kind: "uups",
      initializer: "initialize",
    }
  );

  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  console.log("\n✅ FeeSplitter deployed successfully!");
  console.log("Proxy address:", proxyAddress);
  console.log("\nSet your Morpho vault's feeRecipient to:", proxyAddress);

  // Get implementation address for verification
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("\nImplementation address:", implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

