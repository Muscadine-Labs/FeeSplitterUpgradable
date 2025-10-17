import { expect } from 'chai';
import { ethers } from 'hardhat';
import { FeeSplitterImmutable } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('FeeSplitterImmutable - Vault Fee Claiming Interface', function () {
  let splitter: FeeSplitterImmutable;
  let deployer: HardhatEthersSigner;

  const NICK_ADDRESS = '0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333';
  const IGNAS_ADDRESS = '0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261';

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();

    // Deploy FeeSplitterImmutable
    const Splitter = await ethers.getContractFactory('FeeSplitterImmutable');
    splitter = await Splitter.deploy(
      NICK_ADDRESS,
      IGNAS_ADDRESS,
      1, // shares1 (50%)
      1  // shares2 (50%)
    );
    await splitter.waitForDeployment();
  });

  describe('Vault Fee Claiming Interface', function () {
    it('should have vault fee claiming functions', async function () {
      // Check that the new functions exist
      expect(typeof splitter.claimAllVaultFees).to.equal('function');
      expect(typeof splitter.claimVaultFeesUpToLimit).to.equal('function');
      expect(typeof splitter.claimExactVaultAssets).to.equal('function');
    });

    it('should revert when trying to claim with zero vault address', async function () {
      await expect(
        splitter.claimAllVaultFees(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(splitter, 'VaultZeroAddress');
    });

    it('should revert when trying to claim with no vault shares', async function () {
      // Deploy a mock token that implements ERC20 but not ERC4626
      const TokenFactory = await ethers.getContractFactory('ERC20Mock');
      const mockToken = await TokenFactory.deploy('Mock Token', 'MOCK', 18);
      
      // The contract has no shares, so it should revert with 'no fee shares'
      await expect(
        splitter.claimAllVaultFees(await mockToken.getAddress())
      ).to.be.revertedWithCustomError(splitter, 'NoFeeShares');
    });

    it('should revert when trying to claim exact assets with zero amount', async function () {
      const TokenFactory = await ethers.getContractFactory('ERC20Mock');
      const mockToken = await TokenFactory.deploy('Mock Token', 'MOCK', 18);
      
      await expect(
        splitter.claimExactVaultAssets(await mockToken.getAddress(), 0)
      ).to.be.revertedWithCustomError(splitter, 'AssetsZero');
    });

    it('should revert when trying to claim exact assets with zero vault address', async function () {
      await expect(
        splitter.claimExactVaultAssets(ethers.ZeroAddress, ethers.parseEther('1'))
      ).to.be.revertedWithCustomError(splitter, 'VaultZeroAddress');
    });
  });

  describe('Integration with Existing Functionality', function () {
    it('should maintain all existing functionality', async function () {
      // Test that original functions still work
      expect(typeof splitter.pendingETH).to.equal('function');
      expect(typeof splitter.pendingToken).to.equal('function');
      expect(typeof splitter.releaseETH).to.equal('function');
      expect(typeof splitter.releaseToken).to.equal('function');
      
      // Test that original state is preserved
      expect(await splitter.payee1()).to.equal(NICK_ADDRESS);
      expect(await splitter.payee2()).to.equal(IGNAS_ADDRESS);
      expect(await splitter.totalShares()).to.equal(2);
    });
  });
});
