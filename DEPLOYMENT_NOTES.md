# Deployment Notes

## Owner Configuration

**Owner**: Multi-sig Safe `0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A`

### What This Means

All admin functions require multi-sig approval through your Safe:
- `pause()` / `unpause()`
- `checkpointAndReconfigure()`
- `resetPayees()`
- Contract upgrades

### Multi-Sig Benefits

✅ **Enhanced Security**: Requires multiple signers (e.g., 2-of-3)  
✅ **No Single Point of Failure**: One compromised key can't drain funds  
✅ **Transparency**: All admin actions are visible on-chain  
✅ **Time to React**: Team can review before executing  

---

## Payee Configuration

**50/50 Split**:
- Nicholas: `0xD437c78a6bA1F42Dca908F3759ab8B8A42Af4D82` (1 share)
- Ignas: `0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261` (1 share)

**Note**: Payees can claim directly, no multi-sig needed for claiming.

---

## Deployment Checklist

### Before Deployment

- [ ] Test on Base Sepolia testnet
- [ ] Verify multi-sig Safe is set up correctly
- [ ] Confirm all signers have access to Safe
- [ ] Set environment variables in `.env`:
  - `PRIVATE_KEY` (deployer wallet, not owner)
  - `BASE_RPC_URL`
  - `BASESCAN_API_KEY` (optional, for verification)

### After Deployment

- [ ] Verify contract on Basescan
- [ ] Confirm owner is multi-sig address
- [ ] Test small ETH transfer to contract
- [ ] Test `releaseETH()` function
- [ ] Set as `feeRecipient` in Morpho vaults:
  - USDC vault: `0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F`
  - cbBTC vault: `0xAeCc8113a7bD0CFAF7000EA7A31afFD4691ff3E9`
  - WETH vault: `0x21e0d366272798da3A977FEBA699FCB91959d120`

---

## Using Multi-Sig for Admin Functions

### Example: Pausing the Contract

1. **In Safe UI**:
   - Go to: https://app.safe.global
   - Select your Safe
   - Click "New Transaction" → "Contract Interaction"

2. **Enter Details**:
   - Contract address: `[Your deployed proxy address]`
   - ABI: Load FeeSplitterUpgradeable ABI
   - Function: `pause()`
   - Click "Add Transaction"

3. **Sign & Execute**:
   - First signer confirms
   - Second signer confirms
   - Transaction executes

### Example: Reconfiguring Payees

```javascript
// In Safe UI, call:
checkpointAndReconfigure(
  ["0xNewPayee1", "0xNewPayee2"],  // New payees
  [3, 1],                           // New shares (75/25)
  ["0xUSDC...", "0xcbBTC...", "0xWETH..."]  // Tokens to checkpoint
)
```

Requires multi-sig approval before executing.

---

## Emergency Procedures

### If Contract Needs to be Paused

1. Detect issue (monitoring alerts)
2. Gather signers (Nicholas + Ignas + 3rd party)
3. Create Safe transaction to call `pause()`
4. Collect required signatures
5. Execute pause transaction
6. Investigate issue
7. Fix and unpause when safe

### If Upgrade is Needed

1. Deploy new implementation contract
2. Audit new implementation
3. Create Safe transaction for upgrade:
   ```javascript
   upgradeToAndCall(newImplementationAddress, "0x")
   ```
4. Collect required signatures
5. Execute upgrade
6. Verify upgrade successful
7. Test all functions

---

## Monitoring Recommendations

### Set Up Alerts For:

1. **Large Claims**:
   - Alert if `PaymentReleased` > $10,000
   - Monitor for unusual patterns

2. **Admin Actions**:
   - Any `PayeesReconfigured` event
   - Any `Checkpointed` event
   - Contract paused/unpaused

3. **Contract Balance**:
   - Alert if contract balance > expected threshold
   - Could indicate unclaimed fees accumulating

### Tools:

- **Tenderly**: https://tenderly.co (monitoring & alerts)
- **The Graph**: https://thegraph.com (event indexing)
- **OpenZeppelin Defender**: https://defender.openzeppelin.com (automated monitoring)

---

## Security Best Practices

### Multi-Sig Configuration

✅ **DO**:
- Use 2-of-3 or 3-of-5 configuration
- Store keys in hardware wallets
- Test with small amounts first
- Review all transactions before signing
- Keep Safe UI bookmarked (avoid phishing)

❌ **DON'T**:
- Use 1-of-N (defeats purpose of multi-sig)
- Share private keys between signers
- Sign transactions without reviewing
- Rush to execute transactions

### For Payees (Nicholas & Ignas)

✅ **DO**:
- Claim fees regularly (weekly/monthly)
- Check pending amounts before claiming
- Use hardware wallet for claiming
- Monitor vault fee generation

❌ **DON'T**:
- Let fees accumulate for months (gas inefficient)
- Share wallet private keys
- Claim from untrusted interfaces

---

## Contact & Support

**For Issues**:
- GitHub Issues: https://github.com/Muscadine-Labs/Muscadine-Labs-Contracts/issues
- Multi-Sig Safe: https://app.safe.global

**Emergency Contacts**:
- Nicholas: [Add contact info]
- Ignas: [Add contact info]
- 3rd Signer: [Add contact info]

---

## Appendix: Contract Addresses

### Mainnet (Base)
- **Proxy**: [To be filled after deployment]
- **Implementation**: [To be filled after deployment]
- **Owner (Multi-sig)**: `0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A`

### Testnet (Base Sepolia)
- **Proxy**: [To be filled after testnet deployment]
- **Implementation**: [To be filled after testnet deployment]
- **Owner (Multi-sig)**: `0x4E5D3ef790C75682ac4f6d4C1dDCc08b36fC100A`

### Muscadine Vaults
- **USDC Vault**: `0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F`
- **cbBTC Vault**: `0xAeCc8113a7bD0CFAF7000EA7A31afFD4691ff3E9`
- **WETH Vault**: `0x21e0d366272798da3A977FEBA699FCB91959d120`

