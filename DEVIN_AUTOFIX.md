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

## Devin Autofix Workflow

An automated issue-remediation system powered by [Devin](https://devin.ai). An
allowlisted engineer comments `/devin-fix` on a GitHub issue and Devin
diagnoses the bug, writes tests, implements a fix, and opens a PR — all tracked
through GitHub labels and hidden comment markers.

### How to run

1. **Open a GitHub issue** with a clear bug description and reproduction steps.
2. **Comment `/devin-fix`** on the issue (you must be on the
   [allowlist](scripts/devin_autofix/README.md#allowlist)).
3. The **Devin Autofix** workflow
   ([`.github/workflows/devin-autofix.yml`](.github/workflows/devin-autofix.yml))
   validates permissions, creates a Devin session, and posts a tracking comment
   on the issue.
4. A **monitor** workflow
   ([`.github/workflows/devin-autofix-monitor.yml`](.github/workflows/devin-autofix-monitor.yml))
   runs every 15 minutes: it polls active sessions, links opened PRs back to the
   issue, requests review from the trigger commenter, and updates labels.
5. A **report** workflow
   ([`.github/workflows/devin-autofix-report.yml`](.github/workflows/devin-autofix-report.yml))
   runs every 6 hours (or on demand) and produces analytics artifacts
   (`automation_report.html`, `automation_runs.csv`, `automation_runs.sqlite`).

You can also trigger the workflow manually from the **Actions** tab by selecting
**Devin Autofix** → **Run workflow** and entering an issue number.

### Workflow description

| Component | File | Purpose |
|-----------|------|---------|
| **Trigger** | `devin-autofix.yml` | Listens for `/devin-fix` comments (and `workflow_dispatch`). Checks the user allowlist, validates the issue is open, guards against duplicate runs, and starts a Devin session via the API. |
| **Monitor** | `devin-autofix-monitor.yml` | Scheduled every 15 min. Polls Devin sessions for each labeled issue, detects new PRs, posts PR links, requests reviewers, and transitions labels (`in-progress` → `waiting-review` → `complete` / `returned-human`). |
| **Report** | `devin-autofix-report.yml` | Scheduled every 6 hours. Scans all issues with autofix labels, collects run markers and PR metadata, and generates an HTML dashboard, CSV export, and SQLite database uploaded as workflow artifacts. |

**Labels** applied to issues during the lifecycle:

- `devin-autofix/in-progress` — Devin session is active
- `devin-autofix/waiting-review` — PR opened, review requested
- `devin-autofix/returned-human` — Devin could not complete the fix
- `devin-autofix/complete` — PR merged

**Required GitHub Actions secrets:** `DEVIN_API_KEY`, `DEVIN_ORG_ID`

See [`scripts/devin_autofix/README.md`](scripts/devin_autofix/README.md) for
full architecture details and script-level documentation.
