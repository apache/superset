# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Dispatch one Devin fix session per open nightly-scan issue, safely.

Every step is idempotent: a session is looked up by title before it is
created, a dashboard comment is looked up by a hidden marker before it is
posted, and a failure for one issue is recorded and the loop moves on.
"""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from .api import AmbiguousWriteError, ApiError, Devin, GitHub, session_url

log = logging.getLogger("automation.dispatch")

BRANCH_PREFIX = "devin/nightly-fix-"
BRANCH_ISSUE = re.compile(r"devin/nightly-fix-(?:issue-)?(\d+)")
BODY_REF = re.compile(r"\b(?:Fixes|Refs|Closes)\s+#(\d+)", re.I)
DEAD_STATUSES = frozenset({"error", "terminated", "cancelled", "canceled"})
FINISHED_STATUSES = frozenset({"finished", "completed", "blocked", "suspended"})


@dataclass
class Outcome:
    issue: int
    status: str  # dispatched | skipped | failed
    detail: str = ""


def marker(key: str) -> str:
    return f"<!-- devin:{key} -->"


def attempted_issues(
    prs: Iterable[dict[str, Any]], sessions: Iterable[dict[str, Any]]
) -> set[int]:
    """Issue numbers that already have a PR, a fix branch, or a live session."""
    seen: set[int] = set()
    for pr in prs:
        seen.update(int(n) for n in BODY_REF.findall(pr.get("body") or ""))
        if m := BRANCH_ISSUE.search(pr["head"]["ref"]):
            seen.add(int(m.group(1)))
    for s in sessions:
        if str(s.get("status") or s.get("status_enum") or "").lower() in DEAD_STATUSES:
            continue
        if m := re.search(r"#(\d+)", s.get("title") or ""):
            seen.add(int(m.group(1)))
    return seen


def ensure_session(devin: Devin, payload: dict[str, Any], tag: str) -> dict[str, Any]:
    """Create a session unless one with the same title is already alive.

    An ambiguous failure (5xx/timeout on the POST) is resolved by probing
    again, so a request that landed is never duplicated.
    """
    title = payload["title"]
    for attempt in (1, 2):
        for s in devin.list_sessions(tag):
            if (
                s.get("title") == title
                and str(s.get("status") or s.get("status_enum") or "").lower()
                not in DEAD_STATUSES
            ):
                log.info("%s already has session %s", title, session_url(s))
                return s
        try:
            return devin.create_session(payload)
        except AmbiguousWriteError as exc:
            log.warning("%s: %s. Re-probing (attempt %d/2)", title, exc, attempt)
            time.sleep(devin.policy.initial)
    raise ApiError(f"{title}: session creation ambiguous after re-probe")


def ensure_comment(gh: GitHub, issue: int, key: str, body: str) -> dict[str, Any]:
    """Post ``body`` on ``issue`` once per ``key``; update it if it exists."""
    text = f"{body}\n\n{marker(key)}"
    for c in gh.comments(issue):
        if marker(key) in (c.get("body") or ""):
            return gh.update_comment(int(c["id"]), text) if c["body"] != text else c
    try:
        return gh.create_comment(issue, text)
    except AmbiguousWriteError:
        for c in gh.comments(issue):
            if marker(key) in (c.get("body") or ""):
                return c
        raise


def watch_session(
    devin: Devin,
    session_id: str,
    *,
    timeout: timedelta,
    poll: float = 60.0,
    sleep: Callable[[float], None] = time.sleep,
) -> tuple[bool, str]:
    """Poll a session until it finishes, with an orchestrator-side circuit breaker.

    Success requires *both* a finished status and a pull request on the
    session; a "completed" session with no pull request is a failure. The v3
    API exposes ``pull_requests: [{pr_url, pr_state}]`` (older payloads used a
    single ``pull_request`` object); both shapes are accepted.
    """
    deadline = time.monotonic() + timeout.total_seconds()
    attempt = 0
    while True:
        attempt += 1
        s = devin.get_session(session_id)
        status = str(s.get("status") or s.get("status_enum") or "").lower()
        pr = session_pr(s)
        log.info(
            "[Session %s] poll %d: status=%s pr=%s",
            session_id,
            attempt,
            status,
            bool(pr),
        )
        if pr:
            return True, pr
        if status in DEAD_STATUSES:
            return False, f"session {status}"
        if status in FINISHED_STATUSES:
            return False, f"session {status} but pull_request is null"
        if time.monotonic() >= deadline:
            return False, f"timeout reached after {timeout} (last status: {status})"
        sleep(poll)


def session_pr(session: dict[str, Any]) -> str | None:
    """URL of the session's pull request, or None when it has not opened one."""
    prs = list(session.get("pull_requests") or [])
    if session.get("pull_request"):
        prs.append(session["pull_request"])
    for pr in prs:
        if url := pr.get("pr_url") or pr.get("url"):
            return str(url)
    return None


