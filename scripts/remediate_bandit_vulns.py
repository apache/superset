#!/usr/bin/env python3
"""
Vulnerability Remediation Orchestrator

Parses Bandit security scan results, creates GitHub issues,
triggers Devin AI sessions to fix them, and tracks progress.

Usage:
    python scripts/remediate.py \
        --bandit-results bandit_results.json \
        --repo your-username/superset-fork \
        --max-issues 5

Environment variables required:
    GITHUB_TOKEN   - GitHub personal access token with repo scope
    DEVIN_API_KEY  - Devin API key (service user key starting with cog_)
    DEVIN_ORG_ID   - Devin organization ID (find in Settings > Service Users)
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

GITHUB_API = "https://api.github.com"
DEVIN_API = "https://api.devin.ai/v3"

# Only keep findings at or above these thresholds
MIN_SEVERITY = "MEDIUM"   # LOW, MEDIUM, HIGH
MIN_CONFIDENCE = "MEDIUM"  # LOW, MEDIUM, HIGH

SEVERITY_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
CONFIDENCE_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}

# How long to poll Devin before giving up (seconds)
DEVIN_POLL_TIMEOUT = 1800  # 30 minutes
DEVIN_POLL_INTERVAL = 30   # check every 30 seconds

# Labels to apply to created issues
ISSUE_LABELS = ["security", "automated", "bandit"]

# Mapping of Bandit test IDs to human-readable fix guidance
FIX_GUIDANCE = {
    "B101": "Remove assert statements used for security checks; use proper if/raise instead.",
    "B102": "Replace exec() with a safer alternative.",
    "B103": "Set appropriate file permissions using os.chmod() with restrictive mode.",
    "B104": "Bind to a specific interface instead of 0.0.0.0.",
    "B105": "Move hardcoded password to environment variable or secrets manager.",
    "B106": "Move hardcoded password argument to environment variable or secrets manager.",
    "B107": "Move hardcoded password default to environment variable or secrets manager.",
    "B108": "Avoid using /tmp; use tempfile.mkdtemp() or tempfile.NamedTemporaryFile().",
    "B110": "Do not use bare 'except: pass'; handle or log the exception.",
    "B112": "Do not use 'except: continue'; handle or log the exception.",
    "B201": "Avoid flask app running in debug mode in production.",
    "B301": "Use yaml.safe_load() instead of yaml.load().",
    "B302": "Use pickle alternatives or add input validation.",
    "B303": "Replace insecure hash function (md5/sha1) with sha256 or sha512.",
    "B304": "Replace insecure cipher with a modern alternative (e.g. AES-GCM).",
    "B305": "Replace insecure cipher mode with a modern one (e.g. CBC -> GCM).",
    "B306": "Use tempfile.mkdtemp() instead of tempfile.mktemp().",
    "B307": "Replace eval() with ast.literal_eval() or a safer alternative.",
    "B308": "Use markupsafe.Markup instead of django.utils.safestring.mark_safe().",
    "B310": "Validate and sanitize URLs before passing to urllib.urlopen().",
    "B311": "Replace random module with secrets module for security-sensitive values.",
    "B312": "Replace telnetlib with paramiko (SSH) for remote connections.",
    "B320": "Use defusedxml instead of lxml for XML parsing.",
    "B321": "Replace FTP with SFTP/SCP for file transfers.",
    "B323": "Use ssl.create_default_context() instead of unverified SSL contexts.",
    "B324": "Replace insecure hash function with hashlib.sha256() or stronger.",
    "B501": "Do not disable SSL certificate verification (verify=False).",
    "B502": "Do not use SSL/TLS with insecure protocol version.",
    "B503": "Do not use SSL/TLS with insecure default settings.",
    "B506": "Use yaml.safe_load() instead of yaml.unsafe_load().",
    "B507": "Do not disable SSH host key verification.",
    "B601": "Avoid shell=True in subprocess calls; pass args as a list.",
    "B602": "Avoid shell=True in subprocess calls; pass args as a list.",
    "B603": "Validate input before passing to subprocess without shell.",
    "B604": "Avoid shell=True in function calls.",
    "B605": "Avoid os.system(); use subprocess.run() with a list of args.",
    "B606": "Avoid os.popen(); use subprocess.run() instead.",
    "B607": "Use full path for process execution to avoid path injection.",
    "B608": "Use parameterized queries instead of string formatting for SQL.",
    "B609": "Avoid wildcard injection in subprocess calls.",
    "B610": "Use Django ORM methods like .extra() with caution; prefer .annotate().",
    "B611": "Use Django ORM methods like .raw() with parameterized queries.",
    "B612": "Avoid logging sensitive data.",
    "B701": "Use jinja2.select_autoescape() or autoescape=True in Jinja2 templates.",
    "B702": "Use markupsafe.Markup() or Jinja2 autoescaping instead of mako templates.",
    "B703": "Ensure Django templates autoescape user input.",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg: str):
    """Print a timestamped log message."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"[{ts}] {msg}")


