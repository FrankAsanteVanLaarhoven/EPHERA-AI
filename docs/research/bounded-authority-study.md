# Bounded authority for money movement

**A study: hypothesis, design, failures, refinement, and what the evidence
supports.**

Artefacts: [`modules/boundedauth`](../../modules/boundedauth) ·
[`SPEC.md`](../../modules/boundedauth/SPEC.md) ·
[workload notebook](../../modules/boundedauth/notebooks/ieee-cis-workload-study.ipynb) ·
[`ADOPTION.md`](../../modules/boundedauth/ADOPTION.md)

---

## 1. Hypothesis

The work began from a specific dissatisfaction. Authorisation in payment systems
is almost universally a **bearer token**: the caller presents a string, the
server checks it is valid, the payment proceeds. The token attests *who is
calling*. It does not attest *what they agreed to*.

That gap was tolerable while the caller was a person pressing a button. It stops
being tolerable when the caller is an automated agent assembling payment
requests from text it was handed, because the question changes from "is this
caller authenticated" to "did a human agree to **this** payment".

Three hypotheses, stated so they can fail:

> **H1 — Separability.** The transaction-bound authorisation built inside EPHERA
> is not specific to EPHERA. It can be stated as a general contract that an
> unrelated system could adopt, and doing so will not lose any of its
> properties.

> **H2 — Checkability.** The property that matters — a credential spent exactly
> once, atomically with the money it moves — can be verified *in someone else's
> implementation*, by a portable test suite, rather than asserted in prose.

> **H3 — Affordability.** Making every payment carry such a credential is
> affordable at realistic traffic shapes, and its refusal paths do not degrade
> under volume.

H1 and H2 are engineering claims, falsified by extraction failing or by the
suite being unable to discriminate. H3 is empirical, and needs real traffic.

---

## 2. Design

### 2.1 The credential

A binding is the transaction: payer, payee, amount, fee, currency, reference,
and an optional opaque context. Its digest is SHA-256 over **length-prefixed**
fields — without prefixing, `alice → bob` and `ali → cebob` hash identically and
a credential for one authorises the other. The version string is inside the
digest, so a digest under one version can never collide with one under another.

The credential is that digest, signed Ed25519 by a trusted issuer, with a
subject, a method, a unique identifier and a lifetime ceiling of five minutes
enforced **at mint and at verify** — both ends, because either end can be the
one that is compromised.

The design's sharpest edge is a deployment recommendation rather than a
mechanism: **use the binding digest as the WebAuthn challenge**. Then the
customer's device signs the transaction rather than an opaque nonce, and even a
compromised issuer cannot obtain a device signature for a payment the human
never saw.

### 2.2 The contract

Verification alone leaves a credential infinitely replayable. Single use needs
durable state, and — the part that is easy to miss — that state must commit *in
the same transaction as the effect*.

That is a property of the host's storage, not of a library. So the design splits:
the library verifies; the host implements a `Store` whose `Consume` must record
consumption and run the effect atomically. The library then supplies a
**conformance suite** that tests the host.

Verification of the binding happens **before** consumption. Otherwise anyone who
observes a credential can destroy it by presenting it against a transaction of
their own choosing — a denial of service hiding inside a security control.

---

## 3. Initial results, and three failures

### 3.1 Extraction exposed two latent defects (H1)

Carving the code out of EPHERA was expected to be mechanical. It was not.

- **The issuer was a package constant.** No second party could use the library
  at all, and — worse — there was no way to trust a second issuer without
  widening what the first could authorise. Fixed by making the verifier hold a
  per-issuer key map.
- **Single use was welded to the ledger's table.** Generalising forced the real
  requirement into the open: not "record the identifier" but "record it in the
  same transaction as the effect".

H1 survived, but only after generalisation acted as a defect detector. Neither
problem was visible while the code had exactly one caller.

### 3.2 The conformance suite passed a broken store — 1 run in 5

This was the significant failure.

