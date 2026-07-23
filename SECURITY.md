# Security policy

EPHERA is a payments platform. This repository is a **sandbox reference build**:
every rail is a simulator, screening is a fixture, and no service has ever moved
live funds. Even so, its authorisation, identity, and ledger boundaries are the
point of the project, and security reports against them are welcome.

## Reporting a vulnerability

**Do not open a public issue for a security report.**

- Use GitHub's **private vulnerability reporting** (repository → *Security* →
  *Report a vulnerability*), or
- email **frankleroyvan@gmail.com** with `EPHERA security` in the subject.

Please include the commit, the affected service, a description, and — where
possible — a reproduction or failing test.

## What to expect

- **Acknowledgement:** within 3 working days.
- **Assessment:** initial severity and accept/decline within 10 working days.
- **Fix and disclosure:** coordinated; an advisory is prepared before public
  disclosure and you will be credited unless you prefer anonymity.

## Scope

In scope: the security properties the platform claims — the bounded-authority
grant (a component cannot authorise a payment a human did not sign, cannot
repoint it, cannot replay it), KYC-tier integrity (a subject cannot decide their
own tier), ledger authorisation, and the inter-service authentication boundary.

Out of scope (known, documented, and by design in a sandbox build):
- the simulated payment rails (`*/sim.go`) — no real telco/bank/PSP connectivity;
- the `SANDBOX-FIXTURE` screening list — not a licensed sanctions/PEP list;
- development credential defaults (`*_dev_only`) and the placeholder inter-service
  token — these are for local development and must be replaced before any
  non-sandbox deployment.

These sandbox limitations are not vulnerabilities; a production deployment is a
separate, gated, and currently unfulfilled undertaking (licensing, real rails,
third-party audit).

## Supported versions

This is pre-release software with no production support commitment.
