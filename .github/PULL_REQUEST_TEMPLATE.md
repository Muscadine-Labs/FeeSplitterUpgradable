## Summary

<!-- Provide a brief description of the changes in this PR -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Contract upgrade (requires careful migration planning)
- [ ] Documentation update
- [ ] Configuration/tooling update

## Motivation and Context

<!-- Why is this change required? What problem does it solve? -->
<!-- If it fixes an open issue, please link to the issue here -->

## Changes Made

<!-- List the main changes introduced by this PR -->

- 
- 
- 

## Security Review Checklist

<!-- For contract changes, complete this security checklist -->

### Contract Security
- [ ] No new external calls to untrusted contracts
- [ ] All external calls use SafeERC20 where applicable
- [ ] Reentrancy guards are in place for state-changing functions
- [ ] Access controls (onlyOwner, whenPaused, etc.) are properly applied
- [ ] No unsafe math operations (overflow/underflow risks)
- [ ] Storage layout compatibility maintained (for upgrades)
- [ ] No new storage variables added in middle of existing layout

### Token Handling
- [ ] Deflationary token behavior considered and handled
- [ ] Balance tracking uses pre/post balance comparison where needed
- [ ] All tokens are registered before checkpointing
- [ ] Token transfers use SafeERC20

### Upgradeability
- [ ] UUPS upgrade authorization unchanged or properly secured
- [ ] Storage layout documented and verified compatible
- [ ] Initialize function protected against re-initialization
- [ ] No constructor usage (or properly disabled)

### Input Validation
- [ ] All user inputs validated (addresses, amounts, array lengths)
- [ ] Duplicate detection in place for address arrays
- [ ] Zero address checks for critical parameters
- [ ] Array length validations to prevent DOS

### Testing
- [ ] Unit tests cover new functionality
- [ ] Edge cases tested (zero amounts, duplicates, etc.)
- [ ] Deflationary token scenarios tested
- [ ] Checkpoint/reconfigure scenarios tested
- [ ] Gas usage is reasonable

## Test Summary

<!-- Describe the test cases added or modified -->

### Test Coverage

- [ ] All new code is covered by tests
- [ ] Existing tests still pass
- [ ] Integration tests added if needed
- [ ] Gas report reviewed and acceptable

### Scenarios Tested

1. **Basic Functionality**
   - [ ] ETH distribution and release
   - [ ] ERC20 distribution and release
   - [ ] Multiple payees with different shares

2. **Security Features**
   - [ ] Deflationary token handling
   - [ ] Checkpoint with token registry
   - [ ] Duplicate address rejection
   - [ ] Pause/unpause protection

3. **Edge Cases**
   - [ ] Zero balances
   - [ ] All funds claimed before reset
   - [ ] Unregistered token scenarios
   - [ ] Rescue functions when paused

## Gas Report Summary

<!-- Include gas usage for key operations -->

| Function | Gas Used | Notes |
|----------|----------|-------|
| releaseETH | | |
| releaseToken | | |
| checkpointAndReconfigure | | |
| resetPayees | | |

## Upgrade & Rollout Plan

<!-- For contract upgrades, describe the migration plan -->

### Pre-Upgrade
- [ ] All existing payees notified
- [ ] Contract paused for safety
- [ ] Current state documented

### Upgrade Steps
1. Pause contract
2. Checkpoint all tokens
3. Deploy new implementation
4. Upgrade proxy
5. Verify upgrade
6. Test key functions
7. Unpause contract

### Post-Upgrade
- [ ] Monitor contract behavior
- [ ] Verify all accounting is correct
- [ ] Update documentation
- [ ] Notify stakeholders

## Breaking Changes

<!-- List any breaking changes and migration instructions -->

None / <!-- or describe breaking changes -->

## Documentation

- [ ] Code is well-commented
- [ ] NatSpec documentation added/updated
- [ ] README updated if needed
- [ ] DEPLOYMENT.md updated if needed

## Deployment Checklist

<!-- For production deployments -->

- [ ] Tested on local hardhat network
- [ ] Tested on testnet (Sepolia/Base Sepolia)
- [ ] Verified on block explorer
- [ ] Ownership transferred to multi-sig
- [ ] All required tokens registered
- [ ] Monitoring and alerts configured

## Additional Notes

<!-- Any additional information reviewers should know -->

## Pre-Merge Checklist

- [ ] All CI checks passing
- [ ] Code reviewed by at least one team member
- [ ] Security review completed (for contract changes)
- [ ] Gas report reviewed and acceptable
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Ready to merge

---

## For Reviewers

<!-- What should reviewers focus on? -->

**Focus Areas:**
- 
- 

**Questions:**
- 
- 

