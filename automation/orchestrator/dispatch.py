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

import functools
import logging
import random
import re
import time
import uuid
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from .api import (
    AmbiguousWriteError,
    ApiError,
    Devin,
    GitHub,
    PullRequest,
    Session,
    session_url,
)

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
    prs: Iterable[dict[str, Any] | PullRequest],
    sessions: Iterable[dict[str, Any] | Session],
) -> set[int]:
    """Issue numbers that already have a PR, a fix branch, or a session that owns them.

    A session owns its issue while it is still running or once it has opened
    a PR (see :meth:`Session.owns_issue`); failed attempts are ignored so the
    issue is dispatched again on the next sweep.
    """
    seen: set[int] = set()
    for pr in prs:
        if isinstance(pr, PullRequest):
            body, ref = pr.body, pr.head.get("ref", "")
        else:
            body, ref = str(pr.get("body") or ""), str(pr["head"]["ref"])
        seen.update(int(n) for n in BODY_REF.findall(body))
        if m := BRANCH_ISSUE.search(ref):
            seen.add(int(m.group(1)))
    for s in sessions:
        if isinstance(s, Session):
            session = s
        else:
            session = Session.from_dict(s)
        if not session.owns_issue():
            continue
        if m := re.search(r"#(\d+)", session.title):
            seen.add(int(m.group(1)))
    return seen


CLAIM_TTL = timedelta(minutes=30)


def claim_ref(issue: int) -> str:
    return f"devin/claims/issue-{issue}"


RELEASE_MESSAGE = "devin-release"


def _claim_message(owner: str) -> str:
    return f"devin-claim {owner}"


def _commit_date(commit: dict[str, Any]) -> datetime:
    raw = str(commit["committer"]["date"]).replace("Z", "+00:00")
    return datetime.fromisoformat(raw)


class ClaimLostError(ApiError):
    """The dispatch lock was taken over by another dispatcher mid-flight."""


def claim_issue(
    gh: GitHub, issue: int, owner: str, ttl: timedelta = CLAIM_TTL
) -> str | None:
    """Take the per-issue dispatch lock; return the claim's commit sha, or ``None``.

    The Devin API has no idempotency key, so the list-then-create in
    :func:`ensure_session` is not atomic across dispatchers. The lock is the
    git ref ``refs/devin/claims/issue-N``; the commit it points at is the
    lock's state, and the ref only ever moves forward along one chain:

    * a *claim* commit (message ``devin-claim <owner>``, committer date =
      claim time) means held; the sha is the holder's ownership token;
    * a *release* commit (:data:`RELEASE_MESSAGE`) means free.

    Every transition is atomic on GitHub: the first claim is a ref create
    (422 if it exists); every later one is a non-force update to a child
    commit of the state being replaced, which GitHub accepts only as a
    fast-forward -- i.e. only if that state is still current. A holder that
    outlived ``ttl`` therefore cannot release or steal a successor's claim,
    and :func:`holds_claim` re-reads the token right before the session
    POST. An ambiguous write is resolved by reading the ref back.
    """
    ref = claim_ref(issue)
    base = gh.default_branch_commit()
    tree = str(base["commit"]["tree"]["sha"])
    mine = str(gh.create_commit(_claim_message(owner), tree, [])["sha"])
    try:
        if gh.create_ref(ref, mine):
            return mine
    except AmbiguousWriteError as exc:
        log.warning("[Issue #%d] claim ambiguous: %s. Probing", issue, exc)
    current = gh.get_ref(ref)
    if current is None:
        return None
    if str(current["object"]["sha"]) == mine:
        return mine
    held = gh.get_commit(str(current["object"]["sha"]))
    if str(held.get("message", "")) == RELEASE_MESSAGE:
        pass
    elif datetime.now(timezone.utc) - _commit_date(held) < ttl:
        return None
    else:
        log.warning("[Issue #%d] reaping stale claim %s", issue, held["sha"])
    takeover = str(
        gh.create_commit(_claim_message(owner), tree, [str(held["sha"])])["sha"]
    )
    return takeover if _advance(gh, issue, takeover) else None


def _advance(gh: GitHub, issue: int, sha: str) -> bool:
    """Fast-forward the claim ref to ``sha``; ``False`` if someone moved it first."""
    try:
        return gh.fast_forward_ref(claim_ref(issue), sha)
    except AmbiguousWriteError:
        return holds_claim(gh, issue, sha)


def holds_claim(gh: GitHub, issue: int, token: str) -> bool:
    current = gh.get_ref(claim_ref(issue))
    return current is not None and str(current["object"]["sha"]) == token


def release_issue(gh: GitHub, issue: int, token: str) -> None:
    """Mark the claim free, unless another dispatcher already took it over.

    The release commit is a child of ``token``, so the fast-forward only
    lands while the ref still points at our claim: there is no window in
    which an expired holder can clobber a successor.
    """
    tree = str(gh.get_commit(token)["tree"]["sha"])
    release = str(gh.create_commit(RELEASE_MESSAGE, tree, [token])["sha"])
    if not _advance(gh, issue, release):
        log.info("[Issue #%d] claim already taken over; not released", issue)


