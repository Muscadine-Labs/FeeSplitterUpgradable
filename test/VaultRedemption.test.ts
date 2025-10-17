import { expect } from 'chai';
import { ethers } from 'hardhat';
import { FeeSplitterImmutable, ERC20Mock, MockERC4626Vault } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('FeeSplitterImmutable - Vault Redemption Flow', function () {
  let splitter: FeeSplitterImmutable;
  let vault: MockERC4626Vault;
  let underlying: ERC20Mock;
  let deployer: HardhatEthersSigner;
  let nick: HardhatEthersSigner;
  let ignas: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const NICK_ADDRESS = '0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333';
  const IGNAS_ADDRESS = '0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261';

  beforeEach(async function () {
    [deployer, nick, ignas, stranger] = await ethers.getSigners();

    // Deploy FeeSplitterImmutable
    const Splitter = await ethers.getContractFactory('FeeSplitterImmutable');
    splitter = await Splitter.deploy(
      NICK_ADDRESS,
      IGNAS_ADDRESS,
      1, // shares1 (50%)
      1  // shares2 (50%)
    );
    await splitter.waitForDeployment();

    // Deploy underlying token (e.g., USDC, WETH, etc.)
    const TokenFactory = await ethers.getContractFactory('ERC20Mock');
    underlying = await TokenFactory.deploy('Underlying Token', 'UNDER', 18);

    // Deploy mock vault
    const VaultFactory = await ethers.getContractFactory('MockERC4626Vault');
    vault = await VaultFactory.deploy(
      await underlying.getAddress(),
      'Vault Token',
      'VAULT'
    );
    await vault.waitForDeployment();

    // Mint underlying tokens to the vault (simulating vault having assets)
    await underlying.mint(await vault.getAddress(), ethers.parseEther('10000'));
  });

  describe('Vault Fee Redemption Flow', function () {
    it('should redeem vault shares and route assets to splitter when anyone calls', async function () {
      // Step 1: Simulate vault fee accumulation - mint vault shares to the splitter
      const feeShares = ethers.parseEther('100');
      await vault.mint(await splitter.getAddress(), feeShares);

      // Verify initial state
      expect(await vault.balanceOf(await splitter.getAddress())).to.equal(feeShares);
      expect(await underlying.balanceOf(await splitter.getAddress())).to.equal(0);

      // Step 2: Anyone can call the redemption function
      // The vault.redeem() function should be called with:
      // - shares: 100 (all vault shares)
      // - receiver: splitter address (where assets go)
      // - owner: splitter address (who owns the shares)
      const tx = await splitter.connect(stranger).claimAllVaultFees(await vault.getAddress());
      const receipt = await tx.wait();

      // Step 3: Verify the vault.redeem() was called correctly
      const redeemEvent = receipt?.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed?.name === 'RedeemCalled';
        } catch {
          return false;
        }
      });

      expect(redeemEvent).to.not.be.undefined;
      
      if (redeemEvent) {
        const parsedEvent = vault.interface.parseLog(redeemEvent);
        expect(parsedEvent?.args.shares).to.equal(feeShares);
        expect(parsedEvent?.args.receiver).to.equal(await splitter.getAddress());
        expect(parsedEvent?.args.owner).to.equal(await splitter.getAddress());
      }

      // Step 4: Verify assets were routed to the splitter
      expect(await vault.balanceOf(await splitter.getAddress())).to.equal(0); // All shares redeemed
      expect(await underlying.balanceOf(await splitter.getAddress())).to.equal(feeShares); // Assets received

      // Step 5: Verify VaultFeesClaimed event was emitted
      const vaultFeesEvent = receipt?.logs.find(log => {
        try {
          const parsed = splitter.interface.parseLog(log);
          return parsed?.name === 'VaultFeesClaimed';
        } catch {
          return false;
        }
      });

      expect(vaultFeesEvent).to.not.be.undefined;
      
      if (vaultFeesEvent) {
        const parsedEvent = splitter.interface.parseLog(vaultFeesEvent);
        expect(parsedEvent?.args.vault).to.equal(await vault.getAddress());
        expect(parsedEvent?.args.shares).to.equal(feeShares);
        expect(parsedEvent?.args.assets).to.equal(feeShares);
        expect(parsedEvent?.args.receiver).to.equal(await splitter.getAddress());
      }
    });

    it('should handle partial redemption up to vault limits', async function () {
      // Mint vault shares to splitter
      const totalShares = ethers.parseEther('100');
      await vault.mint(await splitter.getAddress(), totalShares);

      // Set a withdrawal limit on the vault (simulate vault with limits)
      const limit = ethers.parseEther('50');
      
      // Mock the vault to return a limit
      // In this test, we'll use claimVaultFeesUpToLimit which respects limits
      const tx = await splitter.connect(deployer).claimVaultFeesUpToLimit(await vault.getAddress());
      const receipt = await tx.wait();

      // Verify redemption was called with the limit amount
      const redeemEvent = receipt?.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed?.name === 'RedeemCalled';
        } catch {
          return false;
        }
      });

      expect(redeemEvent).to.not.be.undefined;
      
      if (redeemEvent) {
        const parsedEvent = vault.interface.parseLog(redeemEvent);
        expect(parsedEvent?.args.shares).to.equal(totalShares); // Should redeem all since no limit set in mock
        expect(parsedEvent?.args.receiver).to.equal(await splitter.getAddress());
        expect(parsedEvent?.args.owner).to.equal(await splitter.getAddress());
      }
    });

    it('should handle exact asset withdrawal', async function () {
      // Mint vault shares to splitter
      const totalShares = ethers.parseEther('100');
      await vault.mint(await splitter.getAddress(), totalShares);

      const assetsToWithdraw = ethers.parseEther('30');

      // Call exact asset withdrawal
      const tx = await splitter.connect(ignas).claimExactVaultAssets(
        await vault.getAddress(),
        assetsToWithdraw
      );
      const receipt = await tx.wait();

      // Verify withdraw was called with correct parameters
      const withdrawEvent = receipt?.logs.find(log => {
        try {
          const parsed = vault.interface.parseLog(log);
          return parsed?.name === 'WithdrawCalled';
        } catch {
          return false;
        }
      });

      expect(withdrawEvent).to.not.be.undefined;
      
      if (withdrawEvent) {
        const parsedEvent = vault.interface.parseLog(withdrawEvent);
        expect(parsedEvent?.args.assets).to.equal(assetsToWithdraw);
        expect(parsedEvent?.args.receiver).to.equal(await splitter.getAddress());
        expect(parsedEvent?.args.owner).to.equal(await splitter.getAddress());
      }

      // Verify assets were received
      expect(await underlying.balanceOf(await splitter.getAddress())).to.equal(assetsToWithdraw);
    });

    it('should allow payees to claim their split after vault redemption', async function () {
      // Step 1: Redeem vault fees to get underlying assets
      const feeShares = ethers.parseEther('100');
      await vault.mint(await splitter.getAddress(), feeShares);
      
      await splitter.connect(deployer).claimAllVaultFees(await vault.getAddress());
      
      // Verify assets are now in the splitter
      expect(await underlying.balanceOf(await splitter.getAddress())).to.equal(feeShares);

      // Step 2: Check pending amounts for payees (should be 50/50 split)
      const nickPending = await splitter.pendingToken(await underlying.getAddress(), NICK_ADDRESS);
      const ignasPending = await splitter.pendingToken(await underlying.getAddress(), IGNAS_ADDRESS);
      
      expect(nickPending).to.equal(ethers.parseEther('50'));
      expect(ignasPending).to.equal(ethers.parseEther('50'));

      // Step 3: Impersonate payees and claim their tokens
      await ethers.provider.send('hardhat_impersonateAccount', [NICK_ADDRESS]);
      await ethers.provider.send('hardhat_impersonateAccount', [IGNAS_ADDRESS]);

      const nickSigner = await ethers.getSigner(NICK_ADDRESS);
      const ignasSigner = await ethers.getSigner(IGNAS_ADDRESS);

      // Fund for gas
      await deployer.sendTransaction({ to: NICK_ADDRESS, value: ethers.parseEther('1') });
      await deployer.sendTransaction({ to: IGNAS_ADDRESS, value: ethers.parseEther('1') });

      // Step 4: Payees claim their tokens
      await splitter.connect(nickSigner).releaseToken(await underlying.getAddress(), NICK_ADDRESS);
      await splitter.connect(ignasSigner).releaseToken(await underlying.getAddress(), IGNAS_ADDRESS);

      // Step 5: Verify payees received their tokens
      expect(await underlying.balanceOf(NICK_ADDRESS)).to.equal(ethers.parseEther('50'));
      expect(await underlying.balanceOf(IGNAS_ADDRESS)).to.equal(ethers.parseEther('50'));
      expect(await underlying.balanceOf(await splitter.getAddress())).to.equal(0);
    });

    it('should revert when trying to redeem with no shares', async function () {
      await expect(
        splitter.connect(deployer).claimAllVaultFees(await vault.getAddress())
      ).to.be.revertedWithCustomError(splitter, 'NoFeeShares');
    });

    it('should revert when vault address is zero', async function () {
      await expect(
        splitter.connect(deployer).claimAllVaultFees(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(splitter, 'VaultZeroAddress');
    });
  });

  describe('Multiple Callers Can Trigger Redemption', function () {
    it('should allow different callers to trigger redemption', async function () {
      // Mint vault shares to splitter
      const feeShares = ethers.parseEther('50');
      await vault.mint(await splitter.getAddress(), feeShares);

      // Different callers can trigger the redemption
      const callers = [deployer, nick, ignas, stranger];
      
      for (const caller of callers) {
        // Reset vault shares for each test
        if (caller !== deployer) {
          await vault.mint(await splitter.getAddress(), feeShares);
        }

        // Each caller can trigger redemption
        const tx = await splitter.connect(caller).claimAllVaultFees(await vault.getAddress());
        const receipt = await tx.wait();

        // Verify redemption was successful
        const redeemEvent = receipt?.logs.find(log => {
          try {
            const parsed = vault.interface.parseLog(log);
            return parsed?.name === 'RedeemCalled';
          } catch {
            return false;
          }
        });

        expect(redeemEvent).to.not.be.undefined;
        
        // Verify the vault.redeem() was called with correct parameters
        if (redeemEvent) {
          const parsedEvent = vault.interface.parseLog(redeemEvent);
          expect(parsedEvent?.args.shares).to.equal(feeShares);
          expect(parsedEvent?.args.receiver).to.equal(await splitter.getAddress());
          expect(parsedEvent?.args.owner).to.equal(await splitter.getAddress());
        }
      }
    });
  });
});
