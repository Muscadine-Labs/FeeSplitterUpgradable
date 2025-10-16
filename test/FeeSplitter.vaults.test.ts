import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { FeeSplitterUpgradeable, TestToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("FeeSplitterUpgradeable - Muscadine Vaults Integration", function () {
  let splitter: FeeSplitterUpgradeable;
  let usdc: TestToken;
  let cbbtc: TestToken;
  let weth: TestToken;
  let deployer: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;

  // NOTE: Using test owner address for testing (can impersonate in tests)
  // Production uses multi-sig: 0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A
  const owner = "0xD437c78a6bA1F42Dca908F3759ab8B8A42Af4D82"; // Test owner (Nicholas)
  const nicholas = "0xD437c78a6bA1F42Dca908F3759ab8B8A42Af4D82";
  const ignas = "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261";

  // Muscadine Vault Addresses
  const USDC_VAULT = "0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F";
  const CBBTC_VAULT = "0xAeCc8113a7bD0CFAF7000EA7A31afFD4691ff3E9";
  const WETH_VAULT = "0x21e0d366272798da3A977FEBA699FCB91959d120";

  beforeEach(async function () {
    [deployer, addr1, addr2] = await ethers.getSigners();

    // Deploy FeeSplitter via UUPS proxy
    const Splitter = await ethers.getContractFactory("FeeSplitterUpgradeable");
    const proxy = await upgrades.deployProxy(
      Splitter,
      [owner, [nicholas, ignas], [1, 1]], // 50/50 split
      { kind: "uups" }
    );
    await proxy.waitForDeployment();
    splitter = proxy as unknown as FeeSplitterUpgradeable;

    // Deploy test tokens to simulate vault tokens
    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    
    // USDC (6 decimals)
    usdc = await TestTokenFactory.deploy();
    await usdc.waitForDeployment();
    
    // cbBTC (8 decimals)
    cbbtc = await TestTokenFactory.deploy();
    await cbbtc.waitForDeployment();
    
    // WETH (18 decimals)
    weth = await TestTokenFactory.deploy();
    await weth.waitForDeployment();
  });

  describe("USDC Vault Fees", function () {
    it("should split USDC vault fees 50/50", async function () {
      // Simulate USDC vault sending 1000 USDC in fees (6 decimals)
      const feeAmount = ethers.parseUnits("1000", 6); // 1000 USDC
      
      await usdc.mint(await deployer.getAddress(), feeAmount);
      await usdc.transfer(await splitter.getAddress(), feeAmount);

      // Check pending amounts
      const nicholasPending = await splitter.pendingToken(
        await usdc.getAddress(),
        nicholas
      );
      const ignasPending = await splitter.pendingToken(
        await usdc.getAddress(),
        ignas
      );

      expect(nicholasPending).to.equal(ethers.parseUnits("500", 6));
      expect(ignasPending).to.equal(ethers.parseUnits("500", 6));

      console.log("USDC Vault:", USDC_VAULT);
      console.log("Nicholas entitled to:", ethers.formatUnits(nicholasPending, 6), "USDC");
      console.log("Ignas entitled to:", ethers.formatUnits(ignasPending, 6), "USDC");
    });

    it("should handle small USDC amounts correctly", async function () {
      // Simulate 11.33333 USDC (realistic fee amount)
      const feeAmount = ethers.parseUnits("11.333333", 6);
      
      await usdc.mint(await deployer.getAddress(), feeAmount);
      await usdc.transfer(await splitter.getAddress(), feeAmount);

      const nicholasPending = await splitter.pendingToken(
        await usdc.getAddress(),
        nicholas
      );
      const ignasPending = await splitter.pendingToken(
        await usdc.getAddress(),
        ignas
      );

      // Integer division: 11333333 / 2 = 5666666 (each)
      // Dust of 1 micro-USDC remains in contract (expected)
      const expectedEach = feeAmount / 2n;
      
      expect(nicholasPending).to.equal(expectedEach);
      expect(ignasPending).to.equal(expectedEach);
      
      // Total claimed is fee - 1 (dust from rounding)
      expect(nicholasPending + ignasPending).to.be.at.most(feeAmount);
      expect(nicholasPending + ignasPending).to.be.at.least(feeAmount - 1n);

      console.log("Fee amount:", ethers.formatUnits(feeAmount, 6), "USDC");
      console.log("Each gets:", ethers.formatUnits(expectedEach, 6), "USDC");
      console.log("Dust remaining:", ethers.formatUnits(feeAmount - nicholasPending - ignasPending, 6), "USDC");
    });

    it("should allow claiming USDC vault fees", async function () {
      const feeAmount = ethers.parseUnits("100", 6);
      
      await usdc.mint(await deployer.getAddress(), feeAmount);
      await usdc.transfer(await splitter.getAddress(), feeAmount);

      // Impersonate Nicholas
      await ethers.provider.send("hardhat_impersonateAccount", [nicholas]);
      const nicholasSigner = await ethers.getSigner(nicholas);
      
      await deployer.sendTransaction({
        to: nicholas,
        value: ethers.parseEther("1.0"),
      });

      // Nicholas claims his share
      await splitter
        .connect(nicholasSigner)
        .releaseToken(await usdc.getAddress(), nicholas);

      expect(await usdc.balanceOf(nicholas)).to.equal(ethers.parseUnits("50", 6));
      expect(
        await splitter.pendingToken(await usdc.getAddress(), nicholas)
      ).to.equal(0);
    });
  });

  describe("cbBTC Vault Fees", function () {
    it("should split cbBTC vault fees 50/50", async function () {
      // Simulate 0.5 cbBTC in fees (8 decimals)
      const feeAmount = ethers.parseUnits("0.5", 8);
      
      await cbbtc.mint(await deployer.getAddress(), feeAmount);
      await cbbtc.transfer(await splitter.getAddress(), feeAmount);

      const nicholasPending = await splitter.pendingToken(
        await cbbtc.getAddress(),
        nicholas
      );
      const ignasPending = await splitter.pendingToken(
        await cbbtc.getAddress(),
        ignas
      );

      expect(nicholasPending).to.equal(ethers.parseUnits("0.25", 8));
      expect(ignasPending).to.equal(ethers.parseUnits("0.25", 8));

      console.log("cbBTC Vault:", CBBTC_VAULT);
      console.log("Nicholas entitled to:", ethers.formatUnits(nicholasPending, 8), "cbBTC");
      console.log("Ignas entitled to:", ethers.formatUnits(ignasPending, 8), "cbBTC");
    });

    it("should handle precise cbBTC amounts", async function () {
      // 0.00123456 BTC
      const feeAmount = 123456n; // in satoshis (8 decimals)
      
      await cbbtc.mint(await deployer.getAddress(), feeAmount);
      await cbbtc.transfer(await splitter.getAddress(), feeAmount);

      const nicholasPending = await splitter.pendingToken(
        await cbbtc.getAddress(),
        nicholas
      );
      const ignasPending = await splitter.pendingToken(
        await cbbtc.getAddress(),
        ignas
      );

      const expectedEach = feeAmount / 2n;
      
      expect(nicholasPending).to.equal(expectedEach);
      expect(ignasPending).to.equal(expectedEach);
      expect(nicholasPending + ignasPending).to.equal(feeAmount);
    });
  });

  describe("WETH Vault Fees", function () {
    it("should split WETH vault fees 50/50", async function () {
      // Simulate 10 WETH in fees (18 decimals)
      const feeAmount = ethers.parseUnits("10", 18);
      
      await weth.mint(await deployer.getAddress(), feeAmount);
      await weth.transfer(await splitter.getAddress(), feeAmount);

      const nicholasPending = await splitter.pendingToken(
        await weth.getAddress(),
        nicholas
      );
      const ignasPending = await splitter.pendingToken(
        await weth.getAddress(),
        ignas
      );

      expect(nicholasPending).to.equal(ethers.parseUnits("5", 18));
      expect(ignasPending).to.equal(ethers.parseUnits("5", 18));

      console.log("WETH Vault:", WETH_VAULT);
      console.log("Nicholas entitled to:", ethers.formatUnits(nicholasPending, 18), "WETH");
      console.log("Ignas entitled to:", ethers.formatUnits(ignasPending, 18), "WETH");
    });

    it("should handle fractional WETH amounts", async function () {
      // 2.5 WETH
      const feeAmount = ethers.parseUnits("2.5", 18);
      
      await weth.mint(await deployer.getAddress(), feeAmount);
      await weth.transfer(await splitter.getAddress(), feeAmount);

      const nicholasPending = await splitter.pendingToken(
        await weth.getAddress(),
        nicholas
      );
      const ignasPending = await splitter.pendingToken(
        await weth.getAddress(),
        ignas
      );

      expect(nicholasPending).to.equal(ethers.parseUnits("1.25", 18));
      expect(ignasPending).to.equal(ethers.parseUnits("1.25", 18));
    });
  });

  describe("Multi-Vault Scenario", function () {
    it("should handle fees from all three vaults simultaneously", async function () {
      // Simulate fees from all vaults
      const usdcFees = ethers.parseUnits("1000", 6);   // 1000 USDC
      const cbbtcFees = ethers.parseUnits("0.1", 8);   // 0.1 BTC
      const wethFees = ethers.parseUnits("5", 18);     // 5 WETH

      // Send all fees to splitter
      await usdc.mint(await deployer.getAddress(), usdcFees);
      await usdc.transfer(await splitter.getAddress(), usdcFees);

      await cbbtc.mint(await deployer.getAddress(), cbbtcFees);
      await cbbtc.transfer(await splitter.getAddress(), cbbtcFees);

      await weth.mint(await deployer.getAddress(), wethFees);
      await weth.transfer(await splitter.getAddress(), wethFees);

      // Check all pending amounts
      const nicholasUSDC = await splitter.pendingToken(await usdc.getAddress(), nicholas);
      const nicholasCBBTC = await splitter.pendingToken(await cbbtc.getAddress(), nicholas);
      const nicholasWETH = await splitter.pendingToken(await weth.getAddress(), nicholas);

      expect(nicholasUSDC).to.equal(ethers.parseUnits("500", 6));
      expect(nicholasCBBTC).to.equal(ethers.parseUnits("0.05", 8));
      expect(nicholasWETH).to.equal(ethers.parseUnits("2.5", 18));

      console.log("\n=== Nicholas Total Fees ===");
      console.log("USDC:", ethers.formatUnits(nicholasUSDC, 6));
      console.log("cbBTC:", ethers.formatUnits(nicholasCBBTC, 8));
      console.log("WETH:", ethers.formatUnits(nicholasWETH, 18));
    });

    it("should allow claiming from multiple vaults", async function () {
      // Setup fees from all vaults
      const usdcFees = ethers.parseUnits("100", 6);
      const cbbtcFees = ethers.parseUnits("0.01", 8);
      const wethFees = ethers.parseUnits("1", 18);

      await usdc.mint(await deployer.getAddress(), usdcFees);
      await usdc.transfer(await splitter.getAddress(), usdcFees);

      await cbbtc.mint(await deployer.getAddress(), cbbtcFees);
      await cbbtc.transfer(await splitter.getAddress(), cbbtcFees);

      await weth.mint(await deployer.getAddress(), wethFees);
      await weth.transfer(await splitter.getAddress(), wethFees);

      // Impersonate Nicholas
      await ethers.provider.send("hardhat_impersonateAccount", [nicholas]);
      const nicholasSigner = await ethers.getSigner(nicholas);
      
      await deployer.sendTransaction({
        to: nicholas,
        value: ethers.parseEther("1.0"),
      });

      // Claim all three
      await splitter.connect(nicholasSigner).releaseToken(await usdc.getAddress(), nicholas);
      await splitter.connect(nicholasSigner).releaseToken(await cbbtc.getAddress(), nicholas);
      await splitter.connect(nicholasSigner).releaseToken(await weth.getAddress(), nicholas);

      // Verify balances
      expect(await usdc.balanceOf(nicholas)).to.equal(ethers.parseUnits("50", 6));
      expect(await cbbtc.balanceOf(nicholas)).to.equal(ethers.parseUnits("0.005", 8));
      expect(await weth.balanceOf(nicholas)).to.equal(ethers.parseUnits("0.5", 18));

      console.log("\n=== Nicholas Claimed Successfully ===");
      console.log("USDC:", ethers.formatUnits(await usdc.balanceOf(nicholas), 6));
      console.log("cbBTC:", ethers.formatUnits(await cbbtc.balanceOf(nicholas), 8));
      console.log("WETH:", ethers.formatUnits(await weth.balanceOf(nicholas), 18));
    });
  });

  describe("Checkpoint and Reconfigure with Vaults", function () {
    it("should checkpoint all vault tokens when reconfiguring", async function () {
      // Send fees from all vaults
      const usdcFees = ethers.parseUnits("1000", 6);
      const cbbtcFees = ethers.parseUnits("0.5", 8);
      const wethFees = ethers.parseUnits("10", 18);

      await usdc.mint(await deployer.getAddress(), usdcFees);
      await usdc.transfer(await splitter.getAddress(), usdcFees);

      await cbbtc.mint(await deployer.getAddress(), cbbtcFees);
      await cbbtc.transfer(await splitter.getAddress(), cbbtcFees);

      await weth.mint(await deployer.getAddress(), wethFees);
      await weth.transfer(await splitter.getAddress(), wethFees);

      // Checkpoint and reconfigure to new payees
      const newPayee1 = await addr1.getAddress();
      const newPayee2 = await addr2.getAddress();

      await ethers.provider.send("hardhat_impersonateAccount", [owner]);
      const ownerSigner = await ethers.getSigner(owner);
      
      await deployer.sendTransaction({
        to: owner,
        value: ethers.parseEther("1.0"),
      });

      await splitter
        .connect(ownerSigner)
        .checkpointAndReconfigure(
          [newPayee1, newPayee2],
          [3, 1], // 75/25 split
          [await usdc.getAddress(), await cbbtc.getAddress(), await weth.getAddress()]
        );

      // Old payees should have credits preserved
      expect(await splitter.creditToken(await usdc.getAddress(), nicholas)).to.equal(
        ethers.parseUnits("500", 6)
      );
      expect(await splitter.creditToken(await cbbtc.getAddress(), nicholas)).to.equal(
        ethers.parseUnits("0.25", 8)
      );
      expect(await splitter.creditToken(await weth.getAddress(), nicholas)).to.equal(
        ethers.parseUnits("5", 18)
      );

      // New payees should have the new split
      expect(await splitter.shares(newPayee1)).to.equal(3);
      expect(await splitter.shares(newPayee2)).to.equal(1);

      console.log("\n=== After Reconfiguration ===");
      console.log("Nicholas USDC credit:", ethers.formatUnits(
        await splitter.creditToken(await usdc.getAddress(), nicholas), 6
      ));
      console.log("New split: 75/25");
    });
  });

  describe("Realistic Vault Fee Scenarios", function () {
    it("should handle daily vault fees accumulation", async function () {
      // Day 1: Small fees
      await usdc.mint(await deployer.getAddress(), ethers.parseUnits("50", 6));
      await usdc.transfer(await splitter.getAddress(), ethers.parseUnits("50", 6));

      let pending = await splitter.pendingToken(await usdc.getAddress(), nicholas);
      expect(pending).to.equal(ethers.parseUnits("25", 6));

      // Day 2: More fees
      await usdc.mint(await deployer.getAddress(), ethers.parseUnits("100", 6));
      await usdc.transfer(await splitter.getAddress(), ethers.parseUnits("100", 6));

      pending = await splitter.pendingToken(await usdc.getAddress(), nicholas);
      expect(pending).to.equal(ethers.parseUnits("75", 6)); // 25 + 50

      // Day 3: Claim all
      await ethers.provider.send("hardhat_impersonateAccount", [nicholas]);
      const nicholasSigner = await ethers.getSigner(nicholas);
      
      await deployer.sendTransaction({
        to: nicholas,
        value: ethers.parseEther("1.0"),
      });

      await splitter.connect(nicholasSigner).releaseToken(await usdc.getAddress(), nicholas);
      
      expect(await usdc.balanceOf(nicholas)).to.equal(ethers.parseUnits("75", 6));
      expect(await splitter.pendingToken(await usdc.getAddress(), nicholas)).to.equal(0);

      console.log("Total claimed after 3 days:", ethers.formatUnits(
        await usdc.balanceOf(nicholas), 6
      ), "USDC");
    });
  });
});

