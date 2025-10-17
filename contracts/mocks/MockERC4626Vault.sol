// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockERC4626Vault
/// @notice Mock ERC4626 vault for testing fee claiming functionality
/// @dev Implements the ERC4626 interface needed for Morpho vault interactions
contract MockERC4626Vault is ERC20 {
    // --- custom errors ---
    error AssetsZero();
    error InsufficientShares();
    error SharesZero();

    IERC20 public immutable ASSET;
    uint256 private _totalAssets;

    event RedeemCalled(uint256 shares, address receiver, address owner);
    event WithdrawCalled(uint256 assets, address receiver, address owner);

    constructor(address _asset, string memory name, string memory symbol) ERC20(name, symbol) {
        ASSET = IERC20(_asset);
        _totalAssets = 1000000 * 10 ** 18; // Mock total assets
    }

    /// @notice Mint vault shares to any address (for testing only)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Set total assets (for testing)
    function setTotalAssets(uint256 assets) external {
        _totalAssets = assets;
    }

    /// @notice Get total assets
    function totalAssets() external view returns (uint256) {
        return _totalAssets;
    }

    /// @notice Redeem shares for assets
    /// @param shares Amount of shares to redeem
    /// @param receiver Address to receive underlying assets
    /// @param owner Address that owns the shares
    /// @return assets Amount of underlying assets received
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        if (shares == 0) revert SharesZero();
        if (balanceOf(owner) < shares) revert InsufficientShares();

        // Emit event for testing
        emit RedeemCalled(shares, receiver, owner);

        // Calculate assets to return (1:1 for simplicity in tests)
        assets = shares;

        // Burn shares from owner
        _burn(owner, shares);

        // In a real vault, this would transfer underlying assets to receiver
        // For testing, we'll mint the underlying asset to the receiver
        // This simulates the vault having underlying assets and transferring them
        ASSET.transfer(receiver, assets);

        return assets;
    }

    /// @notice Withdraw assets by burning shares
    /// @param assets Amount of underlying assets to withdraw
    /// @param receiver Address to receive underlying assets
    /// @param owner Address that owns the shares
    /// @return shares Amount of shares burned
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
        if (assets == 0) revert AssetsZero();
        if (balanceOf(owner) < assets) revert InsufficientShares();

        // Emit event for testing
        emit WithdrawCalled(assets, receiver, owner);

        // For simplicity, shares = assets (1:1 ratio)
        shares = assets;

        // Burn shares equal to assets
        _burn(owner, shares);

        // Transfer underlying assets to receiver
        ASSET.transfer(receiver, assets);

        return shares;
    }

    /// @notice Preview how many assets would be received from redeeming shares
    function previewRedeem(uint256 shares) external pure returns (uint256) {
        return shares; // 1:1 for simplicity
    }

    /// @notice Preview how many shares would be burned for withdrawing assets
    function previewWithdraw(uint256 assets) external pure returns (uint256) {
        return assets; // 1:1 for simplicity
    }

    /// @notice Maximum amount of shares that can be redeemed by owner
    function maxRedeem(address owner) external view returns (uint256) {
        return balanceOf(owner);
    }

    /// @notice Maximum amount of assets that can be withdrawn by owner
    function maxWithdraw(address owner) external view returns (uint256) {
        return balanceOf(owner);
    }

    /// @notice Deposit assets and mint shares (for testing)
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        if (assets == 0) revert AssetsZero();

        // Transfer assets from caller to vault
        ASSET.transferFrom(msg.sender, address(this), assets);

        // Mint shares to receiver (1:1 for simplicity)
        shares = assets;
        _mint(receiver, shares);

        return shares;
    }

    /// @notice Mint underlying assets to this vault (for testing)
    function mintUnderlying(uint256 amount) external {
        // This simulates the vault having underlying assets
        // In a real scenario, these would come from user deposits
        ASSET.transfer(address(this), amount);
    }
}
