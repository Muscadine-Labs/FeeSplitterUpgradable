import { expect } from "chai";
import { ethers } from "hardhat";
import { FeeSplitterSimple, ERC20Mock, DeflationaryMock } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("FeeSplitterSimple", function () {
  let splitter: FeeSplitterSimple;
  let vanillaToken: ERC20Mock;
  let deflToken: DeflationaryMock;
  let owner: HardhatEthersSigner;
  let payee1: HardhatEthersSigner;
  let payee2: HardhatEthersSigner;
  let newPayee1: HardhatEthersSigner;
  let newPayee2: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, payee1, payee2, newPayee1, newPayee2, stranger] = await ethers.getSigners();

    // Deploy FeeSplitterSimple (non-upgradeable)
    const Splitter = await ethers.getContractFactory("FeeSplitterSimple");
    splitter = await Splitter.deploy(
      await owner.getAddress(),
      [await payee1.getAddress(), await payee2.getAddress()],
      [70, 30]
    );
    await splitter.waitForDeployment();

    // Deploy vanilla ERC20 mock
    const VanillaFactory = await ethers.getContractFactory("ERC20Mock");
    vanillaToken = await VanillaFactory.deploy("Vanilla Token", "VAN", 18);
    await vanillaToken.waitForDeployment();

    // Deploy deflationary ERC20 mock
    const DeflFactory = await ethers.getContractFactory("DeflationaryMock");
    deflToken = await DeflFactory.deploy("Deflationary Token", "DEFL", 18);
    await deflToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set correct owner", async function () {
      expect(await splitter.owner()).to.equal(await owner.getAddress());
    });

    it("should set correct payees and shares", async function () {
      const payees = await splitter.payees();
      expect(payees.length).to.equal(2);
      expect(payees[0]).to.equal(await payee1.getAddress());
      expect(payees[1]).to.equal(await payee2.getAddress());
      expect(await splitter.shares(await payee1.getAddress())).to.equal(70);
      expect(await splitter.shares(await payee2.getAddress())).to.equal(30);
      expect(await splitter.totalShares()).to.equal(100);
    });
  });

  describe("ETH Distribution", function () {
    it("should split ETH 70/30 between two payees", async function () {
      const amount = ethers.parseEther("10");
      
      await owner.sendTransaction({
        to: await splitter.getAddress(),
        value: amount,
      });

      expect(await splitter.pendingETH(await payee1.getAddress())).to.equal(ethers.parseEther("7"));
      expect(await splitter.pendingETH(await payee2.getAddress())).to.equal(ethers.parseEther("3"));
    });

    it("should allow payees to release ETH", async function () {
      const amount = ethers.parseEther("10");
      
      await owner.sendTransaction({
        to: await splitter.getAddress(),
        value: amount,
      });

      const balance1Before = await ethers.provider.getBalance(await payee1.getAddress());
      const tx1 = await splitter.connect(payee1).releaseETH(await payee1.getAddress());
      const receipt1 = await tx1.wait();
      const gas1 = receipt1!.gasUsed * receipt1!.gasPrice;
      const balance1After = await ethers.provider.getBalance(await payee1.getAddress());
      
      expect(balance1After - balance1Before + gas1).to.equal(ethers.parseEther("7"));

      const balance2Before = await ethers.provider.getBalance(await payee2.getAddress());
      const tx2 = await splitter.connect(payee2).releaseETH(await payee2.getAddress());
      const receipt2 = await tx2.wait();
      const gas2 = receipt2!.gasUsed * receipt2!.gasPrice;
      const balance2After = await ethers.provider.getBalance(await payee2.getAddress());
      
      expect(balance2After - balance2Before + gas2).to.equal(ethers.parseEther("3"));
    });
  });

  describe("ERC20 Distribution", function () {
    it("should split ERC20 tokens 70/30", async function () {
      const amount = ethers.parseUnits("1000", 18);
      
      await vanillaToken.mint(await owner.getAddress(), amount);
      await vanillaToken.transfer(await splitter.getAddress(), amount);

      expect(await splitter.pendingToken(await vanillaToken.getAddress(), await payee1.getAddress()))
        .to.equal(ethers.parseUnits("700", 18));
      expect(await splitter.pendingToken(await vanillaToken.getAddress(), await payee2.getAddress()))
        .to.equal(ethers.parseUnits("300", 18));
    });

    it("should allow payees to release tokens", async function () {
      const amount = ethers.parseUnits("1000", 18);
      
      await vanillaToken.mint(await owner.getAddress(), amount);
      await vanillaToken.transfer(await splitter.getAddress(), amount);

      await splitter.connect(payee1).releaseToken(await vanillaToken.getAddress(), await payee1.getAddress());
      await splitter.connect(payee2).releaseToken(await vanillaToken.getAddress(), await payee2.getAddress());

      expect(await vanillaToken.balanceOf(await payee1.getAddress())).to.equal(ethers.parseUnits("700", 18));
      expect(await vanillaToken.balanceOf(await payee2.getAddress())).to.equal(ethers.parseUnits("300", 18));
    });
  });

  describe("Deflationary Token Support", function () {
    it("should handle deflationary tokens correctly", async function () {
      const amount = ethers.parseUnits("1000", 18);

      await deflToken.mint(await owner.getAddress(), amount);
      await deflToken.transfer(await splitter.getAddress(), amount);
      
      const splitterBalance = await deflToken.balanceOf(await splitter.getAddress());
      expect(splitterBalance).to.equal(ethers.parseUnits("990", 18)); // 1% burned

      await splitter.connect(payee1).releaseToken(await deflToken.getAddress(), await payee1.getAddress());
      
      const balance1 = await deflToken.balanceOf(await payee1.getAddress());
      expect(balance1).to.be.closeTo(ethers.parseUnits("686.07", 18), ethers.parseUnits("0.01", 18));
    });
  });

  describe("setPayees", function () {
    it("should allow owner to change payees when all balances claimed", async function () {
      const amount = ethers.parseEther("10");
      
      await owner.sendTransaction({
        to: await splitter.getAddress(),
        value: amount,
      });

      await vanillaToken.mint(await owner.getAddress(), ethers.parseUnits("1000", 18));
      await vanillaToken.transfer(await splitter.getAddress(), ethers.parseUnits("1000", 18));

      // Claim all
      await splitter.connect(payee1).releaseETH(await payee1.getAddress());
      await splitter.connect(payee2).releaseETH(await payee2.getAddress());
      await splitter.connect(payee1).releaseToken(await vanillaToken.getAddress(), await payee1.getAddress());
      await splitter.connect(payee2).releaseToken(await vanillaToken.getAddress(), await payee2.getAddress());

      // Change payees
      await splitter.connect(owner).setPayees(
        [await newPayee1.getAddress(), await newPayee2.getAddress()],
        [50, 50],
        [await vanillaToken.getAddress()]
      );

      expect(await splitter.shares(await newPayee1.getAddress())).to.equal(50);
      expect(await splitter.shares(await newPayee2.getAddress())).to.equal(50);
      expect(await splitter.shares(await payee1.getAddress())).to.equal(0);
      expect(await splitter.shares(await payee2.getAddress())).to.equal(0);
    });

    it("should revert if ETH pending", async function () {
      await owner.sendTransaction({
        to: await splitter.getAddress(),
        value: ethers.parseEther("1"),
      });

      await expect(
        splitter.connect(owner).setPayees(
          [await newPayee1.getAddress()],
          [1],
          []
        )
      ).to.be.revertedWith("eth pending");
    });

    it("should revert if token pending", async function () {
      await vanillaToken.mint(await owner.getAddress(), ethers.parseUnits("100", 18));
      await vanillaToken.transfer(await splitter.getAddress(), ethers.parseUnits("100", 18));

      await expect(
        splitter.connect(owner).setPayees(
          [await newPayee1.getAddress()],
          [1],
          [await vanillaToken.getAddress()]
        )
      ).to.be.revertedWith("token pending");
    });

    it("should revert on duplicate payees", async function () {
      await expect(
        splitter.connect(owner).setPayees(
          [await newPayee1.getAddress(), await newPayee1.getAddress()],
          [1, 1],
          []
        )
      ).to.be.revertedWith("duplicate payee");
    });

    it("should revert if non-owner tries to change payees", async function () {
      await expect(
        splitter.connect(stranger).setPayees(
          [await newPayee1.getAddress()],
          [1],
          []
        )
      ).to.be.revertedWithCustomError(splitter, "OwnableUnauthorizedAccount");
    });
  });

  describe("Edge Cases", function () {
    it("should revert when releasing with no shares", async function () {
      await expect(
        splitter.connect(stranger).releaseETH(await stranger.getAddress())
      ).to.be.revertedWith("no shares");
    });

    it("should revert when releasing with nothing due", async function () {
      await expect(
        splitter.connect(payee1).releaseETH(await payee1.getAddress())
      ).to.be.revertedWith("nothing due");
    });

    it("should handle multiple releases correctly", async function () {
      await owner.sendTransaction({
        to: await splitter.getAddress(),
        value: ethers.parseEther("1"),
      });

      await splitter.connect(payee1).releaseETH(await payee1.getAddress());
      expect(await splitter.pendingETH(await payee1.getAddress())).to.equal(0);

      await owner.sendTransaction({
        to: await splitter.getAddress(),
        value: ethers.parseEther("2"),
      });

      expect(await splitter.pendingETH(await payee1.getAddress())).to.equal(ethers.parseEther("1.4"));
    });
  });
});

