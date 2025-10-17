# ERC20FeeSplitter

Ultra-minimal fee splitter smart contract for ERC20 tokens only.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow.svg)](https://hardhat.org/)

## Features

- **Fully immutable** - NO owner, NO configuration changes, EVER
- **50/50 split** between Nick and Ignas (permanent)
- **ERC20 tokens only** - Supports any ERC20 including vault shares
- **Reentrancy protected** - Safe from attacks
- **Gas optimized** - Minimal functions, efficient code

## Configuration

**Payees:**
- Nick: `0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333`
- Ignas: `0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261`
- Split: 50/50 (1:1 shares)

## Usage

### 1. Send Tokens
```solidity
token.transfer(splitterAddress, amount);
```

### 2. Claim Tokens
```solidity
// Claim for one payee
splitter.claim(tokenAddress, payeeAddress);

// Claim for both payees
splitter.claimAll(tokenAddress);
```

### 3. Check Pending Amounts
```solidity
uint256 pending = splitter.pendingToken(tokenAddress, payeeAddress);
```

## Contract Functions

| Function | Type | Purpose |
|----------|------|---------|
| `constructor` | Deploy | Initialize with payees and shares |
| `pendingToken` | Read | Check claimable amount |
| `claim` | Write | Claim for one payee |
| `claimAll` | Write | Claim for both payees |
| `PAYEE1()` | Read | Get Nick's address |
| `PAYEE2()` | Read | Get Ignas's address |
| `SHARES1()` | Read | Get Nick's shares |
| `SHARES2()` | Read | Get Ignas's shares |
| `TOTAL_SHARES()` | Read | Get total shares (2) |

## Deployment

### Setup
```bash
# Install dependencies
npm install

# Create .env file
echo "PRIVATE_KEY=your_private_key_here" > .env
echo "BASESCAN_API_KEY=your_api_key_here" >> .env
```

### Deploy to Base Mainnet
```bash
npx hardhat run scripts/deployImmutable.ts --network base
```

### Verify Contract
```bash
npx hardhat verify --network base <CONTRACT_ADDRESS> \
  "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333" \
  "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261" \
  "1" \
  "1"
```

## Testing

```bash
# Run all tests
npm test

# Run specific test
npx hardhat test test/AdvancedERC20FeeSplitter.test.ts
```

**Test Coverage:** 34 tests covering all functionality including:
- 50/50 token splitting
- Deflationary tokens (fee-on-transfer)
- Rebasing tokens
- Reentrancy protection
- Edge cases and precision

## Security

- **Immutable** - Configuration cannot be changed after deployment
- **No owner** - No admin functions or privileged access
- **Minimal code** - 111 lines, easy to audit
- **OpenZeppelin** - Uses industry-standard secure libraries

## Important

⚠️ **This contract is FULLY IMMUTABLE:**
- Configuration is PERMANENT
- Cannot change payees or shares
- If you need changes, deploy a new contract

## License

MIT License - see LICENSE file for details