def github_headers() -> dict:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        sys.exit("ERROR: GITHUB_TOKEN environment variable is not set.")
    return {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }


def devin_headers() -> dict:
    key = os.environ.get("DEVIN_API_KEY")
    if not key:
        sys.exit("ERROR: DEVIN_API_KEY environment variable is not set.")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def devin_org_url() -> str:
    """Return the base URL for Devin org-scoped endpoints."""
    org_id = os.environ.get("DEVIN_ORG_ID")
    if not org_id:
        sys.exit("ERROR: DEVIN_ORG_ID environment variable is not set.")
    return f"{DEVIN_API}/organizations/{org_id}"


# ---------------------------------------------------------------------------
# Step A: Parse and filter Bandit results
# ---------------------------------------------------------------------------

def parse_bandit_results(filepath: str, max_issues: int) -> list[dict]:
    """
    Read bandit JSON output, filter by severity/confidence,
    deduplicate by (test_id, filename), and return top N findings.
    """
    log(f"Reading Bandit results from {filepath}")

    with open(filepath) as f:
        data = json.load(f)

    results = data.get("results", [])
    log(f"Total raw findings: {len(results)}")

    # Filter by severity and confidence thresholds
    filtered = []
    for r in results:
        sev = r.get("issue_severity", "LOW")
        conf = r.get("issue_confidence", "LOW")
        if (SEVERITY_RANK.get(sev, 0) >= SEVERITY_RANK[MIN_SEVERITY] and
                CONFIDENCE_RANK.get(conf, 0) >= CONFIDENCE_RANK[MIN_CONFIDENCE]):
            filtered.append(r)

    log(f"After filtering (>= {MIN_SEVERITY} severity, >= {MIN_CONFIDENCE} confidence): {len(filtered)}")

    # Deduplicate: keep one finding per (test_id, filename) combo
    # This prevents creating 10 issues for the same test_id in the same file
    seen = set()
    deduped = []
    for r in filtered:
        key = (r.get("test_id"), r.get("filename"))
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    log(f"After deduplication: {len(deduped)}")

    # Sort by severity (HIGH first), then confidence (HIGH first)
    deduped.sort(
        key=lambda r: (
            SEVERITY_RANK.get(r.get("issue_severity", "LOW"), 0),
            CONFIDENCE_RANK.get(r.get("issue_confidence", "LOW"), 0),
        ),
        reverse=True,
    )

    selected = deduped[:max_issues]
    log(f"Selected top {len(selected)} findings for remediation")

    for i, r in enumerate(selected, 1):
        log(f"  {i}. [{r['test_id']}] {r['issue_severity']}/{r['issue_confidence']} "
            f"- {r['filename']}:{r['line_number']}")

    return selected


# ---------------------------------------------------------------------------
# Step B: Create GitHub issues
# ---------------------------------------------------------------------------