def branch_for_issue(gh: GitHub, issue: int) -> str | None:
    for b in gh.paginate("branches"):
        if (m := BRANCH_ISSUE.match(b["name"])) and int(m.group(1)) == issue:
            return str(b["name"])
    return None


def cleanup_branch(gh: GitHub, issue: int, dry_run: bool = False) -> str | None:
    """Delete the fix branch for ``issue`` unless a PR (any state) uses it."""
    branch = branch_for_issue(gh, issue)
    if not branch:
        return None
    if any(pr["head"]["ref"] == branch for pr in gh.pulls("all")):
        log.info("[Issue #%d] keeping %s: referenced by a PR", issue, branch)
        return None
    if not dry_run:
        gh.delete_branch(branch)
    log.info("[Issue #%d] deleted orphaned branch %s", issue, branch)
    return branch


def stale_branches(
    gh: GitHub, older_than: timedelta, *, delete: bool = False
) -> list[tuple[str, str]]:
    """Fix branches with no open/merged PR and a last commit older than the cutoff."""
    prs: dict[str, str] = {}
    for pr in gh.pulls("all"):
        state = "MERGED" if pr.get("merged_at") else str(pr["state"]).upper()
        prs[pr["head"]["ref"]] = (
            state if prs.get(pr["head"]["ref"]) != "OPEN" else "OPEN"
        )
    cutoff = datetime.now(timezone.utc) - older_than
    result: list[tuple[str, str]] = []
    for b in gh.paginate("branches"):
        name = str(b["name"])
        if not name.startswith(BRANCH_PREFIX) or prs.get(name) in {"OPEN", "MERGED"}:
            continue
        committed = datetime.fromisoformat(
            gh.branch_commit_date(name).replace("Z", "+00:00")
        )
        if committed > cutoff:
            continue
        reason = "pr-closed-unmerged" if name in prs else "no-pr"
        if delete:
            gh.delete_branch(name)
        log.info(
            "stale branch %s (%s, last commit %s)%s",
            name,
            reason,
            committed.date(),
            " deleted" if delete else "",
        )
        result.append((name, reason))
    return result


def dispatch(
    gh: GitHub,
    devin: Devin,
    *,
    fix_prompt: str,
    label: str = "nightly-scan",
    tag: str = "auto-fix",
    cap: int = 30,
    max_acu: int = 150,
    dry_run: bool = False,
) -> list[Outcome]:
    """Select eligible issues (newest first, up to ``cap``) and dispatch them."""
    issues = sorted(gh.open_issues(label), key=lambda i: -int(i["number"]))
    prs = gh.pulls("all")
    done = attempted_issues(prs, devin.list_sessions(tag))
    outcomes: list[Outcome] = []
    dispatched = 0
    for issue in issues:
        n = int(issue["number"])
        if n in done:
            outcomes.append(Outcome(n, "skipped", "attempt exists"))
            continue
        if dispatched >= cap:
            outcomes.append(Outcome(n, "skipped", "cap reached, next sweep"))
            continue
        category = next(
            (
                lbl["name"]
                for lbl in issue.get("labels", [])
                if lbl["name"] not in {label, "security", "dependencies"}
            ),
            "unknown",
        )
        related = sorted(
            int(pr["number"])
            for pr in prs
            if pr["state"] == "open" and category in pr["head"]["ref"]
        )
        scope = (
            f"\n\nOpen PRs for this category: {related}. "
            "Extend or supersede them; one PR per issue."
            if related
            else ""
        )
        event = (
            f"#{n} {issue['title']}\n{issue['html_url']}\n\n{issue.get('body') or ''}"
        )
        payload = {
            "prompt": f"{fix_prompt}\n\n---\n{event}{scope}",
            "title": f"Fix {category} issue #{n}",
            "tags": [label, "superset", tag],
            "max_acu_limit": max_acu,
        }
        try:
            if dry_run:
                outcomes.append(Outcome(n, "dispatched", "dry-run"))
            else:
                s = ensure_session(devin, payload, tag)
                url = session_url(s)
                ensure_comment(gh, n, f"dispatch:{n}", f"Fix session dispatched: {url}")
                outcomes.append(Outcome(n, "dispatched", url))
            dispatched += 1
        except ApiError as exc:  # keep going with the next issue
            log.error("[Issue #%d] dispatch failed: %s", n, exc)
            outcomes.append(Outcome(n, "failed", str(exc)[:200]))
    return outcomes


def dashboard_table(outcomes: Iterable[Outcome]) -> str:
    icon = {"dispatched": "✅", "skipped": "⏭️", "failed": "❌"}
    rows = "\n".join(
        f"| #{o.issue} | {icon[o.status]} {o.status} | {o.detail} |" for o in outcomes
    )
    return f"| Issue | Outcome | Detail |\n|---|---|---|\n{rows}"
