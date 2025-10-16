# FeeSplitterSimple - Deployment Instructions

## 🎯 Configuration

The contract is pre-configured with these production values:

### Owner (Multi-sig)
```
0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A
```
- This is your Gnosis Safe multi-sig wallet
- Only this address can change payees using `setPayees()`

### Payees (50/50 Split)
```
Nick:  0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333 (50%)
Ignas: 0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261 (50%)
```
- Each gets exactly 50% of all ETH and tokens sent to the contract
- Split is defined as `[1, 1]` (equal shares)

---

## 🚀 How to Deploy

### Prerequisites

1. **Create `.env` file** in the project root:
```env
PRIVATE_KEY=your_deployer_wallet_private_key
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=your_basescan_api_key
```

2. **Ensure deployer wallet has funds:**
- Need ~0.001 ETH on Base for gas
- Deployment costs ~$0.013 at current gas prices

### Deploy to Base Mainnet

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Compile contract
npm run build

# 3. Run tests to verify
npm test

# 4. Deploy to Base Mainnet
npm run deploy:base
```

### What Happens During Deployment

The script will:
1. Deploy `FeeSplitterSimple.sol` with your configuration
2. Print the contract address (save this!)
3. Verify the configuration:
   - Owner: Multi-sig
   - Payees: Nick & Ignas
   - Shares: 50/50

### After Deployment

You'll get output like this:
```json
{
  "network": "base",
  "chainId": 8453,
  "contract": "0x...",  // <- YOUR NEW CONTRACT ADDRESS
  "owner": "0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A",
  "payees": [
    "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333",
    "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261"
  ],
  "shares": [1, 1]
}
```

**Save the contract address!** This is where you'll send fees.

---

## ✅ Verify on Basescan

After deployment, verify the contract source code:

```bash
npx hardhat verify --network base <CONTRACT_ADDRESS> \
  "0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A" \
  "[\"0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333\",\"0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261\"]" \
  "[1,1]"
```

This publishes the contract code on Basescan for transparency.

---

## 💰 How to Use After Deployment

### Sending Fees to the Contract

Simply transfer ETH or ERC20 tokens to the contract address:

```javascript
// Send ETH
await signer.sendTransaction({
  to: contractAddress,
  value: ethers.parseEther("10") // 10 ETH
});

// Send ERC20 (e.g., USDC)
await usdcToken.transfer(contractAddress, amount);
```

### Claiming Your Share

**Nick or Ignas can claim anytime by calling:**

```javascript
const splitter = await ethers.getContractAt("FeeSplitterSimple", contractAddress);

// Claim ETH (50% of whatever is pending)
await splitter.releaseETH("0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333"); // Nick's address

// Or claim tokens
await splitter.releaseToken(usdcAddress, "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333");
```

**Anyone can trigger the claim for you** - it goes directly to your address.

### Check Pending Balances

```javascript
// Check how much ETH is pending
const ethPending = await splitter.pendingETH("0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333");
console.log("Nick's pending ETH:", ethers.formatEther(ethPending));

// Check how much USDC is pending
const usdcPending = await splitter.pendingToken(usdcAddress, "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333");
console.log("Nick's pending USDC:", ethers.formatUnits(usdcPending, 6));
```

---

## 🔧 Changing Payees (Multi-sig Only)

If you ever need to change the split or add/remove payees:

1. **Both Nick and Ignas must claim ALL pending balances first**
2. **Then the multi-sig can call:**

```javascript
await splitter.setPayees(
  [newPayee1, newPayee2],
  [70, 30], // New split (70/30)
  [usdcAddress, wethAddress] // Tokens to check
);
```

**Important:** Contract enforces this - you CANNOT change payees if anyone has unclaimed funds.

---

## 📊 Deployment Costs (Base Network)

| Item | Cost |
|------|------|
| **Deploy Contract** | ~$0.013 |
| **Claim ETH** | ~$0.0008 per claim |
| **Claim Token** | ~$0.0011 per claim |

**Base L2 is VERY cheap!** 🎉

---

## 🔒 Security Features

✅ **SafeERC20** - Handles weird tokens safely  
✅ **Reentrancy Protection** - Can't be exploited  
✅ **Deflationary Token Support** - Works with fee-on-transfer tokens  
✅ **Multi-sig Owner** - Only your Safe can change payees  
✅ **Non-upgradeable** - Code can't be changed after deployment  
✅ **15 Tests Passing** - Comprehensive test coverage  

---

## 📱 Quick Reference

**Repository:** https://github.com/Muscadine-Labs/Muscadine-Fee-Splitter-Contract

**Deploy Command:**
```bash
npm run deploy:base
```

**Configuration:**
- Owner: Multi-sig Safe
- Nick: 50%
- Ignas: 50%
- Network: Base (Chain ID: 8453)

---

**Ready to deploy!** 🚀

