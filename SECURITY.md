# Security Policy

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability in this project, please help us by reporting it responsibly.

### How to Report

**Please do NOT open a public GitHub issue.**

Instead, please report security vulnerabilities by emailing the maintainers directly. Include:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

### What to Expect

- We will acknowledge receipt of your vulnerability report within 48 hours
- We will provide a more detailed response within 7 days
- We will work on a fix and coordinate disclosure

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Best Practices

When using this contract:

1. **Audit Before Deployment**: Have the contract audited by professional security auditors
2. **Test Thoroughly**: Run comprehensive tests on testnets before mainnet deployment
3. **Start Small**: Begin with small amounts to verify correct operation
4. **Monitor Activity**: Set up monitoring for contract events and unusual activity
5. **Understand Upgradeability**: Only the owner can upgrade the contract via UUPS
6. **Secure Keys**: Protect owner private keys with hardware wallets or multi-sig

## Known Considerations

- This contract uses UUPS upgradeability pattern - ensure upgrade authorization is properly secured
- Owner has significant privileges (pause, upgrade, reconfigure) - use multi-sig for production
- Pull-based payment pattern requires users to actively claim funds
- Checkpointing system preserves credits during reconfiguration

## Dependencies

This project uses OpenZeppelin Contracts v5.0.2:
- `@openzeppelin/contracts`
- `@openzeppelin/contracts-upgradeable`

Always use the latest stable versions and monitor OpenZeppelin security advisories.

