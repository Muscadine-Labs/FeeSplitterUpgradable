import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("Deploying FeeSplitterUpgradeable...");

  const owner = "0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A"; // Multi-sig Safe (owner)
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
  console.log("\n📝 Configuration:");
  console.log("Owner (Multi-sig):", owner);
  console.log("Nicholas:", payees[0]);
  console.log("Ignas:", payees[1]);
  console.log("Split: 50/50");
  
  console.log("\n🔐 IMPORTANT:");
  console.log("Contract owner is your multi-sig Safe at:", owner);
  console.log("All admin functions require multi-sig approval");
  
  console.log("\n📌 Next Steps:");
  console.log("1. Set your Morpho vault's feeRecipient to:", proxyAddress);
  console.log("2. Verify on Basescan");
  console.log("3. Test with small amounts first");

  // Get implementation address for verification
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("\n📋 Contract Addresses:");
  console.log("Proxy:", proxyAddress);
  console.log("Implementation:", implementationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

