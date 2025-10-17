import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC20FeeSplitter, ERC20Mock } from "../typechain-types";

describe("Gas Analysis", function () {
  let splitter: ERC20FeeSplitter;
  let token: ERC20Mock;
  let payee1: any;
  let payee2: any;
  let deployer: any;

  beforeEach(async function () {
    [deployer, payee1, payee2] = await ethers.getSigners();

    // Deploy ERC20FeeSplitter
    const Splitter = await ethers.getContractFactory("ERC20FeeSplitter");
    splitter = await Splitter.deploy(
      await payee1.getAddress(),
      await payee2.getAddress(),
      1, // shares1 (50%)
      1  // shares2 (50%)
    );

    // Deploy mock token
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");
    token = await TokenFactory.deploy("Test Token", "TEST", 18);
  });

  it("should measure gas usage for deployment", async function () {
    const Splitter = await ethers.getContractFactory("ERC20FeeSplitter");
    const tx = await Splitter.deploy(
      await payee1.getAddress(),
      await payee2.getAddress(),
      1,
      1
    );
    const receipt = await tx.deploymentTransaction()?.wait();
    console.log(`\n📊 DEPLOYMENT GAS USAGE:`);
    console.log(`   Gas Used: ${receipt?.gasUsed.toString()}`);
    console.log(`   Gas Price: ${receipt?.gasPrice?.toString()} wei`);
  });

  it("should measure gas usage for claim", async function () {
    // Send tokens to contract
    const amount = ethers.parseEther("1000");
    await token.mint(await deployer.getAddress(), amount);
    await token.transfer(await splitter.getAddress(), amount);

    // Measure claim gas
    const tx = await splitter.connect(payee1).claim(token, await payee1.getAddress());
    const receipt = await tx.wait();
    console.log(`\n📊 CLAIM GAS USAGE:`);
    console.log(`   Gas Used: ${receipt?.gasUsed.toString()}`);
    console.log(`   Gas Price: ${receipt?.gasPrice?.toString()} wei`);
  });

  it("should measure gas usage for claimAll", async function () {
    // Send tokens to contract
    const amount = ethers.parseEther("1000");
    await token.mint(await deployer.getAddress(), amount);
    await token.transfer(await splitter.getAddress(), amount);

    // Measure claimAll gas
    const tx = await splitter.connect(payee1).claimAll(token);
    const receipt = await tx.wait();
    console.log(`\n📊 CLAIM ALL GAS USAGE:`);
    console.log(`   Gas Used: ${receipt?.gasUsed.toString()}`);
    console.log(`   Gas Price: ${receipt?.gasPrice?.toString()} wei`);
  });

  it("should measure gas usage for view functions", async function () {
    // Measure view function gas (should be 0 for static calls)
    console.log(`\n📊 VIEW FUNCTION GAS USAGE:`);
    console.log(`   pendingToken: ${(await splitter.pendingToken.staticCall(token, await payee1.getAddress())).toString()}`);
    console.log(`   releasedToken: ${(await splitter.releasedToken.staticCall(token, await payee1.getAddress())).toString()}`);
    console.log(`   totalReleased: ${(await splitter.totalReleased.staticCall(token)).toString()}`);
  });
});
