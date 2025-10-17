// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Minimal ERC-4626 interface for Morpho V1 & V2 vault compatibility
interface IERC4626 {
    /// @notice Redeems shares for underlying assets
    /// @param shares Amount of shares to redeem
    /// @param receiver Address to receive underlying assets
    /// @param owner Address that owns the shares
    /// @return assets Amount of underlying assets received
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    /// @notice Withdraws assets by burning shares
    /// @param assets Amount of underlying assets to withdraw
    /// @param receiver Address to receive underlying assets
    /// @param owner Address that owns the shares
    /// @return shares Amount of shares burned
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    /// @notice Preview how many assets would be received from redeeming shares
    /// @param shares Amount of shares to redeem
    /// @return assets Expected amount of underlying assets
    function previewRedeem(uint256 shares) external view returns (uint256 assets);

    /// @notice Preview how many shares would be burned for withdrawing assets
    /// @param assets Amount of underlying assets to withdraw
    /// @return shares Expected amount of shares to burn
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);

    /// @notice Maximum amount of shares that can be redeemed by owner
    /// @param owner Address that owns the shares
    /// @return shares Maximum redeemable shares
    function maxRedeem(address owner) external view returns (uint256 shares);

    /// @notice Maximum amount of assets that can be withdrawn by owner
    /// @param owner Address that owns the shares
    /// @return assets Maximum withdrawable assets
    function maxWithdraw(address owner) external view returns (uint256 assets);
}

