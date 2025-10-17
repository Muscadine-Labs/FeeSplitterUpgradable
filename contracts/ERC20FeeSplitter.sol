// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ERC20FeeSplitter
/// @notice Ultra-minimal, fully immutable pull-based splitter for ERC20 tokens only.
///         No owner, no upgrades, no configuration changes - set once at deployment, fixed forever.
/// @dev Uses "actual-sent" accounting for ERC20 to support fee-on-transfer tokens.
///      Supports splitting any ERC20 token, including vault share tokens (e.g., Morpho vault shares).
contract ERC20FeeSplitter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- custom errors ---
    error InvalidPayee();
    error InvalidShares();
    error DuplicatePayee();
    error NotPayee();
    error NothingDue();
    error TokenTransferFailed();

    // --- immutable storage ---
    uint256 public immutable TOTAL_SHARES;
    address public immutable PAYEE1;
    address public immutable PAYEE2;
    uint256 public immutable SHARES1;
    uint256 public immutable SHARES2;

    // --- mutable accounting ---
    mapping(IERC20 => mapping(address => uint256)) private _releasedERC20;
    mapping(IERC20 => uint256) private _totalReleasedERC20;

    // --- events ---
    event ERC20Claimed(IERC20 indexed token, address indexed to, uint256 amount);

    constructor(address payee1_, address payee2_, uint256 shares1_, uint256 shares2_) {
        if (payee1_ == address(0) || payee2_ == address(0)) revert InvalidPayee();
        if (shares1_ == 0 || shares2_ == 0) revert InvalidShares();
        if (payee1_ == payee2_) revert DuplicatePayee();

        PAYEE1 = payee1_;
        PAYEE2 = payee2_;
        SHARES1 = shares1_;
        SHARES2 = shares2_;
        TOTAL_SHARES = shares1_ + shares2_;
    }

    // --- views ---
    function shares(address a) external view returns (uint256) {
        if (a == PAYEE1) return SHARES1;
        if (a == PAYEE2) return SHARES2;
        return 0;
    }

    function releasedToken(IERC20 t, address a) external view returns (uint256) {
        return _releasedERC20[t][a];
    }

    function totalReleased(IERC20 t) external view returns (uint256) {
        return _totalReleasedERC20[t];
    }

    function pendingToken(IERC20 token, address a) public view returns (uint256) {
        uint256 share = a == PAYEE1 ? SHARES1 : (a == PAYEE2 ? SHARES2 : 0);
        if (share == 0) return 0;

        uint256 totalReceived = token.balanceOf(address(this)) + _totalReleasedERC20[token];
        uint256 due = (totalReceived * share) / TOTAL_SHARES;
        uint256 rel = _releasedERC20[token][a];
        return due > rel ? due - rel : 0;
    }

    // --- claim ---
    function claim(IERC20 token, address payee) external nonReentrant {
        if (payee != PAYEE1 && payee != PAYEE2) revert NotPayee();
        uint256 amount = pendingToken(token, payee);
        if (amount == 0) revert NothingDue();

        // actual-sent accounting (handles deflationary tokens)
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransfer(payee, amount);
        uint256 balanceAfter = token.balanceOf(address(this));
        if (balanceAfter >= balanceBefore) revert TokenTransferFailed(); // avoids underflow, handles 0-sent and positive rebase
        uint256 sent = balanceBefore - balanceAfter;

        _releasedERC20[token][payee] += sent;
        _totalReleasedERC20[token] += sent;

        emit ERC20Claimed(token, payee, sent);
    }

    function _claimFor(IERC20 token, address payee) private {
        uint256 amt = pendingToken(token, payee);
        if (amt == 0) return;
        uint256 b0 = token.balanceOf(address(this));
        token.safeTransfer(payee, amt);
        uint256 b1 = token.balanceOf(address(this));
        if (b1 >= b0) revert TokenTransferFailed();
        uint256 sent = b0 - b1;
        _releasedERC20[token][payee] += sent;
        _totalReleasedERC20[token] += sent;
        emit ERC20Claimed(token, payee, sent);
    }

    function claimAll(IERC20 token) external nonReentrant {
        _claimFor(token, PAYEE1);
        _claimFor(token, PAYEE2);
    }
}
