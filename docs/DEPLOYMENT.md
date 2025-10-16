# Deployment Guide

## Prerequisites

1. **Node.js**: Version 18.x or 20.x
2. **Private Key**: Deployment wallet with sufficient gas tokens
3. **RPC URL**: Access to Base mainnet RPC
4. **API Key**: Basescan API key for verification (optional)

## Environment Setup

Create a `.env` file in the project root:

```bash
# Deployment wallet private key (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# Base RPC URL
BASE_RPC_URL=https://mainnet.base.org

# Basescan API key for contract verification
BASESCAN_API_KEY=your_basescan_api_key

# Gas reporting
REPORT_GAS=false
```

⚠️ **Never commit `.env` to git!**

## Configuration

Edit `scripts/deploy.ts` to configure:

```typescript
const owner = "0xYourOwnerAddress";
const payees = [
  "0xPayee1Address",
  "0xPayee2Address",
];
const shares = [1, 1]; // 50/50 split
```

## Deployment Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Compile Contracts

```bash
npm run build
```

### 3. Run Tests

```bash
npm test
```

Ensure all 13 tests pass before deploying.

### 4. Deploy to Testnet (Recommended First)

Deploy to Base Sepolia testnet first:

```bash
# Update hardhat.config.ts with Base Sepolia RPC
npx hardhat run scripts/deploy.ts --network baseSepolia
```

### 5. Deploy to Mainnet

```bash
npm run deploy:base
# or
npx hardhat run scripts/deploy.ts --network base
```

### 6. Save Deployment Info

The script will output:
- ✅ Proxy address
- ✅ Implementation address

**Save these addresses securely!**

Example output:
```
✅ FeeSplitter deployed successfully!
Proxy address: 0x1234...5678
Implementation address: 0xabcd...ef01

Set your Morpho vault's feeRecipient to: 0x1234...5678
```

## Verification on Basescan

If you provided `BASESCAN_API_KEY`, the contract will be automatically verified.

Manual verification:
```bash
npx hardhat verify --network base PROXY_ADDRESS
```

## Post-Deployment

### 1. Verify Deployment

Check on Basescan:
- Proxy contract exists
- Implementation contract linked
- Owner is correct
- Payees and shares are correct

### 2. Set as Fee Recipient

Configure your Morpho vault or other protocol to send fees to the **proxy address**.

### 3. Test with Small Amount

Send a small amount of ETH to verify:

```typescript
// Check pending
const pending = await splitter.pendingETH(payeeAddress);
console.log("Pending:", ethers.formatEther(pending));

// Release
await splitter.releaseETH(payeeAddress);
```

### 4. Monitor Events

Set up event monitoring:
- `PaymentReleased`
- `ERC20PaymentReleased`
- `PayeesReconfigured`

## Upgrading the Contract

### 1. Deploy New Implementation

```typescript
const SplitterV2 = await ethers.getContractFactory("FeeSplitterUpgradeableV2");
const upgraded = await upgrades.upgradeProxy(proxyAddress, SplitterV2);
```

### 2. Verify Upgrade

```bash
npx hardhat verify --network base NEW_IMPLEMENTATION_ADDRESS
```

### 3. Test Upgrade

Verify all storage is preserved and new features work.

## Emergency Procedures

### Pause Contract

```typescript
await splitter.pause();
```

### Unpause Contract

```typescript
await splitter.unpause();
```

### Transfer Ownership

```typescript
// Step 1: Propose new owner
await splitter.transferOwnership(newOwnerAddress);

// Step 2: New owner accepts
await splitter.connect(newOwner).acceptOwnership();
```

## Multi-Sig Recommendations

For production, use a multi-sig wallet as the owner:
- Gnosis Safe on Base
- Minimum 2-of-3 or 3-of-5 signatures
- Time-locked operations for critical functions

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Contracts compiled successfully
- [ ] All tests passing
- [ ] Deployed to testnet and tested
- [ ] Owner address verified
- [ ] Payee addresses verified
- [ ] Share distribution verified
- [ ] Deployed to mainnet
- [ ] Verified on Basescan
- [ ] Proxy address saved
- [ ] Implementation address saved
- [ ] Small test transaction successful
- [ ] Event monitoring set up
- [ ] Documentation updated
- [ ] Team notified of deployment

## Troubleshooting

### Gas Price Too High
```bash
# Set max gas price in hardhat.config.ts
gasPrice: ethers.parseUnits("0.5", "gwei")
```

### Deployment Fails
- Check wallet balance
- Verify RPC URL is working
- Ensure nonce is correct
- Check network congestion

### Verification Fails
- Wait a few minutes and retry
- Check API key is valid
- Verify constructor arguments match

## Support

For deployment issues, contact the Muscadine Labs team.

