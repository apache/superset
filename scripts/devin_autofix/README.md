# Devin GitHub Issue Autofix

An event-triggered automation system that lets an allowlisted engineer comment
`/devin-fix` on a GitHub issue to start a Devin remediation workflow. Devin
diagnoses the issue, creates tests, implements a fix, and opens a PR — all
tracked through GitHub metadata.

## Architecture

The system consists of three GitHub Actions workflows backed by Python scripts:

1. **`devin-autofix.yml`** — Triggered by `/devin-fix` comments. Validates the
   actor, creates a Devin session, and posts tracking markers on the issue.

2. **`devin-autofix-monitor.yml`** — Runs on a schedule (every 15 min). Polls
   Devin sessions, detects PRs, comments PR links on issues, requests reviewers,
   and updates labels.

3. **`devin-autofix-report.yml`** — Runs on a schedule (every 6 hours) or on
   demand. Generates analytics artifacts: `automation_report.md`,
   `automation_runs.csv`, and `automation_runs.sqlite`.

## Scripts

| File | Purpose |
|------|---------|
| `github_state.py` | Shared helpers for GitHub API, hidden markers, labels |
| `start_session.py` | Creates a Devin session and posts initial markers |
| `monitor_sessions.py` | Polls sessions, links PRs, requests reviewers |
| `reviewers.py` | Reviewer request logic |
| `report.py` | Analytics report generator (Markdown + CSV + SQLite) |
| `schema.sql` | SQLite schema for the analytics database |

## Labels

Status labels applied to issues:

- `devin-autofix/in-progress` — Devin session active
- `devin-autofix/waiting-review` — PR opened, review requested
- `devin-autofix/returned-human` — Devin could not complete the fix
- `devin-autofix/merged` — PR merged
- `devin-autofix/reverted` — Fix was reverted

## Required Secrets

Set these as GitHub Actions secrets:

- `DEVIN_API_KEY` — Devin API key
- `DEVIN_ORG_ID` — Devin organization ID

## Allowlist

Only the user `vickyli1014` can trigger `/devin-fix`. This is enforced in the
workflow YAML.

## Testing

To test the workflow end-to-end:

1. Create a scoped bug issue with clear reproduction steps.
2. Comment `/devin-fix` on the issue.
3. Watch the workflow run in the Actions tab.
4. The monitor workflow will detect PRs and update the issue.
5. Run the report workflow to generate analytics artifacts.