def build_issue_body(finding: dict, repo: str) -> str:
    """Build a structured GitHub issue body from a Bandit finding."""
    test_id = finding.get("test_id", "unknown")
    test_name = finding.get("test_name", "unknown")
    severity = finding.get("issue_severity", "UNKNOWN")
    confidence = finding.get("issue_confidence", "UNKNOWN")
    filename = finding.get("filename", "unknown")
    line_number = finding.get("line_number", 0)
    issue_text = finding.get("issue_text", "No description available.")
    code_snippet = finding.get("code", "")
    cwe = finding.get("issue_cwe", {})
    cwe_id = cwe.get("id", "N/A")
    cwe_link = cwe.get("link", "")

    # Get fix guidance from our mapping, or fall back to generic advice
    guidance = FIX_GUIDANCE.get(test_id, "Review the flagged code and apply a secure alternative.")

    body = f"""## Security Finding: {test_id} ({test_name})

**Severity:** {severity} | **Confidence:** {confidence}
**CWE:** CWE-{cwe_id} ({cwe_link})
**Scanner:** Bandit (Python static analysis)

---

### Description

{issue_text}

### Location

- **File:** `{filename}`
- **Line:** {line_number}

### Code Context

```python
{code_snippet.strip()}
```

### Recommended Fix

{guidance}

### Verification

After fixing, run:

```bash
bandit -t {test_id} {filename}
```

Confirm that the {test_id} finding no longer appears for this file.

### Labels

`{severity.lower()}-severity` `{confidence.lower()}-confidence` `{test_id}`
"""
    return body


def create_github_issue(finding: dict, repo: str) -> dict | None:
    """Create a GitHub issue for a single Bandit finding. Returns issue data or None."""
    test_id = finding.get("test_id", "unknown")
    test_name = finding.get("test_name", "unknown")
    filename = finding.get("filename", "unknown")
    # Make filename relative (strip leading repo clone path if present)
    short_filename = filename.split("/superset/", 1)[-1] if "/superset/" in filename else filename

    title = f"[Security] {test_id}: {finding.get('issue_text', 'Security finding').strip().rstrip('.')} in {short_filename}"
    # Truncate title if too long
    if len(title) > 150:
        title = title[:147] + "..."

    body = build_issue_body(finding, repo)

    log(f"Creating issue: {title[:80]}...")

    resp = requests.post(
        f"{GITHUB_API}/repos/{repo}/issues",
        headers=github_headers(),
        json={
            "title": title,
            "body": body,
            "labels": ISSUE_LABELS,
        },
    )

    if resp.status_code == 201:
        issue_data = resp.json()
        log(f"  ✓ Created issue #{issue_data['number']}: {issue_data['html_url']}")
        return issue_data
    else:
        log(f"  ✗ Failed to create issue: {resp.status_code} - {resp.text[:200]}")
        return None


def create_all_issues(findings: list[dict], repo: str) -> list[dict]:
    """Create GitHub issues for all findings. Returns list of (finding, issue) pairs."""
    issue_pairs = []
    for finding in findings:
        issue = create_github_issue(finding, repo)
        if issue:
            issue_pairs.append({"finding": finding, "issue": issue})
        # Small delay to avoid hitting rate limits
        time.sleep(1)

    log(f"Created {len(issue_pairs)} / {len(findings)} issues successfully")
    return issue_pairs


# ---------------------------------------------------------------------------
# Step C: Create Devin sessions
# ---------------------------------------------------------------------------

def create_devin_session(issue_data: dict, finding: dict, repo: str) -> dict | None:
    """Create a Devin session to fix a single issue. Returns session data or None."""
    issue_url = issue_data["html_url"]
    issue_number = issue_data["number"]
    test_id = finding.get("test_id", "unknown")
    filename = finding.get("filename", "unknown")

    prompt = f"""Fix the security vulnerability described in this GitHub issue:
{issue_url}

Repository: https://github.com/{repo}

Summary of what to do:
1. Read the issue description — it has the file, line number, and recommended fix.
2. Checkout a new branch named `fix/bandit-{test_id.lower()}-issue-{issue_number}`.
3. Navigate to `{filename}` and fix the security finding ({test_id}).
4. Run `bandit -t {test_id} {filename}` to verify the finding is gone.
5. Commit your changes and open a pull request that references issue #{issue_number}.
   Use "Fixes #{issue_number}" in the PR description.

Important:
- Only fix the specific finding — do not refactor surrounding code.
- Do not suppress the finding with `# nosec` comments.
- Make sure existing tests still pass.
"""

    payload = {
        "prompt": prompt,
        "idempotent": True,
    }

    log(f"Creating Devin session for issue #{issue_number} ({test_id})...")

    resp = requests.post(
        f"{devin_org_url()}/sessions",
        headers=devin_headers(),
        json=payload,
    )

    if resp.status_code == 200:
        session_data = resp.json()
        log(f"  ✓ Session created: {session_data.get('url', 'N/A')}")
        return session_data
    else:
        log(f"  ✗ Failed to create session: {resp.status_code} - {resp.text[:200]}")
        return None


