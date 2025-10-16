// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FeeSplitterSimple
/// @notice Minimal pull-based splitter for ETH and ERC20. No credits, no checkpoints.
///         Owner can replace payees/shares only when all pending balances are zero.
/// @dev Uses "actual-sent" accounting for ERC20 to support fee-on-transfer tokens.
contract FeeSplitterSimple is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- storage ---
    uint256 private _totalShares;
    mapping(address => uint256) private _shares;              // payee => shares
    address[] private _payees;

    uint256 private _totalReleasedETH;
    mapping(address => uint256) private _releasedETH;         // payee => eth released

    mapping(IERC20 => uint256) private _totalReleasedERC20;   // token => total released
    mapping(IERC20 => mapping(address => uint256)) private _releasedERC20; // token => payee => released

    // --- events ---
    event PayeeAdded(address indexed account, uint256 shares);
    event PayeesReconfigured(address[] accounts, uint256[] shares);
    event PaymentReleased(address indexed to, uint256 amount);
    event ERC20PaymentReleased(IERC20 indexed token, address indexed to, uint256 amount);

    constructor(address owner_, address[] memory payees_, uint256[] memory shares_) Ownable(owner_) {
        require(owner_ != address(0), "owner=0");
        require(payees_.length == shares_.length && payees_.length > 0, "bad arrays");
        for (uint256 i = 0; i < payees_.length; ++i) _addPayee(payees_[i], shares_[i]);
    }

    receive() external payable {}

    // --- views ---
    function totalShares() external view returns (uint256) { return _totalShares; }
    function shares(address a) external view returns (uint256) { return _shares[a]; }
    function payees() external view returns (address[] memory) { return _payees; }

    function pendingETH(address a) public view returns (uint256) {
        if (_shares[a] == 0) return 0;
        uint256 totalReceived = address(this).balance + _totalReleasedETH;
        uint256 due = (totalReceived * _shares[a]) / _totalShares;
        uint256 rel = _releasedETH[a];
        return due > rel ? due - rel : 0;
    }

    function pendingToken(IERC20 token, address a) public view returns (uint256) {
        if (_shares[a] == 0) return 0;
        uint256 totalReceived = token.balanceOf(address(this)) + _totalReleasedERC20[token];
        uint256 due = (totalReceived * _shares[a]) / _totalShares;
        uint256 rel = _releasedERC20[token][a];
        return due > rel ? due - rel : 0;
    }

    // --- release ---
    function releaseETH(address payable a) external nonReentrant {
        require(_shares[a] > 0, "no shares");
        uint256 amt = pendingETH(a);
        require(amt > 0, "nothing due");
        _releasedETH[a] += amt;
        _totalReleasedETH += amt;
        (bool ok, ) = a.call{value: amt}("");
        require(ok, "eth xfer fail");
        emit PaymentReleased(a, amt);
    }

    function releaseToken(IERC20 token, address a) external nonReentrant {
        require(_shares[a] > 0, "no shares");
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

    // --- owner: replace roster (requires CLEAN state) ---
    /// @notice Replace payees/shares. Only allowed when all current payees have zero pending ETH and zero pending for the provided tokens.
    /// @param newPayees New addresses (no duplicates).
    /// @param newShares Corresponding shares.
    /// @param tokensToCheck Tokens you actively distribute (checked to ensure pending==0 for everyone).
    function setPayees(address[] calldata newPayees, uint256[] calldata newShares, IERC20[] calldata tokensToCheck)
        external
        onlyOwner
    {
        require(newPayees.length == newShares.length && newPayees.length > 0, "bad arrays");
        // duplicate guard (O(n^2) acceptable for small N)
        for (uint256 i = 0; i < newPayees.length; i++)
            for (uint256 j = i + 1; j < newPayees.length; j++)
                require(newPayees[i] != newPayees[j], "duplicate payee");

        // must be clean for ETH + provided tokens
        for (uint256 i = 0; i < _payees.length; ++i) {
            address p = _payees[i];
            require(pendingETH(p) == 0, "eth pending");
            for (uint256 t = 0; t < tokensToCheck.length; ++t) {
                require(pendingToken(tokensToCheck[t], p) == 0, "token pending");
            }
        }

        // wipe old
        for (uint256 i = 0; i < _payees.length; ++i) _shares[_payees[i]] = 0;
        delete _payees;
        _totalShares = 0;

        // add new
        for (uint256 i = 0; i < newPayees.length; ++i) _addPayee(newPayees[i], newShares[i]);

        emit PayeesReconfigured(newPayees, newShares);
    }

    // --- internal ---
    function _addPayee(address a, uint256 s) private {
        require(a != address(0), "payee=0");
        require(s > 0, "shares=0");
        require(_shares[a] == 0, "duplicate");
        _payees.push(a);
        _shares[a] = s;
        _totalShares += s;
        emit PayeeAdded(a, s);
    }
}