def ensure_session(
    devin: Devin,
    payload: dict[str, Any],
    tag: str,
    guard: Callable[[], bool] | None = None,
) -> dict[str, Any]:
    """Create a session unless one with the same title still owns the issue.

    An ambiguous failure (5xx/timeout on the POST) is resolved by probing
    again, so a request that landed is never duplicated. ``guard`` is
    consulted immediately before the POST; if it reports the caller no
    longer holds the dispatch lock, :class:`ClaimLostError` is raised.
    """
    title = payload["title"]
    for attempt in (1, 2):
        for s in devin.list_sessions(tag):
            session = Session.from_dict(s) if isinstance(s, dict) else s
            if session.title == title and session.owns_issue():
                log.info("%s already has session %s", title, session_url(s))
                return s
        if guard is not None and not guard():
            raise ClaimLostError(f"{title}: dispatch claim lost before creation")
        try:
            return devin.create_session(payload)
        except AmbiguousWriteError as exc:
            log.warning("%s: %s. Re-probing (attempt %d/2)", title, exc, attempt)
            time.sleep(devin.policy.initial)
    for s in devin.list_sessions(tag):
        session = Session.from_dict(s) if isinstance(s, dict) else s
        if session.title == title and session.owns_issue():
            return s
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
        # Bound this poll's retry budget so API outages cannot overrun the
        # watcher deadline; a poll that starts at the deadline still runs once.
        remaining = max(deadline - time.monotonic(), 0.0)
        s = devin.get_session(session_id, budget_seconds=remaining)
        # Handle both dict and Session objects
        if isinstance(s, dict):
            session = Session.from_dict(s)
        else:
            session = s
        pr = session.get_pr_url()
        log.info(
            "[Session %s] poll %d: status=%s pr=%s",
            session_id,
            attempt,
            session.status,
            bool(pr),
        )
        if pr:
            return True, pr
        if session.is_dead():
            return False, f"session {session.status}"
        if session.is_finished():
            return False, f"session {session.status} but pull_request is null"
        if time.monotonic() >= deadline:
            return (
                False,
                f"timeout reached after {timeout} (last status: {session.status})",
            )
        # Add jitter to polling to avoid thundering herd
        jittered_poll = poll * (0.5 + random.random() * 0.5)  # noqa: S311
        sleep(min(jittered_poll, max(deadline - time.monotonic(), 0.0)))


def branch_for_issue(gh: GitHub, issue: int) -> str | None:
    for b in gh.paginate("branches"):
        if (m := BRANCH_ISSUE.match(b["name"])) and int(m.group(1)) == issue:
            return str(b["name"])
    return None


def cleanup_branch(
    gh: GitHub, issue: int, dry_run: bool = False, force: bool = False
) -> str | None:
    """Delete the fix branch for ``issue`` unless a PR (any state) uses it.

    Args:
        gh: GitHub client
        issue: Issue number
        dry_run: If True, only log what would be deleted
        force: If True, skip safety checks and delete

    Returns:
        Branch name if deleted (or would be deleted in dry-run), None if not deleted
    """
    branch = branch_for_issue(gh, issue)
    if not branch:
        return None
    if any(pr["head"]["ref"] == branch for pr in gh.pulls("all")):
        log.info("[Issue #%d] keeping %s: referenced by a PR", issue, branch)
        return None
    if dry_run:
        log.info("[Issue #%d] would delete orphaned branch %s (dry-run)", issue, branch)
        return branch
    if not force:
        log.warning(
            "[Issue #%d] branch %s requires --force to delete (safety check)",
            issue,
            branch,
        )
        return None
    gh.delete_branch(branch)
    log.info("[Issue #%d] deleted orphaned branch %s", issue, branch)
    return branch


_PR_STATE_RANK: dict[str, int] = {"": 0, "CLOSED": 1, "MERGED": 2, "OPEN": 3}


def stale_branches(
    gh: GitHub, older_than: timedelta, *, delete: bool = False, force: bool = False
) -> list[tuple[str, str]]:
    """Fix branches with no open/merged PR and a last commit older than the cutoff.

    Args:
        gh: GitHub client
        older_than: Age threshold for stale branches
        delete: If True, actually delete branches (dry-run otherwise)
        force: If True, skip safety checks when deleting

    Returns:
        List of (branch_name, reason) tuples for branches that were or would be deleted
    """
    prs: dict[str, str] = {}
    for pr in gh.pulls("all"):
        state = "MERGED" if pr.get("merged_at") else str(pr["state"]).upper()
        ref = str(pr["head"]["ref"])
        # A branch is protected by its strongest PR: OPEN beats MERGED beats CLOSED.
        prs[ref] = max(prs.get(ref, ""), state, key=lambda x: _PR_STATE_RANK.get(x, 0))
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
        if delete and force:
            gh.delete_branch(name)
            log.info(
                "stale branch %s (%s, last commit %s) deleted",
                name,
                reason,
                committed.date(),
            )
        else:
            log.info(
                "stale branch %s (%s, last commit %s)%s",
                name,
                reason,
                committed.date(),
                " would delete" if delete else " (dry-run)",
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
    owner = uuid.uuid4().hex
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
                dispatched += 1
            elif (token := claim_issue(gh, n, owner)) is None:
                outcomes.append(Outcome(n, "skipped", "claimed by another dispatcher"))
                continue
            else:
                try:
                    s = ensure_session(
                        devin,
                        payload,
                        tag,
                        functools.partial(holds_claim, gh, n, token),
                    )
                except ClaimLostError as exc:
                    log.warning("[Issue #%d] %s", n, exc)
                    outcomes.append(Outcome(n, "skipped", "claim lost mid-dispatch"))
                    continue
                finally:
                    release_issue(gh, n, token)
                url = session_url(s)
                ensure_comment(gh, n, f"dispatch:{n}", f"Fix session dispatched: {url}")
                dispatched += 1
                outcomes.append(Outcome(n, "dispatched", url))
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