def create_all_sessions(issue_pairs: list[dict], repo: str) -> list[dict]:
    """Create Devin sessions for all issues. Returns enriched list with session data."""
    for pair in issue_pairs:
        session = create_devin_session(
            pair["issue"], pair["finding"], repo
        )
        pair["session"] = session
        # Small delay between session creations
        time.sleep(2)

    created = sum(1 for p in issue_pairs if p.get("session"))
    log(f"Created {created} / {len(issue_pairs)} Devin sessions")
    return issue_pairs


# ---------------------------------------------------------------------------
# Step D: Poll sessions and track results
# ---------------------------------------------------------------------------

def poll_session(session_id: str) -> dict:
    """Get current status of a Devin session."""
    resp = requests.get(
        f"{devin_org_url()}/sessions/{session_id}",
        headers=devin_headers(),
    )
    if resp.status_code == 200:
        return resp.json()
    return {"status": "error", "error": resp.text[:200]}


def poll_all_sessions(issue_pairs: list[dict], timeout: int = DEVIN_POLL_TIMEOUT) -> list[dict]:
    """
    Poll all Devin sessions until they complete or timeout.
    Updates issue_pairs in place with final session status.

    A session is considered done when:
    - It has opened a PR (success, regardless of session status), OR
    - Its status is a terminal state: "exit", "error", "suspended"
    """
    active_sessions = {
        p["session"]["session_id"]: p
        for p in issue_pairs
        if p.get("session")
    }

    if not active_sessions:
        log("No active sessions to poll.")
        return issue_pairs

    log(f"Polling {len(active_sessions)} active sessions (timeout: {timeout}s)...")

    start_time = time.time()

    terminal_statuses = ("exit", "error", "suspended")

    while active_sessions and (time.time() - start_time) < timeout:
        for session_id in list(active_sessions.keys()):
            status = poll_session(session_id)
            status_val = status.get("status", "unknown")

            # Extract PR info from pull_requests array (v3 format)
            pr_url = None
            pull_requests = status.get("pull_requests", [])
            if pull_requests and isinstance(pull_requests, list):
                pr_url = pull_requests[0].get("pr_url")

            # A session is done if it opened a PR or hit a terminal status
            is_done = bool(pr_url) or status_val in terminal_statuses

            if is_done:
                pair = active_sessions.pop(session_id)
                pair["final_status"] = status
                pair["pr_url"] = pr_url

                # Determine result: PR opened = success, regardless of status
                if pr_url:
                    pair["result"] = "success"
                elif status_val == "error":
                    pair["result"] = "error"
                else:
                    pair["result"] = status_val

                issue_num = pair["issue"]["number"]
                log(f"  Session {session_id} (issue #{issue_num}): "
                    f"status={status_val} | result={pair['result']} | PR: {pr_url or 'none'}")

        if active_sessions:
            remaining = len(active_sessions)
            elapsed = int(time.time() - start_time)
            log(f"  ... {remaining} sessions still active ({elapsed}s elapsed)")
            time.sleep(DEVIN_POLL_INTERVAL)

    # Mark any still-active sessions as timed out, but still check for PRs
    for session_id, pair in active_sessions.items():
        # One final check before marking as timeout
        status = poll_session(session_id)
        pull_requests = status.get("pull_requests", [])
        pr_url = pull_requests[0].get("pr_url") if pull_requests else None

        if pr_url:
            pair["result"] = "success"
            pair["pr_url"] = pr_url
            log(f"  Session {session_id} timed out but PR was opened: {pr_url}")
        else:
            pair["result"] = "timeout"
            pair["pr_url"] = None
            log(f"  Session {session_id} timed out with no PR")

        pair["final_status"] = status

    return issue_pairs


# ---------------------------------------------------------------------------
# Reporting / Observability
# ---------------------------------------------------------------------------