A conformance suite that has never been shown to fail anything is a claim, not a
check. So the suite was run against a deliberately broken store: check, release
the lock, act, then mark — the shape that gets written and reviewed and shipped
because it reads correctly.

**Initial result: the suite caught 3 of 8 checks, and the concurrency check was
not among them reliably.** Across repeated runs it caught the double spend only
about four times in five. The Go scheduler was serialising the sixteen
goroutines often enough that the broken store simply never exhibited the defect.

A check that catches a defect 80% of the time is worse than no check, because it
issues a conformance result that someone will rely on. A store could pass by
luck.

### 3.3 One broken store could not exhibit every defect

The second failure was in the test rather than the suite. A single contrived
store was expected to fail four specific checks; it structurally could not.
Check-then-act *does not* burn the credential on a failed effect — it marks
afterwards — so the two rollback checks had nothing to catch.

---

## 4. Refinement

**The concurrency check now forces overlap instead of hoping for it.** The
effect holds a barrier: each attempt waits until all sixteen have arrived, or
until a 200 ms timeout. A correct store admits exactly one goroutine, which
waits out the timeout alone and proceeds — costing one timeout per run. A broken
store admits all sixteen, the barrier opens immediately, and they overlap by
construction.

The check also now asserts on **how many attempts entered the effect**, not only
on how many succeeded. That converts a probabilistic observation into a
structural one.

**The negative test now uses two stores**, each embodying one real anti-pattern,
each asserted against the specific checks it must fail:

| Broken store | Real-world shape | Must be caught by |
| --- | --- | --- |
| check → act → mark | Lock released across the effect | concurrency, effect-write rollback |
| mark → act | Consumption committed before the effect | consumption rollback, effect-write rollback, credential-spendable-after-failure |

Plus an assertion that **not every** check fails — a suite that rejects all
stores is as uninformative as one that accepts all of them.

**Result after refinement:** 8 consecutive race-enabled runs, deterministic in
both directions. Every check the suite claims to make has been demonstrated to
fail something.

---

## 5. Further experiments

### 5.1 A real database (H2)

An in-memory pass does not establish a transactional property. A PostgreSQL
reference store was built — in a separate Go module, so a verifier embedded
elsewhere does not inherit a driver.

Its central design choice: **single use comes from the primary key, not from a
read**. There is no `SELECT`. A check followed by an insert is two operations
with a gap, and the gap is the double spend; the insert either succeeds or
raises a unique violation, and PostgreSQL resolves concurrency internally.
Rollback then needs no handling at all — a failed effect takes the consumption
row with it.

It passes the suite on a real database under `-race`. A second harness runs the
same store with the effect writing on the **pool instead of the transaction** —
the mistake that is easiest to make and hardest to see, since the code reads
identically and every ordinary test still passes. The suite catches it.

### 5.2 Turning the suite on its origin

The contract came *from* EPHERA's ledger, which makes that ledger the
implementation most likely to be assumed correct and least likely to be tested
against the thing it inspired.

To make the result mean anything, the consuming `INSERT` was extracted into one
function called by both `CaptureTransfer` and the adapter, so the suite
exercises **the statement that actually posts money**.

The ledger passes. Verified by mutation rather than assertion: making the unique
violation return `nil` instead of an error produced **7 failures**; restoring it
passes.

### 5.3 A real workload (H3)

Synthetic benchmarks get one thing badly wrong: they spread load uniformly. Real
payment traffic concentrates.

The IEEE-CIS Fraud Detection dataset was used for its *shape* — 590,540 real
card transactions, verified against published characteristics before use
(`sha256 3a5c83ab…`, 683,351,067 bytes, 3.50% fraud rate, 13,553 distinct
payers, mean amount $135.03).

The concentration is severe and is what makes the test worth running:

| | |
| --- | --- |
| Gini coefficient of payer frequency | **0.888** |
| Share of traffic from the top 1% of payers | **52.8%** |
| Busiest single payer | **14,932** transactions |

50,000 transactions were replayed through the real path — mint, verify,
consume-and-post atomically — against PostgreSQL.

