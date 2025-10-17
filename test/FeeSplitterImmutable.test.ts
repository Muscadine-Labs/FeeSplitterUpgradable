import { expect } from "chai";
import { ethers } from "hardhat";
import { FeeSplitterImmutable, ERC20Mock, DeflationaryMock } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("FeeSplitterImmutable", function () {
  let splitter: FeeSplitterImmutable;
  let usdc: ERC20Mock;
  let cbbtc: ERC20Mock;
  let weth: ERC20Mock;
  let deflToken: DeflationaryMock;
  let deployer: HardhatEthersSigner;
  let nick: HardhatEthersSigner;
  let ignas: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const NICK_ADDRESS = "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333";
  const IGNAS_ADDRESS = "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261";

  beforeEach(async function () {
    [deployer, nick, ignas, stranger] = await ethers.getSigners();

    // Deploy FeeSplitterImmutable with FIXED configuration
    const Splitter = await ethers.getContractFactory("FeeSplitterImmutable");
    splitter = await Splitter.deploy(
      NICK_ADDRESS, // payee1
      IGNAS_ADDRESS, // payee2
      1, // shares1 (50%)
      1, // shares2 (50%)
    );
    await splitter.waitForDeployment();

    // Deploy mock tokens
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");
    usdc = await TokenFactory.deploy("USD Coin", "USDC", 6);
    cbbtc = await TokenFactory.deploy("Coinbase BTC", "cbBTC", 8);
    weth = await TokenFactory.deploy("Wrapped ETH", "WETH", 18);

    const DeflFactory = await ethers.getContractFactory("DeflationaryMock");
    deflToken = await DeflFactory.deploy("Deflationary", "DEFL", 18);
  });

  describe("Deployment", function () {
    it("should set correct payees and shares (immutable)", async function () {
      expect(await splitter.payee1()).to.equal(NICK_ADDRESS);
      expect(await splitter.payee2()).to.equal(IGNAS_ADDRESS);
      expect(await splitter.shares(NICK_ADDRESS)).to.equal(1);
      expect(await splitter.shares(IGNAS_ADDRESS)).to.equal(1);
      expect(await splitter.totalShares()).to.equal(2);
    });

    it("should have no owner (fully immutable)", async function () {
      // Contract has no owner() function - this should not exist
      const contract = splitter as any;
      expect(contract.owner).to.be.undefined;
    });
  });

  describe("ETH Distribution", function () {
    it("should split ETH 50/50", async function () {
      const amount = ethers.parseEther("10");

      await deployer.sendTransaction({
        to: await splitter.getAddress(),
        value: amount,
      });

      expect(await splitter.pendingETH(NICK_ADDRESS)).to.equal(ethers.parseEther("5"));
      expect(await splitter.pendingETH(IGNAS_ADDRESS)).to.equal(ethers.parseEther("5"));
    });

    it("should allow both payees to claim ETH", async function () {
      const amount = ethers.parseEther("10");

      await deployer.sendTransaction({
        to: await splitter.getAddress(),
        value: amount,
      });

      // Impersonate payees
      await ethers.provider.send("hardhat_impersonateAccount", [NICK_ADDRESS]);
      await ethers.provider.send("hardhat_impersonateAccount", [IGNAS_ADDRESS]);

      const nickSigner = await ethers.getSigner(NICK_ADDRESS);
      const ignasSigner = await ethers.getSigner(IGNAS_ADDRESS);

      // Fund for gas
      await deployer.sendTransaction({ to: NICK_ADDRESS, value: ethers.parseEther("1") });
      await deployer.sendTransaction({ to: IGNAS_ADDRESS, value: ethers.parseEther("1") });

      // Claim
      await splitter.connect(nickSigner).releaseETH(NICK_ADDRESS);
      await splitter.connect(ignasSigner).releaseETH(IGNAS_ADDRESS);

      expect(await splitter.pendingETH(NICK_ADDRESS)).to.equal(0);
      expect(await splitter.pendingETH(IGNAS_ADDRESS)).to.equal(0);
    });
  });

  describe("Vault Tokens", function () {
    it("should split USDC vault fees 50/50", async function () {
      const fees = ethers.parseUnits("1000", 6);

      await usdc.mint(await deployer.getAddress(), fees);
      await usdc.transfer(await splitter.getAddress(), fees);

      expect(await splitter.pendingToken(await usdc.getAddress(), NICK_ADDRESS)).to.equal(
        ethers.parseUnits("500", 6),
      );
      expect(await splitter.pendingToken(await usdc.getAddress(), IGNAS_ADDRESS)).to.equal(
        ethers.parseUnits("500", 6),
      );
    });

    it("should split cbBTC vault fees 50/50", async function () {
      const fees = ethers.parseUnits("0.5", 8);

      await cbbtc.mint(await deployer.getAddress(), fees);
      await cbbtc.transfer(await splitter.getAddress(), fees);

      expect(await splitter.pendingToken(await cbbtc.getAddress(), NICK_ADDRESS)).to.equal(
        ethers.parseUnits("0.25", 8),
      );
      expect(await splitter.pendingToken(await cbbtc.getAddress(), IGNAS_ADDRESS)).to.equal(
        ethers.parseUnits("0.25", 8),
      );
    });

    it("should split WETH vault fees 50/50", async function () {
      const fees = ethers.parseUnits("10", 18);

      await weth.mint(await deployer.getAddress(), fees);
      await weth.transfer(await splitter.getAddress(), fees);

      expect(await splitter.pendingToken(await weth.getAddress(), NICK_ADDRESS)).to.equal(
        ethers.parseUnits("5", 18),
      );
      expect(await splitter.pendingToken(await weth.getAddress(), IGNAS_ADDRESS)).to.equal(
        ethers.parseUnits("5", 18),
      );
    });

    it("should handle all three vault tokens simultaneously", async function () {
      await usdc.mint(await deployer.getAddress(), ethers.parseUnits("1000", 6));
      await usdc.transfer(await splitter.getAddress(), ethers.parseUnits("1000", 6));

      await cbbtc.mint(await deployer.getAddress(), ethers.parseUnits("0.1", 8));
      await cbbtc.transfer(await splitter.getAddress(), ethers.parseUnits("0.1", 8));

      await weth.mint(await deployer.getAddress(), ethers.parseUnits("5", 18));
      await weth.transfer(await splitter.getAddress(), ethers.parseUnits("5", 18));

      // Verify all splits are 50/50
      expect(await splitter.pendingToken(await usdc.getAddress(), NICK_ADDRESS)).to.equal(
        ethers.parseUnits("500", 6),
      );
      expect(await splitter.pendingToken(await cbbtc.getAddress(), NICK_ADDRESS)).to.equal(
        ethers.parseUnits("0.05", 8),
      );
      expect(await splitter.pendingToken(await weth.getAddress(), NICK_ADDRESS)).to.equal(
        ethers.parseUnits("2.5", 18),
      );
    });
  });

  describe("Deflationary Token Support", function () {
    it("should handle deflationary tokens correctly", async function () {
      const amount = ethers.parseUnits("1000", 18);

      await deflToken.mint(await deployer.getAddress(), amount);
      await deflToken.transfer(await splitter.getAddress(), amount);

      const splitterBalance = await deflToken.balanceOf(await splitter.getAddress());
      expect(splitterBalance).to.equal(ethers.parseUnits("990", 18)); // 1% burned

      // Impersonate nick
      await ethers.provider.send("hardhat_impersonateAccount", [NICK_ADDRESS]);
      const nickSigner = await ethers.getSigner(NICK_ADDRESS);
      await deployer.sendTransaction({ to: NICK_ADDRESS, value: ethers.parseEther("1") });

      await splitter.connect(nickSigner).releaseToken(await deflToken.getAddress(), NICK_ADDRESS);

      const balance = await deflToken.balanceOf(NICK_ADDRESS);
      expect(balance).to.be.closeTo(ethers.parseUnits("490.05", 18), ethers.parseUnits("0.01", 18));
    });
  });

  describe("Immutability", function () {
    it("should not have owner function", async function () {
      const contract = splitter as any;
      expect(contract.owner).to.be.undefined;
    });

    it("should not have setPayees function", async function () {
      const contract = splitter as any;
      expect(contract.setPayees).to.be.undefined;
    });

    it("should not have pause function", async function () {
      const contract = splitter as any;
      expect(contract.pause).to.be.undefined;
    });

    it("should reject non-payee from claiming", async function () {
      await deployer.sendTransaction({
        to: await splitter.getAddress(),
        value: ethers.parseEther("1"),
      });

      await expect(
        splitter.connect(stranger).releaseETH(await stranger.getAddress()),
      ).to.be.revertedWith("not payee");
    });
  });

  describe("Edge Cases", function () {
    it("should revert when releasing with nothing due", async function () {
      await ethers.provider.send("hardhat_impersonateAccount", [NICK_ADDRESS]);
      const nickSigner = await ethers.getSigner(NICK_ADDRESS);
      await deployer.sendTransaction({ to: NICK_ADDRESS, value: ethers.parseEther("1") });

      await expect(splitter.connect(nickSigner).releaseETH(NICK_ADDRESS)).to.be.revertedWith(
        "nothing due",
      );
    });

    it("should handle multiple releases correctly", async function () {
      await deployer.sendTransaction({
        to: await splitter.getAddress(),
        value: ethers.parseEther("2"),
      });

      await ethers.provider.send("hardhat_impersonateAccount", [NICK_ADDRESS]);
      const nickSigner = await ethers.getSigner(NICK_ADDRESS);
      await deployer.sendTransaction({ to: NICK_ADDRESS, value: ethers.parseEther("1") });

      await splitter.connect(nickSigner).releaseETH(NICK_ADDRESS);
      expect(await splitter.pendingETH(NICK_ADDRESS)).to.equal(0);

      await deployer.sendTransaction({
        to: await splitter.getAddress(),
        value: ethers.parseEther("4"),
      });

      expect(await splitter.pendingETH(NICK_ADDRESS)).to.equal(ethers.parseEther("2"));
    });
  });
});