def generate_report(issue_pairs: list[dict], repo: str) -> dict:
    """Generate a summary report for observability."""
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repository": repo,
        "summary": {
            "total_findings": len(issue_pairs),
            "issues_created": sum(1 for p in issue_pairs if p.get("issue")),
            "sessions_created": sum(1 for p in issue_pairs if p.get("session")),
            "succeeded": sum(1 for p in issue_pairs if p.get("result") == "success"),
            "failed": sum(1 for p in issue_pairs if p.get("result") in ("blocked", "error")),
            "timed_out": sum(1 for p in issue_pairs if p.get("result") == "timeout"),
            "prs_opened": sum(1 for p in issue_pairs if p.get("pr_url")),
        },
        "findings": [],
    }

    for pair in issue_pairs:
        finding = pair["finding"]
        issue = pair.get("issue", {})
        session = pair.get("session", {})

        report["findings"].append({
            "test_id": finding.get("test_id"),
            "test_name": finding.get("test_name"),
            "severity": finding.get("issue_severity"),
            "confidence": finding.get("issue_confidence"),
            "filename": finding.get("filename"),
            "line_number": finding.get("line_number"),
            "issue_url": issue.get("html_url"),
            "issue_number": issue.get("number"),
            "session_id": session.get("session_id") if session else None,
            "session_url": session.get("url") if session else None,
            "result": pair.get("result", "no_session"),
            "pr_url": pair.get("pr_url"),
        })

    return report


def print_summary(report: dict):
    """Print a human-readable summary."""
    s = report["summary"]
    log("=" * 60)
    log("REMEDIATION SUMMARY")
    log("=" * 60)
    log(f"  Repository:       {report['repository']}")
    log(f"  Total findings:   {s['total_findings']}")
    log(f"  Issues created:   {s['issues_created']}")
    log(f"  Sessions created: {s['sessions_created']}")
    log(f"  Succeeded:        {s['succeeded']}")
    log(f"  Failed:           {s['failed']}")
    log(f"  Timed out:        {s['timed_out']}")
    log(f"  PRs opened:       {s['prs_opened']}")
    log("=" * 60)

    for f in report["findings"]:
        status_icon = {"success": "✓", "blocked": "⚠", "error": "✗", "timeout": "⏱"}.get(f["result"], "?")
        log(f"  {status_icon} [{f['test_id']}] {f['filename']}:{f['line_number']} "
            f"-> issue #{f['issue_number']} | {f['result']}"
            f"{' | PR: ' + f['pr_url'] if f['pr_url'] else ''}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Vulnerability Remediation Orchestrator: Bandit -> GitHub Issues -> Devin AI"
    )
    parser.add_argument(
        "--bandit-results", required=True,
        help="Path to Bandit JSON output file",
    )
    parser.add_argument(
        "--repo", required=True,
        help="GitHub repo in 'owner/name' format (your Superset fork)",
    )
    parser.add_argument(
        "--max-issues", type=int, default=5,
        help="Maximum number of issues to create (default: 5)",
    )
    parser.add_argument(
        "--skip-devin", action="store_true",
        help="Only create GitHub issues, skip Devin sessions (useful for testing)",
    )
    parser.add_argument(
        "--no-poll", action="store_true",
        help="Create sessions but don't wait for them to finish",
    )
    parser.add_argument(
        "--output", default="remediation_log.json",
        help="Path for the output JSON report (default: remediation_log.json)",
    )

    args = parser.parse_args()

    log("Starting Vulnerability Remediation Pipeline")
    log(f"  Repo:         {args.repo}")
    log(f"  Max issues:   {args.max_issues}")
    log(f"  Skip Devin:   {args.skip_devin}")

    # Step A: Parse Bandit results
    findings = parse_bandit_results(args.bandit_results, args.max_issues)

    if not findings:
        log("No findings matched the filter criteria. Exiting.")
        sys.exit(0)

    # Step B: Create GitHub issues
    issue_pairs = create_all_issues(findings, args.repo)

    if not issue_pairs:
        log("No issues were created. Exiting.")
        sys.exit(1)

    # Step C: Create Devin sessions (unless --skip-devin)
    if not args.skip_devin:
        issue_pairs = create_all_sessions(issue_pairs, args.repo)

        # Step D: Poll for results (unless --no-poll)
        if not args.no_poll:
            issue_pairs = poll_all_sessions(issue_pairs)
    else:
        log("Skipping Devin sessions (--skip-devin flag set)")

    # Generate and save report
    report = generate_report(issue_pairs, args.repo)
    print_summary(report)

    with open(args.output, "w") as f:
        json.dump(report, f, indent=2)
    log(f"Full report saved to {args.output}")


if __name__ == "__main__":
    main()