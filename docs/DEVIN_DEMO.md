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

# Dependency Security Scan (Devin remediation demo)

This repository ships a self-contained dependency security scanner that audits
**Superset's real, committed dependency lockfiles** for **real published
CVEs**, and files one GitHub issue per actionable finding. Those issues are the
input queue for a separate remediation orchestrator.

> **Nothing here is synthetic.** No fake packages, vulnerable fixtures, or
> planted files are introduced. The scanner only *reads* lockfiles that already
> exist in the repo and reports what the public Python advisory databases say
> about them. No existing requirements, lockfiles, or source were modified to
> create findings.

## What gets scanned

The scanner targets the repository's real pinned lockfiles:

| Manifest | Role | Scanned by default |
| --- | --- | --- |
| `requirements/base.txt` | Production runtime dependencies (uv-compiled, fully pinned) | ✅ Yes |
| `requirements/development.txt` | Dev/test dependencies (includes build-only extras such as `mysqlclient`) | Opt-in via `SCAN_MANIFESTS` |

`requirements/base.txt` is the default because it is the production surface and
every line is a concrete `name==version` pin. `development.txt` can be added,
but some of its entries (`mysqlclient`, etc.) need system build libraries just
to resolve metadata; the scanner skips any manifest it cannot resolve rather
than failing the whole run.

Abstract manifests (`pyproject.toml`, `setup.py`) are intentionally **not**
audited: they express version *ranges*, not the exact resolved versions that
determine whether a deployment is actually vulnerable.

## How it works

`scripts/scan_and_file_issues.py`:

1. Reads each target lockfile and keeps only fully-pinned `name==version`
   lines (editable installs like `-e ./superset-core` and VCS URLs are dropped
   so `pip-audit` does not try to build them).
2. Runs `pip-audit --no-deps --format json` against that pinned set. `pip-audit`
   queries the PyPI/OSV advisory data and returns a JSON report.
3. Parses the report into findings and enriches each one with a qualitative
   **severity** via the [OSV API](https://osv.dev) (GitHub-reviewed advisories
   provide a severity band directly; otherwise a CVSS v3 base score is computed
   from the vector).
4. Triages, sorts, caps, and files issues (see below).

### JSON schema consumed

`pip-audit` emits:

```json
{
  "dependencies": [
    {
      "name": "flask",
      "version": "2.3.3",
      "vulns": [
        {
          "id": "CVE-2026-27205",
          "fix_versions": ["3.1.3"],
          "aliases": ["GHSA-68rp-wp8r-4726"],
          "description": "..."
        }
      ]
    }
  ],
  "fixes": []
}
```

## Triage rules

| Condition | Outcome | Label |
| --- | --- | --- |
| `fix_versions` is non-empty | **Actionable** — a concrete upgrade exists | `devin-remediate` |
| `fix_versions` is empty | No fix available yet (informational) | `no-fix-available` |

The `devin-remediate` queue is kept strictly to genuinely fixable items so the
orchestrator never wastes effort on vulnerabilities that have no upstream fix.

### Volume control (defaults)

Superset's tree can surface many findings, so volume is bounded by environment
variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `SCAN_MANIFESTS` | `requirements/base.txt` | Comma-separated lockfiles to audit |
| `SCAN_MAX_ISSUES` | `25` | Max **actionable** issues per run (most severe first; overflow dropped) |
| `SCAN_MIN_SEVERITY` | `LOW` | Drop findings below this band (`LOW`/`MODERATE`/`HIGH`/`CRITICAL`) |
| `SCAN_INCLUDE_NO_FIX` | `true` | Also file `no-fix-available` issues (not capped) |
| `SCAN_DRY_RUN` | `false` | Print what would be filed without writing |

Actionable findings are sorted **most severe first**, then by advisory id for
determinism, before the `SCAN_MAX_ISSUES` cap is applied — so the cap only ever
drops the least severe overflow.

## Idempotency

Each issue has a stable title key:

```
[devin-remediate] <package> <vuln-id>      # actionable
[no-fix-available] <package> <vuln-id>     # no fix yet
```

Before filing, the scanner lists open issues carrying either label via the
GitHub REST API and skips any whose title key already exists. Re-runs (daily
cron, pushes, manual dispatch) therefore never create duplicates.

## Issue body contract

Every issue is both human-readable (package, installed version, fixed version,
severity, advisory id + link, originating manifest) **and** machine-readable.
The orchestrator parses the fenced JSON block:

````markdown
```json
{
  "package": "flask",
  "current_version": "2.3.3",
  "fixed_version": "3.1.3",
  "vuln_id": "CVE-2026-27205",
  "manifest_path": "requirements/base.txt"
}
```
````

## How this feeds the orchestrator

This repo is only the **producer**. The flow is:

1. **This scanner** (here) detects real vulns and files `devin-remediate`
   issues with a parseable JSON payload.
2. **The separate orchestrator repo** polls/receives those issues, reads the
   JSON block, and dispatches a remediation agent that bumps the pinned
   version in the relevant manifest and opens a fix PR.
3. When the PR merges and the version is bumped, the next scan no longer finds
   the vuln, so the issue stops being re-filed and can be closed.

The label and JSON contract above are the integration boundary; the
orchestrator never has to scrape free-form text.

## Running locally

```bash
# 3.11 matches the workflow; some pins (e.g. pandas) lack wheels on newer Python.
python3.11 -m venv .venv && source .venv/bin/activate
pip install --upgrade pip pip-audit requests

# Dry run: audit + triage, but do not touch GitHub (no token needed).
SCAN_DRY_RUN=true GITHUB_REPOSITORY=<you>/superset \
  python scripts/scan_and_file_issues.py

# Real run against your fork: files issues for the real findings.
export GITHUB_TOKEN=…            # needs issues:write on the repo
export GITHUB_REPOSITORY=<you>/superset
python scripts/scan_and_file_issues.py
```

## CI workflow

`.github/workflows/security-scan.yml` runs the scanner:

- **Triggers:** daily `schedule` cron, manual `workflow_dispatch` (with
  manifest/severity/cap inputs), and `push` to dependency manifests on `master`.
- **Permissions:** `contents: read`, `issues: write`.
- **Steps:** checkout → set up Python 3.11 → install `pip-audit`/`requests` →
  run the scanner with `GITHUB_TOKEN: ${{ github.token }}`.

`pip-audit` exits non-zero when it finds vulnerabilities. The scanner owns the
invocation and keys success off a parseable JSON report, so the job still files
issues on findings and only fails on genuine tool errors.
