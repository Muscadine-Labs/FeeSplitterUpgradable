// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FeeSplitterImmutable
/// @notice Ultra-minimal, fully immutable pull-based splitter for ETH and ERC20.
///         No owner, no upgrades, no configuration changes - set once at deployment, fixed forever.
/// @dev Uses "actual-sent" accounting for ERC20 to support fee-on-transfer tokens.
contract FeeSplitterImmutable is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- immutable storage ---
    uint256 private immutable _totalShares;
    address private immutable _payee1;
    address private immutable _payee2;
    uint256 private immutable _shares1;
    uint256 private immutable _shares2;

    // --- mutable accounting ---
    mapping(address => uint256) private _releasedETH;
    mapping(IERC20 => mapping(address => uint256)) private _releasedERC20;
    uint256 private _totalReleasedETH;
    mapping(IERC20 => uint256) private _totalReleasedERC20;

    // --- events ---
    event PaymentReleased(address indexed to, uint256 amount);
    event ERC20PaymentReleased(IERC20 indexed token, address indexed to, uint256 amount);

    constructor(address payee1_, address payee2_, uint256 shares1_, uint256 shares2_) {
        require(payee1_ != address(0) && payee2_ != address(0), "payee=0");
        require(shares1_ > 0 && shares2_ > 0, "shares=0");
        require(payee1_ != payee2_, "duplicate payee");
        
        _payee1 = payee1_;
        _payee2 = payee2_;
        _shares1 = shares1_;
        _shares2 = shares2_;
        _totalShares = shares1_ + shares2_;
    }

    receive() external payable {}

    // --- views ---
    function totalShares() external view returns (uint256) { return _totalShares; }
    
    function payee1() external view returns (address) { return _payee1; }
    function payee2() external view returns (address) { return _payee2; }
    
    function shares(address a) external view returns (uint256) {
        if (a == _payee1) return _shares1;
        if (a == _payee2) return _shares2;
        return 0;
    }

    function pendingETH(address a) public view returns (uint256) {
        uint256 share = a == _payee1 ? _shares1 : (a == _payee2 ? _shares2 : 0);
        if (share == 0) return 0;
        
        uint256 totalReceived = address(this).balance + _totalReleasedETH;
        uint256 due = (totalReceived * share) / _totalShares;
        uint256 rel = _releasedETH[a];
        return due > rel ? due - rel : 0;
    }

    function pendingToken(IERC20 token, address a) public view returns (uint256) {
        uint256 share = a == _payee1 ? _shares1 : (a == _payee2 ? _shares2 : 0);
        if (share == 0) return 0;
        
        uint256 totalReceived = token.balanceOf(address(this)) + _totalReleasedERC20[token];
        uint256 due = (totalReceived * share) / _totalShares;
        uint256 rel = _releasedERC20[token][a];
        return due > rel ? due - rel : 0;
    }

    // --- release ---
    function releaseETH(address payable a) external nonReentrant {
        require(a == _payee1 || a == _payee2, "not payee");
        uint256 amt = pendingETH(a);
        require(amt > 0, "nothing due");
        
        _releasedETH[a] += amt;
        _totalReleasedETH += amt;
        
        (bool ok, ) = a.call{value: amt}("");
        require(ok, "eth xfer fail");
        
        emit PaymentReleased(a, amt);
    }

    function releaseToken(IERC20 token, address a) external nonReentrant {
        require(a == _payee1 || a == _payee2, "not payee");
        uint256 amt = pendingToken(token, a);
        require(amt > 0, "nothing due");

        // actual-sent accounting (handles deflationary tokens)
        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransfer(a, amt);
        uint256 sent = balBefore - token.balanceOf(address(this));
        require(sent > 0, "token sent=0");

        _releasedERC20[token][a] += sent;
        _totalReleasedERC20[token] += sent;
        
        emit ERC20PaymentReleased(token, a, sent);
    }
}

