# Muscadine Labs Contracts

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow.svg)](https://hardhat.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.0.2-blue.svg)](https://docs.openzeppelin.com/contracts/)

Production-ready fee splitter smart contract for Muscadine Labs ecosystem.

> **Built with [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)** - Industry-standard secure smart contract library

## Contract: ERC20FeeSplitter

Ultra-minimal fee splitter smart contract for ERC20 tokens only.

**Key Features:**
- Pull-based distribution for ERC20 tokens only
- **Fully immutable** - NO owner, NO configuration changes, EVER
- **Fixed 50/50 split** between Nick and Ignas (permanent)
- Supports any ERC20 token including vault share tokens (e.g., Morpho vault shares)
- SafeERC20 with "actual-sent" accounting for fee-on-transfer tokens
- Reentrancy-protected

## Usage

### 1. Funding the Contract

Simply transfer ERC20 tokens to the contract address:

```solidity
token.transfer(splitterAddress, amount);
```

### 2. Claiming Funds (Payees)

Nick or Ignas (or anyone on their behalf) can claim by calling:

```solidity
splitter.claim(tokenAddress, payeeAddress);
```

### 3. Claiming for Both Payees

Anyone can claim for both payees in one transaction:

```solidity
splitter.claimAll(tokenAddress);
```

### 4. No Configuration Changes

**This contract is FULLY IMMUTABLE:**
- No owner (no one controls it)
- Cannot change payees
- Cannot change fee percentages
- Cannot pause or stop
- Configuration is PERMANENT

**If you need to change the split:** Deploy a new contract and update fee recipients.

## Architecture

**Immutable Storage:**
- `_PAYEE1` - Nick's address (immutable)
- `_PAYEE2` - Ignas's address (immutable)
- `_SHARES1` - Nick's shares = 1 (immutable)
- `_SHARES2` - Ignas's shares = 1 (immutable)
- `_TOTAL_SHARES` - Total = 2 (immutable)

**Mutable Accounting:**
- `_releasedETH[address]` - ETH released per payee
- `_releasedERC20[token][address]` - Tokens released per payee
- `_totalReleasedETH` - Total ETH released
- `_totalReleasedERC20[token]` - Total tokens released

**Key Concepts:**
- **Immutable**: Payees and shares are locked forever at deployment
- **Pending**: Current unclaimed amount (50% each)
- **Released**: Historical tracking to calculate pending amounts

## Repository Structure

```
Fee-splitter/
├── contracts/          # Smart contracts
│   ├── FeeSplitterImmutable.sol
│   └── mocks/
│       ├── ERC20Mock.sol
│       └── DeflationaryMock.sol
├── test/              # Test suite
│   ├── FeeSplitterImmutable.test.ts
│   └── VaultTokens.test.ts
├── scripts/           # Deployment scripts
│   └── deployImmutable.ts
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
// Get total shares (always 2)
function totalShares() external view returns (uint256)

// Get payee 1 (Nick's address)
function payee1() external view returns (address)

// Get payee 2 (Ignas's address)
function payee2() external view returns (address)

// Get shares for an address (1 for payees, 0 for others)
function shares(address account) external view returns (uint256)

// Get pending ETH for a payee
function pendingETH(address account) public view returns (uint256)

// Get pending tokens for a payee
function pendingToken(IERC20 token, address account) public view returns (uint256)
```

### Release Functions

```solidity
// Release ETH to a payee (must be payee1 or payee2)
function releaseETH(address payable account) external nonReentrant

// Release ERC20 tokens to a payee (must be payee1 or payee2)
function releaseToken(IERC20 token, address account) external nonReentrant
```

### Vault Functions

```solidity
// Redeem all vault shares for underlying assets
function claimAllVaultFees(address vault) external nonReentrant returns (uint256 assetsOut)

// Redeem vault shares respecting withdrawal limits
function claimVaultFeesUpToLimit(address vault) external nonReentrant returns (uint256 sharesBurned, uint256 assetsOut)

// Redeem specific amount of underlying assets
function claimExactVaultAssets(address vault, uint256 assets) external nonReentrant returns (uint256 sharesBurned, uint256 assetsOut)
```

### No Owner Functions

**This contract has NO owner and NO admin functions:**
- No `setPayees()` - payees are permanent
- No `pause()` - funds can always be claimed
- No `transferOwnership()` - there is no owner
- No configuration changes of any kind

## Examples

### Claiming ETH

```typescript
const NICK = "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333";
const splitterAddress = "0x..."; // Your deployed contract
const splitter = await ethers.getContractAt("FeeSplitterImmutable", splitterAddress);

// Check Nick's pending amount
const pending = await splitter.pendingETH(NICK);
console.log("Nick's pending ETH:", ethers.formatEther(pending));

// Release (anyone can call, but must be for a payee)
await splitter.releaseETH(NICK);
```

### Claiming ERC20 Tokens (e.g., USDC from Morpho Vault)

```typescript
const IGNAS = "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261";
const usdcAddress = "0x..."; // USDC token address

// Check Ignas's pending USDC
const pending = await splitter.pendingToken(usdcAddress, IGNAS);
console.log("Ignas's pending USDC:", ethers.formatUnits(pending, 6)); // USDC has 6 decimals

// Claim tokens
await splitter.releaseToken(usdcAddress, IGNAS);
```

## Share Distribution Examples

- **50/50**: `[1, 1]`
- **75/25**: `[3, 1]`
- **60/30/10**: `[6, 3, 1]`
- **33/33/33**: `[1, 1, 1]`

The shares are relative weights, not percentages.

## Security Features

1. **Fully Immutable**: No owner, no upgrades, no configuration changes - maximum security
2. **Reentrancy Guard**: Prevents reentrancy attacks on fund releases
3. **SafeERC20**: Handles non-standard tokens and prevents silent failures
4. **Actual-Sent Accounting**: Correctly tracks deflationary/fee-on-transfer tokens
5. **Fixed Payees**: Only two specific addresses can claim - no one else
6. **Minimal Attack Surface**: Only 110 lines of code, ultra-simple logic

## Testing

The test suite covers:
- ETH and ERC20 distribution (50/50 split)
- Morpho vault fee claiming and redemption
- All three Morpho vault tokens (USDC 6 decimals, cbBTC 8 decimals, WETH 18 decimals)
- Deflationary token handling (1% burn)
- Immutability verification (no owner, no setPayees, no pause)
- Non-payee rejection
- Multi-vault scenarios
- Edge cases and multiple releases

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

