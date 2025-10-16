# FeeSplitterUpgradeable

## Overview

`FeeSplitterUpgradeable` is a UUPS upgradeable smart contract that splits ETH and ERC20 token payments among multiple payees based on their share allocation.

## Contract Architecture

### Inheritance Tree

```
FeeSplitterUpgradeable
├── Initializable
├── Ownable2StepUpgradeable
│   └── OwnableUpgradeable
├── UUPSUpgradeable
├── PausableUpgradeable
└── ReentrancyGuardUpgradeable
```

### State Variables

#### Shares and Payees
- `_totalShares`: Total share weight across all payees
- `_shares`: Mapping of payee address to their share weight
- `_payees`: Array of current payee addresses

#### Accounting
- `_totalReleasedETH`: Total ETH released to all payees
- `_releasedETH`: ETH released per payee
- `_totalReleasedERC20`: Total ERC20 released per token
- `_releasedERC20`: ERC20 released per token per payee

#### Credits (Checkpointing)
- `_creditETH`: Checkpointed ETH credits per payee
- `_creditERC20`: Checkpointed ERC20 credits per token per payee

## Key Features

### 1. Pull-Based Payments

Payees must actively claim their funds by calling:
- `releaseETH(address payable account)`
- `releaseToken(IERC20 token, address account)`

**Benefits:**
- Gas-efficient (payees pay for their own claims)
- No failed transfers blocking the system
- Flexible claiming schedule

### 2. Proportional Distribution

Payments are distributed based on share weights:

```solidity
payeeShare = (totalReceived × payeeShares) / totalShares
```

**Example:**
- Total shares: 4
- Payee A: 3 shares (75%)
- Payee B: 1 share (25%)

### 3. Checkpoint System

The `checkpointAndReconfigure` function allows changing payees without forcing fund withdrawals:

1. Calculates pending amounts for all current payees
2. Converts pending amounts to credits
3. Removes old payees from share distribution
4. Adds new payees

**Old payees retain their credits** and can claim anytime.

### 4. UUPS Upgradeability

The contract can be upgraded by the owner while preserving:
- All state variables
- Payee balances and credits
- Historical accounting

## Functions

### View Functions

#### `totalShares() → uint256`
Returns the total share weight.

#### `shares(address account) → uint256`
Returns the share weight for a specific account.

#### `payees() → address[]`
Returns array of current payee addresses.

#### `pendingETH(address account) → uint256`
Returns total claimable ETH (pending + credits).

#### `rawPendingETH(address account) → uint256`
Returns only current-epoch pending ETH (excludes credits).

#### `pendingToken(IERC20 token, address account) → uint256`
Returns total claimable tokens (pending + credits).

#### `creditETH(address account) → uint256`
Returns checkpointed ETH credits.

#### `creditToken(IERC20 token, address account) → uint256`
Returns checkpointed token credits.

### User Functions

#### `releaseETH(address payable account)`
Releases all pending ETH and credits to the account.

**Requirements:**
- Account has shares or credits
- Amount to release > 0
- Contract not paused

#### `releaseToken(IERC20 token, address account)`
Releases all pending tokens and credits to the account.

**Requirements:**
- Account has shares or credits for this token
- Amount to release > 0
- Contract not paused

### Owner Functions

#### `pause()`
Pauses all release operations. Only owner can call.

#### `unpause()`
Unpauses release operations. Only owner can call.

#### `resetPayees(address[] newPayees, uint256[] newShares, IERC20[] tokens)`
Resets payees after all funds are claimed.

**Requirements:**
- All old payees must have 0 pending and 0 credits
- New payees and shares arrays same length
- Only owner can call

#### `checkpointAndReconfigure(address[] newPayees, uint256[] newShares, IERC20[] tokens)`
Checkpoints current payees and reconfigures with new ones.

**Process:**
1. Atomically calculates all pending amounts
2. Converts to credits for old payees
3. Updates accounting
4. Clears old payees
5. Installs new payees

**Benefits:**
- No forced withdrawals
- Old payees keep their credits
- Immediate reconfiguration

## Events

### `PayeeAdded(address indexed account, uint256 shares)`
Emitted when a new payee is added.

### `PayeesReconfigured(address[] accounts, uint256[] shares)`
Emitted when payees are reconfigured.

### `PaymentReleased(address indexed to, uint256 amount)`
Emitted when ETH is released.

### `ERC20PaymentReleased(IERC20 indexed token, address indexed to, uint256 amount)`
Emitted when ERC20 tokens are released.

### `Checkpointed(address[] oldPayees, IERC20[] tokens)`
Emitted when payees are checkpointed.

## Security Considerations

### 1. Reentrancy Protection
All release functions are protected with `nonReentrant` modifier.

### 2. Integer Overflow
Uses Solidity 0.8.24 built-in overflow protection.

### 3. Pausability
Owner can pause in emergency situations.

### 4. Two-Step Ownership
Prevents accidental ownership transfer.

### 5. Atomic Checkpointing
Checkpoint calculation is atomic to prevent inconsistencies.

## Gas Optimization

- Pull-based model reduces gas costs for the contract
- Payees pay for their own claims
- Minimal storage updates
- Efficient share-based calculations

## Upgrade Process

1. Deploy new implementation contract
2. Call `upgradeToAndCall()` on proxy (owner only)
3. Optionally call initialization function for new features
4. Verify upgrade successful

## Example Usage

### Deploying
```typescript
const Splitter = await ethers.getContractFactory("FeeSplitterUpgradeable");
const proxy = await upgrades.deployProxy(
  Splitter,
  [owner, [payee1, payee2], [1, 1]],
  { kind: "uups" }
);
```

### Claiming ETH
```typescript
await splitter.releaseETH(myAddress);
```

### Reconfiguring Payees
```typescript
// With checkpointing (safe, no forced withdrawals)
await splitter.checkpointAndReconfigure(
  [newPayee1, newPayee2],
  [3, 1],
  [usdcAddress, aeroAddress]
);
```

## Testing

See `test/FeeSplitter.test.ts` for comprehensive test suite covering:
- Basic distribution
- Multiple releases
- Checkpointing
- Reconfiguration
- Edge cases
- Security scenarios

