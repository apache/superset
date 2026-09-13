<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Devin automations on this fork

`moliyadhaval/superset` is a fork of [apache/superset](https://github.com/apache/superset)
used to trial fully unattended maintenance with [Devin](https://devin.ai). Four
automations run against it. None of them change `master` directly: everything
they produce is a GitHub **issue**, an issue **comment**, or a **pull request**
on a `devin/…` branch that a human reviews and merges.

## The pipeline at a glance

```
 02:37 UTC   Nightly scan ─────────► GitHub issues, label `nightly-scan` + category
                                          │
                       (GitHub App event) │  Auto-fix trigger  ← does not fire, see below
                                          ▼
 03:20 UTC   Fix dispatcher ───► one Devin session per open issue ───► PR  `devin/nightly-fix-<issue>-<slug>`
                                                                         body: `Fixes #<issue>`
 07:12 UTC   Observability dashboard ───► metrics comment on tracking issue #18
```

All times are UTC and all sessions are tagged `nightly-scan` + `superset` so
they can be found in the Devin session list.

## The four automations

| # | Automation | Trigger | Writes | Session tags |
|---|------------|---------|--------|--------------|
| 1 | **Nightly security, dependency & code-quality scan** | daily 02:37 UTC | issues on this repo | `nightly-scan`, `superset` |
| 2 | **Auto-fix nightly-scan issues → PR** | `github:issues` opened with title `[nightly …` | one PR per issue | `nightly-scan`, `superset`, `auto-fix` |
| 3 | **Dispatch fix sessions for nightly-scan issues** | daily 03:20 UTC | one issue comment per dispatched issue | `nightly-scan`, `superset`, `fix-dispatch` |
| 4 | **Daily automation observability dashboard** | daily 07:12 UTC | one comment on issue [#18](https://github.com/moliyadhaval/superset/issues/18) | `nightly-scan`, `superset`, `observability` |

### 1. Nightly scan (read-only, files issues)

Clones the repo, records the commit SHA, checks divergence from upstream
`apache/superset`, then runs:

| Category label | What is checked | Tools |
|----------------|-----------------|-------|
| `python-advisories` | every `name==version` pin in `requirements/base.txt` (runtime) and `requirements/development.txt` (dev/CI) | `pip-audit --no-deps -r`, falling back to the [OSV batch API](https://google.github.io/osv.dev/post-v1-querybatch/) |
| `npm-advisories` | `superset-frontend`, `superset-websocket`, `superset-embedded-sdk` lockfiles | `npm audit --audit-level=moderate` (`docs/` has no lockfile and is unauditable) |
| `outdated-deps` | pins vs latest stable on PyPI; `npm outdated` vs `package.json` ranges; notes deliberate caps in `requirements/base.in` | PyPI JSON API, `npm outdated --json` |
| `ci-supply-chain` | `.github/workflows`: `pull_request_target` + PR checkout, local `./.github/actions` from an untrusted checkout, unpinned installs, actions not pinned to a SHA, `${{ github.event.* }}` in `run:`, broad `permissions` | manual review |
| `frontend-lint` | production-code oxlint warnings (tests/stories/cypress excluded), prioritising `rules-of-hooks`, `jsx-key`, `exhaustive-deps`; ruff at the CI-pinned version | `npx oxlint --config oxlint.json`, `ruff check`, `ruff format --check` |
| `code-hardening` | bandit findings that survive triage (most hits carry an intentional `# noqa`), radon E/F complexity with `superset/security/` first, suppression-comment debt | `bandit -ll`, `radon cc -n E` |

Rules it follows:

- One **fresh** issue per category per night, only when there are findings.
  Title format: `[nightly YYYY-MM-DD] <category>: <counts> (worst: <finding>)`.
- Each issue states the **delta** vs the previous night's issue for that label
  (new / carried over / resolved) and links it.
- It never closes or edits earlier issues, never opens PRs, never touches files.
- Bodies are evidence-based: package + version, CVE/GHSA, severity, fixed
  version, `path:line`, the command that produced the finding, and the SHA.

### 2. Auto-fix (one issue in, at most one PR out)

Triggered when a `[nightly …` issue is opened. The session works on
`devin/nightly-fix-<issue-number>-<slug>` and fixes **only** what the issue
reports, with per-category guard-rails:

| Category | Will do | Will NOT do |
|----------|---------|-------------|
| `npm-advisories` | `npm audit fix` or bump the named direct dep | `npm audit fix --force`, breaking majors |
| `python-advisories` | edit `requirements/*.in`, regenerate the uv lockfile | lift deliberate caps (e.g. `setuptools<81`) |
| `outdated-deps` | patch/minor bumps needing no code change | majors, coupled clusters (React/Redux/router, deck.gl/luma.gl) |
| `frontend-lint` | real defects: `jsx-key`, `no-loss-of-precision`, `erasing-op`, local `rules-of-hooks` fixes | mass `exhaustive-deps` edits, disable comments |
| `ci-supply-chain` | pin installs and actions to exact versions / SHAs, narrow `permissions`, stop resolving local actions from a PR checkout | change what a workflow does, touch secret names |
| `code-hardening` | implement the hardening the issue specifies | opportunistic refactors |

Fixing only a subset is the expected outcome; skipped items are listed in the PR
as follow-up work. Reasoning for every judgement call goes in the PR
description. Concurrency is capped at 3 sessions, queue depth 10, 150 ACU per
session.

### 3. Fix dispatcher (why it exists)

The nightly scan files issues as the `devin-ai-integration` GitHub App, and
Devin does **not** re-trigger automations on events its own app authored — so
automation #2 never fires on its own. The dispatcher polls instead:

1. Reads the canonical fix prompt from automation #2 (never a copy).
2. Lists every open `nightly-scan` issue, whatever night it came from.
3. De-duplicates **per issue**: skip only if a PR says `Fixes #N` / `Refs #N`,
   a branch `devin/nightly-fix-N-*` exists, or an `auto-fix` session titled
   `… issue #N` exists. It never skips because a *sibling* issue in the same
   category has a PR, and never waits for a merge.
4. Dispatches one session per remaining issue (newest first, **max 30 per
   run**), passing the issue payload plus the numbers of the open PRs for the
   same category so the session extends/supersedes rather than duplicates.
5. Comments the session URL on each dispatched issue and finishes with an
   issue → dispatched/skipped → URL table.

Because an issue with no PR stays eligible, a missed or failed night
self-heals on the next sweep.

### 4. Observability dashboard

Posts one comment per day on issue #18 with, over the last 30 days: median PR
cycle time, average review comments per PR, green/red/pending CI ratio per PR
head, issues filed per day by category, automation runs per day / per
automation (succeeded / failed / running, last-run date, stale-automation
flag), and the count and oldest age of open automation PRs. It compares with
the previous full dashboard and posts a one-line "no change" note when nothing
moved. It never edits repo files.

## How to recognise automation artefacts

| Artefact | How to spot it |
|----------|----------------|
| Scan issue | label `nightly-scan` + one of the six category labels; title starts with `[nightly ` |
| Fix PR | head branch `devin/nightly-fix-<N>-…`, body contains `Fixes #<N>` |
| Dispatch comment | "Auto-fix session dispatched for this issue … https://app.devin.ai/sessions/…" |
| Dashboard | comments on issue #18 |
| Devin sessions | tags `nightly-scan` / `auto-fix` / `fix-dispatch` / `observability` |

## Running the checks locally

`automation/Dockerfile` builds a small toolbox image (Python 3.11, Node 24,
`gh`, `jq`, and the exact scanners above with `ruff` pinned to the CI version).
It is **not** the Superset application image — use the top-level `Dockerfile`
and `docker-compose.yml` for that.

```bash
# from the repo root
docker build -t superset-automation -f automation/Dockerfile .

# interactive shell with the repo mounted at /workspace
docker run --rm -it --user "$(id -u):$(id -g)" -v "$PWD":/workspace -e GH_TOKEN -e DEVIN_API_KEY superset-automation
```

Inside the container (or on any machine with the same tools):

```bash
# Reproduce a nightly-scan category; raw JSON lands in automation/out/
scan.sh python-advisories
scan.sh ci-supply-chain
scan.sh code-hardening
scan.sh all                      # everything; frontend-lint needs superset-frontend/node_modules

# Validate the pipeline: open issues, which already have a fix PR, session states
status.sh
```

`status.sh` needs `gh` authenticated (`GH_TOKEN` or `gh auth login`).
`DEVIN_API_KEY` (a read-only key from
[app.devin.ai/settings/api-keys](https://app.devin.ai/settings/api-keys)) is
optional and adds the Devin session list. Neither script writes to GitHub.

## Manually triggering a run

From the Devin web app open the automation and use **Run now**; a manual run
bypasses the schedule/trigger conditions. Runs are visible under the
automation's invocations, and every spawned session carries the tags above.

## Limits and known gaps

- The auto-fix `github:issues` trigger is effectively dead for App-authored
  issues; the dispatcher is the real entry point.
- Several nights of issues describe the same finding, so many fix PRs will
  overlap. Sessions are told about sibling PRs, but reviewers should expect
  "already covered by #X" PRs and close the duplicates.
- `docs/` cannot be `npm audit`-ed (no lockfile).
- The sessions API reports `acus_consumed: 0`, so ACU cost is not on the
  dashboard.
- The observability dashboard only knows about automations #1 and #2; the
  dispatcher (#3) is not yet in its run counts.