/// @title FeeSplitterImmutable
/// @notice Ultra-minimal, fully immutable pull-based splitter for ETH and ERC20.
///         Also includes Morpho vault fee claiming functionality.
///         No owner, no upgrades, no configuration changes - set once at deployment, fixed forever.
/// @dev Uses "actual-sent" accounting for ERC20 to support fee-on-transfer tokens.
///      Supports Morpho V1 & V2 vault fee redemption via ERC-4626 interface.
contract FeeSplitterImmutable is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- custom errors ---
    error InvalidPayee();
    error InvalidShares();
    error DuplicatePayee();
    error NotPayee();
    error NothingDue();
    error ETHTransferFailed();
    error TokenTransferFailed();
    error VaultZeroAddress();
    error NoFeeShares();
    error PreviewZero();
    error RedeemZero();
    error LimitZero();
    error AssetsZero();
    error WithdrawCapped();
    error SharesZero();
    error InsufficientFeeShares();
    error WithdrawZero();

    // --- immutable storage ---
    uint256 private immutable _TOTAL_SHARES;
    address private immutable _PAYEE1;
    address private immutable _PAYEE2;
    uint256 private immutable _SHARES1;
    uint256 private immutable _SHARES2;

    // --- mutable accounting ---
    mapping(address => uint256) private _releasedETH;
    mapping(IERC20 => mapping(address => uint256)) private _releasedERC20;
    uint256 private _totalReleasedETH;
    mapping(IERC20 => uint256) private _totalReleasedERC20;

    // --- events ---
    event PaymentReleased(address indexed to, uint256 amount);
    event ERC20PaymentReleased(IERC20 indexed token, address indexed to, uint256 amount);
    event VaultFeesClaimed(address indexed vault, uint256 shares, uint256 assets, address indexed receiver);

    constructor(address payee1_, address payee2_, uint256 shares1_, uint256 shares2_) {
        if (payee1_ == address(0) || payee2_ == address(0)) revert InvalidPayee();
        if (shares1_ == 0 || shares2_ == 0) revert InvalidShares();
        if (payee1_ == payee2_) revert DuplicatePayee();

        _PAYEE1 = payee1_;
        _PAYEE2 = payee2_;
        _SHARES1 = shares1_;
        _SHARES2 = shares2_;
        _TOTAL_SHARES = shares1_ + shares2_;
    }

    receive() external payable {}

    // --- views ---
    function totalShares() external view returns (uint256) {
        return _TOTAL_SHARES;
    }

    function payee1() external view returns (address) {
        return _PAYEE1;
    }
    function payee2() external view returns (address) {
        return _PAYEE2;
    }

    function shares(address a) external view returns (uint256) {
        if (a == _PAYEE1) return _SHARES1;
        if (a == _PAYEE2) return _SHARES2;
        return 0;
    }

    function pendingETH(address a) public view returns (uint256) {
        uint256 share = a == _PAYEE1 ? _SHARES1 : (a == _PAYEE2 ? _SHARES2 : 0);
        if (share == 0) return 0;

        uint256 totalReceived = address(this).balance + _totalReleasedETH;
        uint256 due = (totalReceived * share) / _TOTAL_SHARES;
        uint256 rel = _releasedETH[a];
        return due > rel ? due - rel : 0;
    }

    function pendingToken(IERC20 token, address a) public view returns (uint256) {
        uint256 share = a == _PAYEE1 ? _SHARES1 : (a == _PAYEE2 ? _SHARES2 : 0);
        if (share == 0) return 0;

        uint256 totalReceived = token.balanceOf(address(this)) + _totalReleasedERC20[token];
        uint256 due = (totalReceived * share) / _TOTAL_SHARES;
        uint256 rel = _releasedERC20[token][a];
        return due > rel ? due - rel : 0;
    }

    // --- release ---
    function releaseETH(address payable a) external nonReentrant {
        if (a != _PAYEE1 && a != _PAYEE2) revert NotPayee();
        uint256 amt = pendingETH(a);
        if (amt == 0) revert NothingDue();

        _releasedETH[a] += amt;
        _totalReleasedETH += amt;

        (bool ok, ) = a.call{value: amt}("");
        if (!ok) revert ETHTransferFailed();

        emit PaymentReleased(a, amt);
    }

    function releaseToken(IERC20 token, address a) external nonReentrant {
        if (a != _PAYEE1 && a != _PAYEE2) revert NotPayee();
        uint256 amt = pendingToken(token, a);
        if (amt == 0) revert NothingDue();

        // actual-sent accounting (handles deflationary tokens)
        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransfer(a, amt);
        uint256 sent = balBefore - token.balanceOf(address(this));
        if (sent == 0) revert TokenTransferFailed();

        _releasedERC20[token][a] += sent;
        _totalReleasedERC20[token] += sent;

        emit ERC20PaymentReleased(token, a, sent);
    }

    // --- vault fee claiming ---

    /// @notice Claims all fee shares from a Morpho vault and routes underlying assets to this splitter
    /// @param vault Address of the Morpho vault (also the ERC20 shares token)
    /// @return assetsOut Amount of underlying assets received
    /// @dev Works with both Morpho V1 and V2 vaults
    function claimAllVaultFees(address vault) external nonReentrant returns (uint256 assetsOut) {
        if (vault == address(0)) revert VaultZeroAddress();

        // Get our balance of vault shares (fee shares)
        uint256 vaultShares = IERC20(vault).balanceOf(address(this));
        if (vaultShares == 0) revert NoFeeShares();

        // Preview the redemption for safety
        uint256 preview = IERC4626(vault).previewRedeem(vaultShares);
        if (preview == 0) revert PreviewZero();

        // Redeem all shares for underlying assets, routing to this contract
        assetsOut = IERC4626(vault).redeem(vaultShares, address(this), address(this));
        if (assetsOut == 0) revert RedeemZero();

        emit VaultFeesClaimed(vault, vaultShares, assetsOut, address(this));
    }

    /// @notice Claims vault fees up to the maximum allowed limit (respects vault withdrawal limits)
    /// @param vault Address of the Morpho vault
    /// @return sharesBurned Amount of shares redeemed
    /// @return assetsOut Amount of underlying assets received
    /// @dev Useful when vault has withdrawal limits or gates
    function claimVaultFeesUpToLimit(
        address vault
    ) external nonReentrant returns (uint256 sharesBurned, uint256 assetsOut) {
        if (vault == address(0)) revert VaultZeroAddress();

        uint256 myVaultShares = IERC20(vault).balanceOf(address(this));
        if (myVaultShares == 0) revert NoFeeShares();

        // Check vault withdrawal limits
        uint256 limit = IERC4626(vault).maxRedeem(address(this));
        if (limit == type(uint256).max || limit == 0) {
            // No limit or temporary 0 limit, use all our shares
            limit = myVaultShares;
        } else if (limit > myVaultShares) {
            // Limit is higher than our balance, use our balance
            limit = myVaultShares;
        }

        sharesBurned = limit;
        if (sharesBurned == 0) revert LimitZero();

        // Preview the redemption
        uint256 preview = IERC4626(vault).previewRedeem(sharesBurned);
        if (preview == 0) revert PreviewZero();

        // Redeem shares for underlying assets
        assetsOut = IERC4626(vault).redeem(sharesBurned, address(this), address(this));
        if (assetsOut == 0) revert RedeemZero();

        emit VaultFeesClaimed(vault, sharesBurned, assetsOut, address(this));
    }

    /// @notice Claims exact amount of underlying assets from vault fees
    /// @param vault Address of the Morpho vault
    /// @param assets Amount of underlying assets to claim
    /// @return sharesBurned Amount of shares redeemed
    /// @return assetsOut Amount of underlying assets actually received
    /// @dev Useful when you want to claim a specific amount of underlying assets
    function claimExactVaultAssets(
        address vault,
        uint256 assets
    ) external nonReentrant returns (uint256 sharesBurned, uint256 assetsOut) {
        if (vault == address(0)) revert VaultZeroAddress();
        if (assets == 0) revert AssetsZero();

        // Check vault withdrawal limits
        uint256 maxAssets = IERC4626(vault).maxWithdraw(address(this));
        if (maxAssets == 0) revert WithdrawCapped();
        if (assets > maxAssets) assets = maxAssets;

        // Preview how many shares this will burn
        sharesBurned = IERC4626(vault).previewWithdraw(assets);
        if (sharesBurned == 0) revert SharesZero();

        // Check we have enough shares
        uint256 myVaultShares = IERC20(vault).balanceOf(address(this));
        if (myVaultShares < sharesBurned) revert InsufficientFeeShares();

        // Withdraw assets, routing to this contract
        uint256 sharesSpent = IERC4626(vault).withdraw(assets, address(this), address(this));
        if (sharesSpent == 0) revert WithdrawZero();

        emit VaultFeesClaimed(vault, sharesSpent, assets, address(this));
        return (sharesSpent, assets);
    }
}
