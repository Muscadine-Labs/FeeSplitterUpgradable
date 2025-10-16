# Fee Splitter UUPS

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow.svg)](https://hardhat.org/)
[![OpenZeppelin](https://img.shields.io/badge/OpenZeppelin-5.0.2-blue.svg)](https://docs.openzeppelin.com/contracts/)

A production-ready, upgradeable fee splitter smart contract for ETH and ERC20 tokens using the UUPS (Universal Upgradeable Proxy Standard) pattern.

> **Built with [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)** - Industry-standard secure smart contract library

## Features

- **Pull-based distribution**: Payees claim their share when ready (gas-efficient)
- **Multi-asset support**: Handles ETH and any ERC20 token
- **Upgradeable**: UUPS proxy pattern allows contract logic upgrades
- **Checkpointing**: Reconfigure payees without forcing withdrawals
- **Pausable**: Owner can pause/unpause distributions
- **Reentrancy protection**: Safe against reentrancy attacks
- **Two-step ownership**: Secure ownership transfer process

## Architecture

### Core Components

1. **FeeSplitterUpgradeable.sol**: Main contract implementing the fee splitting logic
2. **UUPS Proxy**: Allows upgrading contract logic while preserving state
3. **Checkpoint System**: Preserves entitlements when reconfiguring payees

### Key Concepts

- **Shares**: Each payee has a share weight (e.g., 1, 2, 3)
- **Credits**: Checkpointed entitlements that persist through reconfiguration
- **Pending**: Current unclaimed amount based on shares
- **Released**: Historical tracking of total distributions

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
npx hardhat run scripts/deploy.ts
```

**Base Mainnet:**
```bash
npm run deploy:base
```

After deployment, set your Morpho vault's `feeRecipient` to the proxy address.

## Contract Interface

### View Functions

```solidity
// Get total shares
function totalShares() external view returns (uint256)

// Get shares for an account
function shares(address account) external view returns (uint256)

// Get all current payees
function payees() external view returns (address[] memory)

// Get pending ETH (includes credits)
function pendingETH(address account) public view returns (uint256)

// Get pending tokens (includes credits)
function pendingToken(IERC20 token, address account) public view returns (uint256)

// Get ETH credits for an account
function creditETH(address account) external view returns (uint256)

// Get token credits for an account
function creditToken(IERC20 token, address account) external view returns (uint256)
```

### User Functions

```solidity
// Release ETH to a payee
function releaseETH(address payable account) external

// Release ERC20 tokens to a payee
function releaseToken(IERC20 token, address account) external
```

### Owner Functions

```solidity
// Pause all distributions
function pause() external onlyOwner

// Unpause distributions
function unpause() external onlyOwner

// Reconfigure payees after all funds are claimed
function resetPayees(
    address[] calldata newPayees,
    uint256[] calldata newShares,
    IERC20[] calldata tokens
) external onlyOwner

// Checkpoint current payees and reconfigure (preserves credits)
function checkpointAndReconfigure(
    address[] calldata newPayees,
    uint256[] calldata newShares,
    IERC20[] calldata tokens
) external onlyOwner
```

## Examples

### Claiming ETH

```typescript
const splitterAddress = "0x...";
const splitter = await ethers.getContractAt("FeeSplitterUpgradeable", splitterAddress);

// Check pending amount
const pending = await splitter.pendingETH(myAddress);
console.log("Pending ETH:", ethers.formatEther(pending));

// Release to yourself
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

### Reconfiguring Payees (Owner)

**Option 1: After all funds are claimed**

```typescript
// Ensure all payees have claimed everything first
await splitter.resetPayees(
    ["0x123...", "0x456..."],  // new payees
    [3, 1],                     // new shares (75/25 split)
    ["0xUSDC...", "0xAERO..."]  // tokens to verify are empty
);
```

**Option 2: With checkpointing (funds can remain unclaimed)**

```typescript
// Preserves old payees' credits, reconfigures for new funds
// This calculates all credits atomically before updating state
await splitter.checkpointAndReconfigure(
    ["0x789...", "0xabc..."],  // new payees
    [1, 1],                     // new shares (50/50 split)
    ["0xUSDC...", "0xAERO..."]  // tokens to checkpoint
);

// Old payees can still claim their checkpointed credits
```

**Important:** The `checkpointAndReconfigure` function calculates all pending amounts atomically before updating any state, ensuring fair and accurate credit distribution.

## Share Distribution Examples

- **50/50**: `[1, 1]`
- **75/25**: `[3, 1]`
- **60/30/10**: `[6, 3, 1]`
- **33/33/33**: `[1, 1, 1]`

The shares are relative weights, not percentages.

## Security Features

1. **Reentrancy Guard**: Prevents reentrancy attacks on fund releases
2. **Pausable**: Owner can pause in case of emergency
3. **Two-Step Ownership**: Prevents accidental ownership transfer
4. **UUPS Authorization**: Only owner can upgrade
5. **Checkpoint Credits**: Prevents loss of funds during reconfiguration

## Upgrading

To upgrade the contract implementation:

```typescript
const SplitterV2 = await ethers.getContractFactory("FeeSplitterUpgradeableV2");
const upgraded = await upgrades.upgradeProxy(proxyAddress, SplitterV2);
await upgraded.waitForDeployment();
```

## Testing

The test suite covers:
- Basic ETH and ERC20 distribution
- Pause/unpause functionality
- Payee reconfiguration (both methods)
- Checkpointing system
- Multiple releases
- Edge cases and error handling

```bash
npm test
```

For gas reporting:
```bash
REPORT_GAS=true npm test
```

## Integration with Morpho

1. Deploy the FeeSplitter contract
2. Set the proxy address as the `feeRecipient` in your Morpho vault
3. Fees will automatically accumulate in the splitter
4. Payees can claim their share anytime by calling `releaseETH()` or `releaseToken()`

## License

MIT

## Author

Built for secure, flexible fee distribution on Base and EVM-compatible chains.