All throughput figures are the median of **three** runs, with the observed
run-to-run spread stated — a discipline adopted only after §6 showed what a
single run had produced.

| Measurement | Result |
| --- | --- |
| Verification alone (single core) | **31,337/s**, p50 **0.031 ms** |
| Full path, 1 worker | 551/s, p50 1.61 ms (spread 3.2%) |
| Full path, 64 workers | **20,985/s**, p50 **3.11 ms** (spread 10.5%) |
| Full path, 128 workers | 21,186/s, p50 6.49 ms — **saturated** |
| Replay attempts | **5,000 / 5,000 refused**, p50 0.51 ms |
| Repointing attempts | **1,000 / 1,000 refused**, **0** credentials burned |
| Effects failed deliberately | 667; **667** credentials still spendable, **0** lost |
| Busiest 10 payers vs distinct payers (32 workers) | p50 3.21 vs 2.18 ms (**1.48×**), throughput **−20.1%** |
| Control — every payment updates one shared row | p50 **34.72 ms** (**15.9×**), throughput **−94.4%** |

### 5.4 Red-teaming the measurements

The first version of §5.3 was reviewed adversarially rather than accepted. Three
findings, in ascending order of embarrassment:

**The contention test contained no concurrency.** It ran in a single sequential
loop and reported "no measurable contention penalty on the busiest payers". With
one goroutine there is nothing to contend for, so the result was uninformative
while reading as though it were a finding. Rewritten to run cohorts concurrently.

**The super-linear anomaly was measurement noise.** One run per level had shown
throughput more than doubling from 32 to 64 workers; it was written up as an
anomaly with a PostgreSQL group-commit hypothesis attached. With three runs the
spread is 3–16% and the step is 2.12× for 2× workers — linear within noise. The
hypothesis was not so much wrong as unnecessary: it existed to explain a number a
second run would have dissolved.

**A sensitivity control caught a silently broken measurement.** A control cohort
was added in which every payment updates one shared row, so the test must show a
penalty where contention genuinely exists. It reported *cannot detect
contention* — because all three cohorts minted credentials from the same
identifier range, so the later cohorts presented already-spent credentials and
every operation failed as a replay. The control measured zero operations. Without
that check, a null contention result would have been published from a harness
that was measuring nothing.

Two further defects surfaced on the way: a connection pool configured above
PostgreSQL's `max_connections` (27,981 connection failures, contaminating the
128-worker figure), and per-operation latency excluding credential minting while
throughput included it.

---

## 6. Insights

**The cryptography is not the cost.** Verification is 0.031 ms against a 3.16 ms
full path — under 1%. Every intuition that transaction-bound authorisation is
expensive is an intuition about signatures, and it is wrong. The cost is the
database commit, which a payment system is already paying.

**Refusal is several times cheaper than acceptance** (0.51 ms vs 1.61 ms here;
the ratio moved between roughly 3× and 6× across runs, so the direction is robust
and the multiple is not). This is a
load-shedding property nobody designed for: an attacker replaying credentials at
volume does *less* work per request to the platform than a legitimate customer,
so a replay flood degrades the system far more slowly than paying traffic.

**The most valuable result is a zero.** 1,000 repointing attempts burned 0
credentials. Refusing a repointed credential is the obvious requirement; the
subtle one is that refusal must not *spend* it, or anyone observing a credential
in flight could destroy it and the customer's genuine payment would fail. The
ordering decision in §2.2 is what produces that zero, and it would have been
easy to get backwards.

**Payer concentration costs something, and the first two attempts to measure it
were worthless.** The corrected measurement finds the ten busiest payers pay
about +1 ms on median latency and lose ~20% throughput — real, and contrary to
the earlier claim of no penalty. What makes it small rather than severe is
structural: consumption is keyed by the *credential's* identifier, not by
account, so two payments from one busy payer touch different rows. The control
shows what the alternative would cost — genuine row serialisation is 15.9× worse.
Keying single use by account would have looked natural and would have landed the
0.888 Gini directly on the customers who transact most.

