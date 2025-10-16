import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { FeeSplitterUpgradeable, TestToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("FeeSplitterUpgradeable", function () {
  let splitter: FeeSplitterUpgradeable;
  let testToken: TestToken;
  let deployer: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const owner = "0xD437c78a6bA1F42Dca908F3759ab8B8A42Af4D82";
  const payee1 = "0xD437c78a6bA1F42Dca908F3759ab8B8A42Af4D82";
  const payee2 = "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261";

  beforeEach(async function () {
    [deployer, addr1, addr2, stranger] = await ethers.getSigners();

    // Deploy FeeSplitter via UUPS proxy
    const Splitter = await ethers.getContractFactory("FeeSplitterUpgradeable");
    const proxy = await upgrades.deployProxy(
      Splitter,
      [owner, [payee1, payee2], [1, 1]],
      { kind: "uups" }
    );
    await proxy.waitForDeployment();
    splitter = proxy as unknown as FeeSplitterUpgradeable;

    // Deploy test token
    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    testToken = await TestTokenFactory.deploy();
    await testToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await splitter.owner()).to.equal(owner);
    });

    it("should set correct payees and shares", async function () {
      const payees = await splitter.payees();
      expect(payees.length).to.equal(2);
      expect(payees[0]).to.equal(payee1);
      expect(payees[1]).to.equal(payee2);

      expect(await splitter.shares(payee1)).to.equal(1);
      expect(await splitter.shares(payee2)).to.equal(1);
      expect(await splitter.totalShares()).to.equal(2);
    });
  });

  describe("ETH Distribution", function () {
    it("should split ETH 50/50 between two payees", async function () {
      const amount = ethers.parseEther("1.0");
      
      // Send ETH to splitter
      await deployer.sendTransaction({
        to: await splitter.getAddress(),
        value: amount,
      });

      // Check pending amounts
      const pending1 = await splitter.pendingETH(payee1);
      const pending2 = await splitter.pendingETH(payee2);

      expect(pending1).to.equal(ethers.parseEther("0.5"));
      expect(pending2).to.equal(ethers.parseEther("0.5"));
    });

    it("should allow payees to release their ETH", async function () {
      const amount = ethers.parseEther("1.0");
      
      await deployer.sendTransaction({
        to: await splitter.getAddress(),
        value: amount,
      });

      // Impersonate owner to release funds
      await ethers.provider.send("hardhat_impersonateAccount", [owner]);
      const ownerSigner = await ethers.getSigner(owner);

      // Fund the impersonated account with ETH for gas
      await deployer.sendTransaction({
        to: owner,
        value: ethers.parseEther("1.0"),
      });

      const balanceBefore = await ethers.provider.getBalance(owner);
      
      // Release ETH
      const tx = await splitter.connect(ownerSigner).releaseETH(owner);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(owner);
      const netGain = balanceAfter - balanceBefore + gasUsed;

      expect(netGain).to.equal(ethers.parseEther("0.5"));
      expect(await splitter.pendingETH(owner)).to.equal(0);
    });
  });

  describe("ERC20 Distribution", function () {
    it("should split ERC20 tokens 50/50", async function () {
      const amount = ethers.parseUnits("1000", 18);
      
      // Mint and transfer tokens to splitter
      await testToken.mint(await deployer.getAddress(), amount);
      await testToken.transfer(await splitter.getAddress(), amount);

      const pending1 = await splitter.pendingToken(
        await testToken.getAddress(),
        payee1
      );
      const pending2 = await splitter.pendingToken(
        await testToken.getAddress(),
        payee2
      );

      expect(pending1).to.equal(amount / 2n);
      expect(pending2).to.equal(amount / 2n);
    });

    it("should allow payees to release their tokens", async function () {
      const amount = ethers.parseUnits("1000", 18);
      
      await testToken.mint(await deployer.getAddress(), amount);
      await testToken.transfer(await splitter.getAddress(), amount);

      // Impersonate owner
      await ethers.provider.send("hardhat_impersonateAccount", [owner]);
      const ownerSigner = await ethers.getSigner(owner);
      
      await deployer.sendTransaction({
        to: owner,
        value: ethers.parseEther("1.0"),
      });

      await splitter
        .connect(ownerSigner)
        .releaseToken(await testToken.getAddress(), owner);

      expect(await testToken.balanceOf(owner)).to.equal(amount / 2n);
      expect(
        await splitter.pendingToken(await testToken.getAddress(), owner)
      ).to.equal(0);
    });
  });

  describe("Pausable", function () {
    it("should allow owner to pause and unpause", async function () {
      await ethers.provider.send("hardhat_impersonateAccount", [owner]);
      const ownerSigner = await ethers.getSigner(owner);
      
      await deployer.sendTransaction({
        to: owner,
        value: ethers.parseEther("1.0"),
      });

      // Pause
      await splitter.connect(ownerSigner).pause();
      expect(await splitter.paused()).to.be.true;

      // Try to release while paused - should fail
      await deployer.sendTransaction({
        to: await splitter.getAddress(),
        value: ethers.parseEther("1.0"),
      });

      await expect(
        splitter.connect(ownerSigner).releaseETH(owner)
      ).to.be.revertedWithCustomError(splitter, "EnforcedPause");

      // Unpause
      await splitter.connect(ownerSigner).unpause();
      expect(await splitter.paused()).to.be.false;

      // Should work now
      await splitter.connect(ownerSigner).releaseETH(owner);
    });

    it("should not allow non-owner to pause", async function () {
      await expect(
        splitter.connect(stranger).pause()
      ).to.be.revertedWithCustomError(splitter, "OwnableUnauthorizedAccount");
    });
  });

  describe("Reconfiguration", function () {
    it("should allow resetPayees after all funds are claimed", async function () {
      // Send some ETH and tokens
      const ethAmount = ethers.parseEther("2.0");
      const tokenAmount = ethers.parseUnits("1000", 18);

      await deployer.sendTransaction({
        to: await splitter.getAddress(),
        value: ethAmount,
      });

      await testToken.mint(await deployer.getAddress(), tokenAmount);
      await testToken.transfer(await splitter.getAddress(), tokenAmount);

      // Impersonate both payees and claim all
      await ethers.provider.send("hardhat_impersonateAccount", [payee1]);
      await ethers.provider.send("hardhat_impersonateAccount", [payee2]);
      
      const payee1Signer = await ethers.getSigner(payee1);
      const payee2Signer = await ethers.getSigner(payee2);

      // Fund for gas
      await deployer.sendTransaction({
        to: payee1,
        value: ethers.parseEther("1.0"),
      });
      await deployer.sendTransaction({
        to: payee2,
        value: ethers.parseEther("1.0"),
      });

      // Release all funds
      await splitter.connect(payee1Signer).releaseETH(payee1);
      await splitter.connect(payee2Signer).releaseETH(payee2);
      await splitter
        .connect(payee1Signer)
        .releaseToken(await testToken.getAddress(), payee1);
      await splitter
        .connect(payee2Signer)
        .releaseToken(await testToken.getAddress(), payee2);

      // Now reset payees
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
        .resetPayees(
          [newPayee1, newPayee2],
          [3, 1],
          [await testToken.getAddress()]
        );

      // Verify new configuration
      const payees = await splitter.payees();
      expect(payees[0]).to.equal(newPayee1);
      expect(payees[1]).to.equal(newPayee2);
      expect(await splitter.shares(newPayee1)).to.equal(3);
      expect(await splitter.shares(newPayee2)).to.equal(1);
      expect(await splitter.totalShares()).to.equal(4);

      // Old payees should have 0 shares
      expect(await splitter.shares(payee1)).to.equal(0);
      expect(await splitter.shares(payee2)).to.equal(0);
    });

    it("should checkpoint and reconfigure without draining", async function () {
      // Send funds
      const ethAmount = ethers.parseEther("1.0");
      const tokenAmount = ethers.parseUnits("1000", 18);

      await deployer.sendTransaction({
        to: await splitter.getAddress(),
        value: ethAmount,
      });

      await testToken.mint(await deployer.getAddress(), tokenAmount);
      await testToken.transfer(await splitter.getAddress(), tokenAmount);

      // Checkpoint and reconfigure without claiming
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
          [3, 1],
          [await testToken.getAddress()]
        );

      // Old payees should still have credits
      expect(await splitter.creditETH(payee1)).to.equal(ethers.parseEther("0.5"));
      expect(await splitter.creditETH(payee2)).to.equal(ethers.parseEther("0.5"));
      expect(await splitter.creditToken(await testToken.getAddress(), payee1)).to.equal(tokenAmount / 2n);
      expect(await splitter.creditToken(await testToken.getAddress(), payee2)).to.equal(tokenAmount / 2n);

      // Old payees should have 0 shares now
      expect(await splitter.shares(payee1)).to.equal(0);
      expect(await splitter.shares(payee2)).to.equal(0);

      // New payees should have correct shares
      expect(await splitter.shares(newPayee1)).to.equal(3);
      expect(await splitter.shares(newPayee2)).to.equal(1);

      // Old payees can still claim their credits
      await ethers.provider.send("hardhat_impersonateAccount", [payee1]);
      const payee1Signer = await ethers.getSigner(payee1);
      
      await deployer.sendTransaction({
        to: payee1,
        value: ethers.parseEther("1.0"),
      });

      await splitter.connect(payee1Signer).releaseETH(payee1);
      expect(await splitter.creditETH(payee1)).to.equal(0);
    });
  });

  describe("Edge Cases", function () {
    it("should revert when releasing with no entitlement", async function () {
      await expect(
        splitter.releaseETH(await stranger.getAddress())
      ).to.be.revertedWith("no entitlement");
    });

    it("should revert when releasing with nothing due", async function () {
      // Don't send any funds, try to release
      await ethers.provider.send("hardhat_impersonateAccount", [owner]);
      const ownerSigner = await ethers.getSigner(owner);
      
      await deployer.sendTransaction({
        to: owner,
        value: ethers.parseEther("1.0"),
      });

      await expect(
        splitter.connect(ownerSigner).releaseETH(owner)
      ).to.be.revertedWith("nothing due");
    });

    it("should handle multiple releases correctly", async function () {
      // First deposit
      await deployer.sendTransaction({
        to: await splitter.getAddress(),
        value: ethers.parseEther("1.0"),
      });

      await ethers.provider.send("hardhat_impersonateAccount", [owner]);
      const ownerSigner = await ethers.getSigner(owner);
      
      await deployer.sendTransaction({
        to: owner,
        value: ethers.parseEther("2.0"),
      });

      // First release
      await splitter.connect(ownerSigner).releaseETH(owner);
      expect(await splitter.pendingETH(owner)).to.equal(0);

      // Second deposit
      await deployer.sendTransaction({
        to: await splitter.getAddress(),
        value: ethers.parseEther("2.0"),
      });

      // Check pending again
      expect(await splitter.pendingETH(owner)).to.equal(ethers.parseEther("1.0"));

      // Second release
      await splitter.connect(ownerSigner).releaseETH(owner);
      expect(await splitter.pendingETH(owner)).to.equal(0);
    });
  });
});

