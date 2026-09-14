# vitalcv-repo-health

Runs a fast integrity scan on the VitalCV repository to detect architectural drift,
package-manager conflicts, and violations of the canonical repo contract.

## Checks performed

- Detects multiple package managers:
  - `package-lock.json`
  - `yarn.lock`
  - `pnpm-lock.yaml`
- Flags duplicate frontends or backends
- Verifies canonical repository:
  - `equals9/vitalcv-monorepo`
- Scans for rogue apps, services, or infra roots
- Ensures monorepo consistency

## Command behavior

- Read-only
- No file mutations
- Fails fast on high-severity violations
- Outputs a concise health report
