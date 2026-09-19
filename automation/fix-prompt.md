A nightly scan issue was just opened on @moliyadhaval/superset. Fix what it reports and open one pull request for it. The triggering issue's payload (number, title, body, labels) is appended below this prompt — read it first; it is the specification for this run.

This is an unattended run: nobody will answer questions. Never ask for input and never wait for a decision — where this prompt gives you a rule, follow the rule and record the reasoning in the PR description.

## Scope

One issue in, at most one PR out. Fix only what this issue reports. Do not opportunistically fix findings from the other nightly categories, do not reformat untouched code, and do not bump dependencies the issue does not name.

Work on a branch off the repo's default branch: `git checkout -b devin/nightly-fix-<issue-number>-<slug>`.

## How to decide what to fix

The issue's category label tells you the shape of the work. Fix the mechanically safe items first, and expect that in most categories you will only fix a subset — that is the correct outcome, not a failure.

- `npm-advisories` — run the advisory's fix in the affected workspace (`npm audit fix`, or bump the specific direct dependency). Never run `npm audit fix --force`: it takes breaking majors. If an advisory has no patched version, or the only fix is a major bump of a direct dependency, leave it and explain why.
- `python-advisories` — bump the named pins. These are uv-generated lockfiles: edit the constraint in `requirements/base.in` (or the relevant `.in`) and regenerate with the repo's documented command rather than hand-editing `requirements/*.txt`. If a pin is deliberately capped (`base.in` carries caps with explanatory comments, e.g. the `setuptools<81` cap held for the `pkg_resources` migration), do NOT quietly lift the cap — leave it and say so in the PR.
- `outdated-deps` — bump only patch and minor versions that need no code change. Majors and coupled clusters (React/Redux/router, `@deck.gl` + `@luma.gl`) are out of scope for an autonomous PR: skip them and list them as follow-up work.
- `frontend-lint` — fix real defects, not warning counts: `jsx-key` (add stable keys, never array indices where the list reorders), `no-loss-of-precision`, `erasing-op`, and `rules-of-hooks` where the fix is genuinely local (e.g. move an early feature-flag return below the hook calls, or split the component so hook order is unconditional). Do NOT mass-edit `exhaustive-deps`: adding a missing dep can change render/fetch behaviour, so fix at most a handful you have reasoned through individually, or none. Never silence a finding with a disable comment.
- `ci-supply-chain` — harden the workflow: pin the unpinned installs to an exact version, pin third-party actions to a full commit SHA, narrow `permissions` to the minimum, and avoid resolving local composite actions from an untrusted PR checkout. Do not change what the workflow is for and do not touch secret names.
- `code-hardening` — implement the specific hardening the issue argues for (e.g. make the non-pickle codec the default, pass `usedforsecurity=False` on non-security MD5 uses). Do not attempt large complexity refactors of security-critical code such as `raise_for_access` or `get_sqla_query` in an autonomous PR — those need human review of intent; list them as follow-up.

If, after triage, nothing in the issue is safely auto-fixable, do NOT open an empty or cosmetic PR. Skip to "If you cannot produce a PR" below.

## Verify before you open the PR

Never open a PR on unverified changes. Run whatever is relevant to the files you touched and report the actual output:

- Python: `ruff check .` and `ruff format --check .` at the version pinned in `requirements/development.txt`, plus a targeted `pytest` for touched modules. The repo needs Python 3.11+; if the box has an older Python and the suite cannot run, say so explicitly rather than implying it passed.
- Frontend: `cd superset-frontend && npm ci` (or `npm install` if needed), then `npx oxlint` on the touched paths and `npx jest <touched test paths>`. For a lint fix, show that the specific rule's count dropped and that no new findings appeared.
- Dependency bumps: confirm the lockfile regenerated cleanly and the package installs/resolves; for npm, re-run `npm audit` and show the advisory is gone.
- Workflow edits: validate the YAML parses (`python -c "import yaml,sys; yaml.safe_load(open(...))"`) — CI itself is the real test.

If a check fails because of your change, fix it or drop that part of the change. If it fails for a pre-existing reason, confirm the same failure occurs on the unmodified default branch before calling it pre-existing.

## Deliverable

Open one PR against the default branch with `Fixes #<issue-number>` in the body (or `Refs #<issue-number>` if you only fixed part of it, so the issue stays open). The description must state, concretely:

1. Which findings from the issue this PR fixes, one line each with the before/after version or the file:line.
2. Which findings it deliberately does NOT fix, and why (major bump, deliberate cap, needs human judgement, no patch available).
3. The verification commands you ran and their real results.

Then comment on the triggering issue with the PR link and a one-line summary of fixed-vs-deferred. Keep the diff minimal and idiomatic to the surrounding code; do not commit scan output, notes, or scratch files.

## After the PR is open: CI and code review

Do not stop at PR creation. Take the PR to a green, reviewed state:

1. **Tests / CI.** Watch the PR's checks with the PR-checks tool until they settle. Pull the logs of any failed job and fix real failures caused by your change. Before calling a failure pre-existing or flaky, prove it: check the same job's status on the default branch or re-run it. Superset's CI is large and slow — expect a long wait, and do not conclude the run while checks are still pending. Give up after three genuine fix attempts and say so in the PR rather than churning.
2. **Devin Review.** Once the PR is open, request a review by posting a comment whose first line is exactly `/devin review` (case-insensitive, must start the comment). If the repo has auto-review enabled, a review may already be running — in that case don't request a second one.
3. **Act on the review.** Read the review comments on the PR with the PR-view tool. Fix high-severity findings and low-effort in-scope ones, and push the fixes. For low-severity nits, findings that would need substantial new code, or findings that contradict this prompt's explicit rules (e.g. one telling you to lift a deliberate `base.in` version cap or to mass-fix `exhaustive-deps`), do NOT silently comply: leave them, and reply on the PR explaining the reasoning. Re-check CI after any push.
4. Update the PR description if the changes moved on from what it says, and reflect the final state (CI green/red, review addressed or deferred) in the issue comment.

## If you cannot produce a PR

If nothing is safely auto-fixable, or your changes cannot be made to pass verification, do not open a PR and do not force a partial fix through. Instead comment on the issue explaining what you attempted, what blocked it, and what a human needs to decide. That is a valid, useful outcome for this run.

