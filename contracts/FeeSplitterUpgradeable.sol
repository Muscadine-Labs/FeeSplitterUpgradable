// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/// @title FeeSplitterUpgradeable (epochless, checkpointable)
/// @notice Pull-based splitter for ETH and ERC20s. Owner can pause, upgrade, and reconfigure recipients/shares
///         *without draining*, by checkpointing outstanding accruals into claimable credits.
/// @dev Based on OZ PaymentSplitter accounting. Upgradeable via UUPS.
contract FeeSplitterUpgradeable is 
    Initializable, 
    Ownable2StepUpgradeable, 
    UUPSUpgradeable, 
    PausableUpgradeable, 
    ReentrancyGuardUpgradeable 
{
    // ---- storage ----
    uint256 private _totalShares;
    mapping(address => uint256) private _shares; // payee => shares
    address[] private _payees;

    // cumulative released accounting (like OZ PaymentSplitter)
    uint256 private _totalReleasedETH;
    mapping(address => uint256) private _releasedETH; // payee => amount released (excludes credits)

    mapping(IERC20 => uint256) private _totalReleasedERC20; // token => amount released (excludes credits)
    mapping(IERC20 => mapping(address => uint256)) private _releasedERC20; // token => (payee => amount released)

    // checkpoint credits so we can reconfigure without transferring funds out
    mapping(address => uint256) private _creditETH; // payee => eth credit
    mapping(IERC20 => mapping(address => uint256)) private _creditERC20; // token => (payee => credit)

    // ---- events ----
    event PayeeAdded(address indexed account, uint256 shares);
    event PayeesReconfigured(address[] accounts, uint256[] shares);
    event PaymentReleased(address indexed to, uint256 amount);
    event ERC20PaymentReleased(IERC20 indexed token, address indexed to, uint256 amount);
    event Checkpointed(address[] oldPayees, IERC20[] tokens);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ---- initializer ----
    function initialize(
        address initialOwner, 
        address[] memory payees, 
        uint256[] memory shares_
    ) public initializer {
        require(initialOwner != address(0), "owner=0");
        require(payees.length == shares_.length && payees.length > 0, "bad arrays");

        __Ownable_init(initialOwner);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();

        for (uint256 i = 0; i < payees.length; ++i) {
            _addPayee(payees[i], shares_[i]);
        }
    }

    // ---- payable fallback to accept ETH ----
    receive() external payable {}

    // ---- view helpers ----
    function totalShares() external view returns (uint256) { 
        return _totalShares; 
    }
    
    function shares(address account) external view returns (uint256) { 
        return _shares[account]; 
    }
    
    function payees() external view returns (address[] memory) { 
        return _payees; 
    }

    function pendingETH(address account) public view returns (uint256) {
        uint256 totalReceived = address(this).balance + _totalReleasedETH;
        return _pending(totalReceived, _releasedETH[account], account) + _creditETH[account];
    }

    function rawPendingETH(address account) public view returns (uint256) {
        // excludes credits (only current-epoch accrual)
        uint256 totalReceived = address(this).balance + _totalReleasedETH;
        return _pending(totalReceived, _releasedETH[account], account);
    }

    function pendingToken(IERC20 token, address account) public view returns (uint256) {
        uint256 totalReceived = token.balanceOf(address(this)) + _totalReleasedERC20[token];
        return _pending(totalReceived, _releasedERC20[token][account], account) + _creditERC20[token][account];
    }

    function rawPendingToken(IERC20 token, address account) public view returns (uint256) {
        uint256 totalReceived = token.balanceOf(address(this)) + _totalReleasedERC20[token];
        return _pending(totalReceived, _releasedERC20[token][account], account);
    }

    function creditETH(address account) external view returns (uint256) { 
        return _creditETH[account]; 
    }
    
    function creditToken(IERC20 token, address account) external view returns (uint256) { 
        return _creditERC20[token][account]; 
    }

    function _pending(
        uint256 totalReceived, 
        uint256 alreadyReleasedToAccount, 
        address account
    ) internal view returns (uint256) {
        if (_shares[account] == 0) return 0;
        uint256 totalDue = (totalReceived * _shares[account]) / _totalShares;
        if (totalDue <= alreadyReleasedToAccount) return 0;
        return totalDue - alreadyReleasedToAccount;
    }

    // ---- release (pull) ----
    function releaseETH(address payable account) external whenNotPaused nonReentrant {
        require(_shares[account] > 0 || _creditETH[account] > 0, "no entitlement");
        uint256 credit = _creditETH[account];
        uint256 pending = rawPendingETH(account);
        require(credit + pending > 0, "nothing due");

        // clear credit and update accounting only for the pending portion
        _creditETH[account] = 0;
        if (pending > 0) {
            _releasedETH[account] += pending;
            _totalReleasedETH += pending;
        }
        uint256 payment = credit + pending;
        (bool ok, ) = account.call{value: payment}("");
        require(ok, "eth xfer fail");
        emit PaymentReleased(account, payment);
    }

    function releaseToken(IERC20 token, address account) external whenNotPaused nonReentrant {
        require(_shares[account] > 0 || _creditERC20[token][account] > 0, "no entitlement");
        uint256 credit = _creditERC20[token][account];
        uint256 pending = rawPendingToken(token, account);
        require(credit + pending > 0, "nothing due");

        _creditERC20[token][account] = 0;
        if (pending > 0) {
            _releasedERC20[token][account] += pending;
            _totalReleasedERC20[token] += pending;
        }
        uint256 payment = credit + pending;
        require(token.transfer(account, payment), "erc20 xfer fail");
        emit ERC20PaymentReleased(token, account, payment);
    }

    // ---- admin: pause/unpause ----
    function pause() external onlyOwner { 
        _pause(); 
    }
    
    function unpause() external onlyOwner { 
        _unpause(); 
    }

    // ---- admin: checkpoint & reconfigure WITHOUT draining ----
    /// @notice Snapshot current entitlement for all existing payees into on-chain credits, then replace payee set and shares.
    /// @param newPayees new payee addresses
    /// @param newShares new shares (same length as newPayees)
    /// @param tokens list of ERC20 tokens to checkpoint (e.g., USDC, AERO, etc.)
    function checkpointAndReconfigure(
        address[] calldata newPayees, 
        uint256[] calldata newShares, 
        IERC20[] calldata tokens
    ) external onlyOwner {
        require(newPayees.length == newShares.length && newPayees.length > 0, "bad arrays");

        // 1) checkpoint ETH & tokens for all current payees
        address[] memory old = _payees;
        
        // First, calculate all amounts to credit (without updating global state)
        uint256[] memory ethCredits = new uint256[](old.length);
        uint256[][] memory tokenCredits = new uint256[][](tokens.length);
        for (uint256 t = 0; t < tokens.length; ++t) {
            tokenCredits[t] = new uint256[](old.length);
        }
        
        for (uint256 i = 0; i < old.length; ++i) {
            address p = old[i];
            if (p == address(0)) continue;
            
            ethCredits[i] = rawPendingETH(p);
            
            for (uint256 t = 0; t < tokens.length; ++t) {
                tokenCredits[t][i] = rawPendingToken(tokens[t], p);
            }
        }
        
        // Now update all credits and accounting
        for (uint256 i = 0; i < old.length; ++i) {
            address p = old[i];
            if (p == address(0)) continue;
            
            if (ethCredits[i] > 0) {
                _creditETH[p] += ethCredits[i];
                _releasedETH[p] += ethCredits[i];
                _totalReleasedETH += ethCredits[i];
            }
            
            for (uint256 t = 0; t < tokens.length; ++t) {
                if (tokenCredits[t][i] > 0) {
                    _creditERC20[tokens[t]][p] += tokenCredits[t][i];
                    _releasedERC20[tokens[t]][p] += tokenCredits[t][i];
                    _totalReleasedERC20[tokens[t]] += tokenCredits[t][i];
                }
            }
        }

        emit Checkpointed(old, tokens);

        // 2) wipe old payee shares (but preserve credits!)
        for (uint256 i = 0; i < old.length; ++i) {
            _shares[old[i]] = 0;
        }
        delete _payees;
        _totalShares = 0;

        // 3) install new payees
        for (uint256 i = 0; i < newPayees.length; ++i) {
            _addPayee(newPayees[i], newShares[i]);
        }

        emit PayeesReconfigured(newPayees, newShares);
    }

    /// @notice Simpler reconfigure when all balances are already claimed (no checkpointing needed)
    /// @param newPayees new payee addresses
    /// @param newShares new shares
    /// @param tokens tokens to verify are empty (reverts if non-zero balance)
    function resetPayees(
        address[] calldata newPayees, 
        uint256[] calldata newShares,
        IERC20[] calldata tokens
    ) external onlyOwner {
        require(newPayees.length == newShares.length && newPayees.length > 0, "bad arrays");

        // verify all old payees have claimed everything
        for (uint256 i = 0; i < _payees.length; ++i) {
            address p = _payees[i];
            require(rawPendingETH(p) == 0 && _creditETH[p] == 0, "eth unclaimed");
            for (uint256 t = 0; t < tokens.length; ++t) {
                require(
                    rawPendingToken(tokens[t], p) == 0 && _creditERC20[tokens[t]][p] == 0,
                    "token unclaimed"
                );
            }
        }

        // wipe old payees
        address[] memory old = _payees;
        for (uint256 i = 0; i < old.length; ++i) {
            _shares[old[i]] = 0;
        }
        delete _payees;
        _totalShares = 0;

        // install new payees
        for (uint256 i = 0; i < newPayees.length; ++i) {
            _addPayee(newPayees[i], newShares[i]);
        }

        emit PayeesReconfigured(newPayees, newShares);
    }

    // ---- internal ----
    function _addPayee(address account, uint256 shares_) private {
        require(account != address(0), "payee=0");
        require(shares_ > 0, "shares=0");
        require(_shares[account] == 0, "duplicate payee");

        _payees.push(account);
        _shares[account] = shares_;
        _totalShares += shares_;
        emit PayeeAdded(account, shares_);
    }

    // ---- UUPS upgrade authorization ----
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

