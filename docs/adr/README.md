# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for VitalCV.

ADRs document significant architectural decisions made during development,
including context, alternatives considered, and consequences.

## Format

Each ADR follows the template in [0000-template.md](./0000-template.md).

## Status Values

- **Proposed** — under discussion
- **Accepted** — the decision is in effect
- **Deprecated** — superseded by a newer ADR (link to replacement)
- **Superseded** — replaced; kept for historical record

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](./0001-trust-substrate.md) | Trust Substrate as Single Source of Truth | Accepted |
| [0002](./0002-sd-jwt-vc.md) | SD-JWT Verifiable Credentials over JWT-VC | Accepted |
| [0003](./0003-openid-federation.md) | OpenID Federation for Cross-Network Trust | Accepted |
| [0004](./0004-healthstart-controls.md) | HealthStart NIST/HIPAA Control Mapping | Accepted |
| [0005](./0005-audit-ledger-taxonomy.md) | Audit Ledger Event Taxonomy | Accepted |
| [0006](./0006-graph-backlinks-authz-consent.md) | Public Bidirectional-Relationships Endpoint — Authz & Consent | Proposed |
| [0008](./0008-requirement-policy-and-integrated-apply-eligibility.md) | Requirement Policy Is Not a Precondition for Integrated Apply | Proposed |

## Contributing

1. Copy `0000-template.md` to the next available number.
2. Fill in all sections (Status = **Proposed** initially).
3. Open a PR — use label `adr`.
4. On merge, update the index above and set Status = **Accepted**.

> Inspired by [Palantir ADR practices](https://palantir.github.io/blueprint/docs/general/architecture/).