**Generalisation is a defect detector.** Both latent defects in §3.1 were
invisible while the code had one caller. Extracting a component is not only
packaging; it is a test.

**A test that usually catches a defect is a liability.** §3.2 is the finding
most likely to transfer to other work. The suite was not wrong — it was
*probabilistic*, and it would have issued a passing conformance result to a
store with a double spend in it, roughly one time in five.

**A test that cannot fail proves nothing — and that applies to measurements too.**
The sensitivity control is the transferable idea here. A benchmark that reports
"no effect" should be required to demonstrate it can detect the effect when it is
present, exactly as a conformance suite should be required to fail a broken
implementation. Both of this study's null results were wrong before that
discipline was applied, and one of them was wrong twice.

### A negative result worth stating

The original intent was to quantify how much fraud in the dataset bounded
authority would have prevented. **That number is not computable, and none is
claimed.**

Payment fraud splits into *unauthorised* payments — which this addresses
structurally — and *authorised push* fraud, where the account holder was
deceived and authorised it themselves, which this does not address at all. The
IEEE-CIS labels mark fraud; they do not record the category. The notebook
demonstrates the absence rather than asserting it, by showing no column carries
authorisation status, initiation channel, or deception signal.

A prevention rate could have been produced from this dataset. It would have been
manufactured.

---

## 7. Threats to validity

In descending order of seriousness.

1. **Payees are synthesised.** The dataset has no payee, so payee-side hot-row
   contention — many payments converging on one merchant — is unmeasured. In a
   real double-entry ledger this is where contention concentrates. Largest gap.
2. **Same-host database.** No network latency in these figures. The scaling
   *shape* and the *relative* costs transfer; the absolute throughput is not a
   capacity claim.
3. **The effect is one `INSERT`.** A real capture writes postings, balances,
   evidence and a receipt. Authorisation overhead is therefore a *larger* share
   here than in production — conservative in the right direction, but not the
   production transaction.
4. **Three runs per concurrency level; one per contention cohort.** Throughput
   spread is 3–16%. The ~20% hot-vs-distinct throughput gap sits within what that
   spread could produce, so it is suggestive rather than established. The
   control's 15.9× gap is far outside it and is safe to rely on.
5. **Card data, not mobile money.** Different amounts and fee model. Payer
   concentration, the property leaned on, is present in both.
6. **No third-party audit or penetration test.** The tests were written by the
   author of the code.

---

## 8. Conclusion

**H1 (separability) — supported.** The component was extracted with no
dependencies outside the standard library and adopted by an unrelated
implementation. Extraction exposed two latent defects, which is itself evidence
the abstraction was doing work.

**H2 (checkability) — supported, and this is the transferable contribution.**
The property can be checked in someone else's implementation. Three independent
implementations pass — in-memory, PostgreSQL, and EPHERA's ledger — and the suite
is demonstrated to fail two realistic anti-patterns and an effect on the wrong
connection. The suite's own probabilistic failure, found and fixed, is part of
the evidence that it was tested rather than trusted.

**H3 (affordability) — supported within stated limits.** ~3 ms median, ~21,000
authorised payments/s on one commodity host saturating at 64–128 workers, flat
latency until saturation, a small (~20% throughput) penalty for payer
concentration against a 15.9× penalty for genuine serialisation, and every
adversarial path refused at volume.

The strongest defensible statement:

> Making every payment carry a transaction-bound, single-use authorisation is
> affordable at realistic traffic shapes; its refusal paths hold under volume;
> and — unusually for a security control — whether an adopter has implemented it
> correctly is decidable by running a suite rather than by reading their code.

The last clause is the part worth keeping. Most security guidance ends at
"implement this carefully". This ends at a command that returns non-zero.

### Open work

- Payee-side contention, with a real double-entry effect
- Repeat the contention cohorts to separate the ~20% gap from run-to-run spread
- Proper confidence intervals rather than min/max spread
- Key rotation (absent from version 1)
- Third-party review — the one claim that cannot be self-certified
