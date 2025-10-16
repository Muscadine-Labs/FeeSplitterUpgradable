# Muscadine Labs Contracts

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow.svg)](https://hardhat.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.0.2-blue.svg)](https://docs.openzeppelin.com/contracts/)

Production-ready fee splitter smart contract for Muscadine Labs ecosystem.

> **Built with [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)** - Industry-standard secure smart contract library

## Contract: FeeSplitterSimple

A minimal, non-upgradeable fee splitter smart contract for ETH and ERC20 tokens.

**Key Features:**
- ✅ Pull-based distribution for ETH and ERC20 tokens
- ✅ Non-upgradeable (simplest & safest deployment)
- ✅ SafeERC20 with "actual-sent" accounting for fee-on-transfer tokens
- ✅ Owner can replace payees/shares only when all balances are claimed
- ✅ Reentrancy-protected
- ✅ ~130 lines of code (simple & auditable)

## Usage

### 1. Funding the Contract

Simply transfer ETH or ERC20 tokens to the contract address:

**ETH:**
```solidity
(bool ok,) = splitterAddress.call{value: amount}("");
require(ok);
```

**ERC20:**
```solidity
token.transfer(splitterAddress, amount);
```

### 2. Claiming Funds (Payees)

Any payee (or anyone on their behalf) can claim by calling:

```solidity
splitter.releaseETH(payeeAddress);
splitter.releaseToken(tokenAddress, payeeAddress);
```

### 3. Reconfiguring Payees (Owner Only)

Owner can change payees/shares **only when all balances are zero**:

```solidity
// First, ensure all payees have claimed everything
// Then:
splitter.setPayees(
  [newPayee1, newPayee2],
  [70, 30], // shares (70% / 30%)
  [token1, token2] // tokens to check for zero balance
);
```

## Architecture

**Storage:**
- `_totalShares` - Sum of all share weights
- `_shares[address]` - Shares per payee
- `_payees[]` - Array of payee addresses
- `_releasedETH[address]` - ETH released per payee
- `_releasedERC20[token][address]` - Tokens released per payee

**Key Concepts:**
- **Shares**: Each payee has a share weight (e.g., 70, 30 for 70%/30% split)
- **Pending**: Current unclaimed amount based on shares
- **Released**: Historical tracking to calculate pending amounts

## Repository Structure

```
Fee-splitter/
├── contracts/          # Smart contracts
│   ├── FeeSplitterSimple.sol
│   └── mocks/
│       ├── ERC20Mock.sol
│       └── DeflationaryMock.sol
├── test/              # Test suite
│   └── FeeSplitterSimple.test.ts
├── scripts/           # Deployment scripts
│   └── deploySimple.ts
├── .github/workflows/ # CI/CD automation
│   └── ci.yml
├── LICENSE            # MIT License
└── README.md
```

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the project root:

```env
PRIVATE_KEY=your_private_key_here
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=your_basescan_api_key
```

## Usage

### Compile Contracts

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Deploy

**Local/Hardhat Network:**
```bash
npm run deploy
```

**Base Mainnet:**
```bash
npm run deploy:base
```

After deployment, you can start sending ETH and tokens to the contract address.

## Contract Interface

### View Functions

```solidity
// Get total shares
function totalShares() external view returns (uint256)

// Get shares for an account
function shares(address account) external view returns (uint256)

// Get all current payees
function payees() external view returns (address[] memory)

// Get pending ETH for a payee
function pendingETH(address account) public view returns (uint256)

// Get pending tokens for a payee
function pendingToken(IERC20 token, address account) public view returns (uint256)
```

### Release Functions (Anyone can call)

```solidity
// Release ETH to a payee
function releaseETH(address payable account) external nonReentrant

// Release ERC20 tokens to a payee
function releaseToken(IERC20 token, address account) external nonReentrant
```

### Owner Functions

```solidity
// Replace payees/shares (only when all balances are zero)
function setPayees(
    address[] calldata newPayees,
    uint256[] calldata newShares,
    IERC20[] calldata tokensToCheck
) external onlyOwner
```

## Examples

### Claiming ETH

```typescript
const splitterAddress = "0x...";
const splitter = await ethers.getContractAt("FeeSplitterSimple", splitterAddress);

// Check pending amount
const pending = await splitter.pendingETH(myAddress);
console.log("Pending ETH:", ethers.formatEther(pending));

// Release (anyone can call for any payee)
await splitter.releaseETH(myAddress);
```

### Claiming ERC20 Tokens

```typescript
const tokenAddress = "0x..."; // e.g., USDC address

// Check pending tokens
const pending = await splitter.pendingToken(tokenAddress, myAddress);
console.log("Pending tokens:", ethers.formatUnits(pending, 6)); // USDC has 6 decimals

// Release tokens
await splitter.releaseToken(tokenAddress, myAddress);
```

### Reconfiguring Payees (Owner Only)

```typescript
// Step 1: Ensure ALL payees have claimed ALL balances
const payees = await splitter.payees();
for (const payee of payees) {
  const ethPending = await splitter.pendingETH(payee);
  const usdcPending = await splitter.pendingToken(usdcAddress, payee);
  
  if (ethPending > 0n) {
    await splitter.releaseETH(payee);
  }
  if (usdcPending > 0n) {
    await splitter.releaseToken(usdcAddress, payee);
  }
}

// Step 2: Reconfigure with new payees
await splitter.setPayees(
  [newPayee1, newPayee2, newPayee3],
  [40, 30, 30], // 40/30/30 split
  [usdcAddress, wethAddress] // tokens to check for zero balance
);
```

## Share Distribution Examples

- **50/50**: `[1, 1]`
- **75/25**: `[3, 1]`
- **60/30/10**: `[6, 3, 1]`
- **33/33/33**: `[1, 1, 1]`

The shares are relative weights, not percentages.

## Security Features

1. **Reentrancy Guard**: Prevents reentrancy attacks on fund releases
2. **SafeERC20**: Handles non-standard tokens and prevents silent failures
3. **Actual-Sent Accounting**: Correctly tracks deflationary/fee-on-transfer tokens
4. **Two-Step Ownership**: Prevents accidental ownership transfer
5. **Clean State Requirement**: Prevents loss of funds during reconfiguration
6. **Duplicate Prevention**: Rejects duplicate addresses in payee lists

## Testing

The test suite covers:
- ETH and ERC20 distribution (70/30 split)
- Deflationary token handling (1% burn)
- Payee reconfiguration with validation
- Duplicate address prevention
- Owner-only access control
- Edge cases and error handling

```bash
npm test
```

For coverage:
```bash
npm run test:coverage
```

## License

MIT - see LICENSE file for details

## Security

See [SECURITY.md](SECURITY.md) for security policy and vulnerability reporting.

## Contributing

Contributions are welcome! Please ensure:
- All tests pass
- Code is properly formatted
- New features include tests
- Changes are documented

## Support

For issues or questions, please open an issue on GitHub.

