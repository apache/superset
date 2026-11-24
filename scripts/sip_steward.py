#!/usr/bin/env python3
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""
Keep SIP (Superset Improvement Proposal) issues in step with the dev@ list.

Run daily by ``.github/workflows/sip-steward.yml``. Each run:

1. Numbers open issues titled ``[SIP] ...`` with the next free SIP number,
   and adds the ``sip`` label to any open SIP-titled issue missing it.
2. Reads ``[DISCUSS]``, ``[VOTE]`` and ``[RESULT][VOTE]`` threads from the
   dev@ archive (lists.apache.org), matches each one to its SIP issue, and
   moves the issue forward through the stage labels ``sip:in-discussion``,
   ``sip:voting`` and ``sip:approved``. Stages only ever move forward. An
   approved SIP is closed with a congratulatory comment.
3. Labels approved SIPs that a pull request references with
   ``sip:in-development``.
4. Writes a report of everything it did (or would do, in dry-run mode) and of
   everything that needs a human: duplicate numbers, threads it could not
   match confidently, failed votes, and project board moves (the workflow
   token cannot edit the org-level project board, so cards are moved by
   hand using the stage labels).

Matching a thread to an issue is deterministic where possible: a link to the
issue in the email, or the SIP number in the subject together with a similar
title. Only threads with a single weak signal go to a language model (Apache
LLMAO), whose answer is used only when it is confident and the evidence it
quotes appears verbatim in the email. Anything uncertain is reported, never
acted on.

Environment:
  GITHUB_TOKEN        token with issues:write (read-only is enough in dry-run)
  GITHUB_REPOSITORY   owner/repo (default apache/superset)
  SIP_STEWARD_LIVE    "true" to make changes; anything else is a dry run
  LLMAO_KEY           Apache LLMAO key; without it, ambiguous cases are skipped
  LLMAO_MODEL         model name (default gemma4-26b)
  GITHUB_STEP_SUMMARY when set, the report is appended to it
"""

from __future__ import annotations

import json  # noqa: TID251 - standalone script, stdlib only
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable, Optional

GITHUB_API = "https://api.github.com"
PONYMAIL_API = "https://lists.apache.org/api"
LIST_NAME = "dev"
LIST_DOMAIN = "superset.apache.org"
LLMAO_URL = "https://llm.apache.org"
DEFAULT_MODEL = "gemma4-26b"
BOARD_URL = "https://github.com/orgs/apache/projects/170"
SIP0_URL = "https://github.com/apache/superset/issues/5602"
COMMENTS_PATH = (
    Path(__file__).resolve().parents[1] / ".github" / "sip-steward" / ("comments.md")
)

#: How far back to read the dev@ archive.
ARCHIVE_MONTHS = 24
#: A stage change triggered by an email older than this is labeled silently;
#: commenting on long-settled threads would only add noise on the first run.
COMMENT_WINDOW_DAYS = 14
#: Title similarity that, together with a matching SIP number, is a match.
STRONG_SIMILARITY = 0.5
#: Minimum similarity for an issue to be offered to the model as a candidate.
CANDIDATE_SIMILARITY = 0.3

SIP_LABEL = "sip"
MAX_NUMBER_GAP = 1000
STAGES = ["in-discussion", "voting", "approved"]
STAGE_LABELS = {stage: f"sip:{stage}" for stage in STAGES}
DEV_LABEL = "sip:in-development"
LABEL_COLORS = {
    "sip:in-discussion": ("fbca04", "SIP has a [DISCUSS] thread on dev@"),
    "sip:voting": ("d93f0b", "SIP has a [VOTE] thread on dev@"),
    "sip:approved": ("0e8a16", "SIP vote passed on dev@"),
    "sip:in-development": ("1d76db", "Approved SIP with pull requests in flight"),
}
BOARD_COLUMNS = {
    "numbered": "Pre-discussion",
    "in-discussion": "[DISCUSS] Thread opened",
    "voting": "[VOTE] Thread opened",
    "approved": "[RESULT][VOTE] Approved",
    "in-development": "In Development",
}
COMMENT_MARKER = "<!-- sip-steward:stage={stage} -->"

TITLE_RE = re.compile(
    r"^\s*\[\s*SIP(?:[-\s]*(?P<num>\d+)(?P<suffix>v\d+)?|[-\s]*[X#?]+)?\s*\]\s*",
    re.IGNORECASE,
)
SUBJECT_SIP_RE = re.compile(r"\bSIP[-\s]?(\d+)(v\d+)?\b", re.IGNORECASE)
REPLY_RE = re.compile(r"^\s*(re|aw|fwd?|sv)\s*:", re.IGNORECASE)
ISSUE_URL_RE = re.compile(
    r"github\.com/apache/(?:incubator-)?superset/issues/(\d+)", re.IGNORECASE
)
THREAD_URL_RE = re.compile(
    r"lists\.apache\.org/thread(?:\.html)?/([a-z0-9]{20,})", re.IGNORECASE
)
PASSED_RE = re.compile(
    r"\b(?:passed|passes|is (?:officially )?(?:accepted|approved))\b", re.IGNORECASE
)
FAILED_RE = re.compile(
    r"\b(?:failed|fails|did not pass|does not pass|has not passed|not passed|"
    r"is rejected|has been rejected)\b",
    re.IGNORECASE,
)
STOPWORDS = {
    "a", "an", "and", "the", "for", "to", "of", "in", "on", "with", "by", "from",
    "into", "as", "at", "or", "proposal", "sip", "superset", "add", "adding",
    "support", "new", "discuss", "vote", "result", "re", "via", "be", "is",
}  # fmt: skip


# --------------------------------------------------------------------------
# Data model
# --------------------------------------------------------------------------


@dataclass
class Issue:
    number: int
    title: str
    state: str
    labels: set[str]
    body: str
    created_at: str
    html_url: str

    @property
    def is_open(self) -> bool:
        return self.state.lower() == "open"


@dataclass
class Email:
    id: str
    subject: str
    epoch: int
    body: str = ""

    @property
    def url(self) -> str:
        return f"https://lists.apache.org/thread/{self.id}"


@dataclass
class Match:
    issue: Optional[int]
    how: str  # "issue link", "number+title", "model", or a reason it failed
    candidates: list[int] = field(default_factory=list)


@dataclass
class Report:
    live: bool
    actions: list[str] = field(default_factory=list)
    board_moves: list[str] = field(default_factory=list)
    attention: list[str] = field(default_factory=list)
    matched: list[str] = field(default_factory=list)

    def render(self) -> str:
        mode = "LIVE" if self.live else "DRY RUN (no changes made)"
        verb = "Actions taken" if self.live else "Actions that would be taken"
        out = [f"# SIP steward report: {mode}", ""]
        for heading, items in (
            (verb, self.actions),
            ("Project board moves to make by hand", self.board_moves),
            ("Needs a human", self.attention),
            ("Thread matches", self.matched),
        ):
            out.append(f"## {heading}")
            out.extend([f"- {item}" for item in items] or ["- none"])
            out.append("")
        return "\n".join(out)


# --------------------------------------------------------------------------
# Pure helpers (unit tested)
# --------------------------------------------------------------------------


def parse_title(title: str) -> tuple[bool, Optional[str]]:
    """Return (is_sip_title, number key such as "180" or "116v2", or None)."""
    match = TITLE_RE.match(title)
    if not match:
        return False, None
    if match.group("num"):
        return True, f"{int(match.group('num'))}{(match.group('suffix') or '').lower()}"
    return True, None


def strip_title(title: str) -> str:
    """Drop the ``[SIP-N]`` prefix and any leading "Proposal for"."""
    title = TITLE_RE.sub("", title)
    return re.sub(r"^\s*proposal\s+(?:for|to)\s+", "", title, flags=re.I).strip()


def is_placeholder_title(title: str) -> bool:
    return "your title here" in title.lower()


def numbered_title(title: str, number: int) -> str:
    return f"[SIP-{number}] {TITLE_RE.sub('', title).strip()}"[:256]


def max_sip_number(titles: Iterable[str]) -> int:
    """Highest SIP number in use, ignoring implausible outliers.

    Anyone can open an issue titled ``[SIP-99999]``; a number more than
    ``MAX_NUMBER_GAP`` above the next one down is not used to number new SIPs.
    """
    numbers = []
    for title in titles:
        _, key = parse_title(title)
        if key:
            numbers.append(int(re.match(r"\d+", key).group()))  # type: ignore[union-attr]
    numbers.sort()
    for i in range(1, len(numbers)):
        if numbers[i] - numbers[i - 1] > MAX_NUMBER_GAP:
            return numbers[i - 1]
    return numbers[-1] if numbers else 0


def duplicate_numbers(issues: Iterable[Issue]) -> dict[str, list[int]]:
    """Number keys used by more than one issue, where at least one is open."""
    by_key: dict[str, list[Issue]] = {}
    for issue in issues:
        _, key = parse_title(issue.title)
        if key:
            by_key.setdefault(key, []).append(issue)
    return {
        key: sorted(i.number for i in group)
        for key, group in by_key.items()
        if len(group) > 1 and any(i.is_open for i in group)
    }


def classify_subject(subject: str) -> tuple[Optional[str], bool, Optional[str], str]:
    """Return (kind, is_reply, SIP number key, core title) for an email subject.

    ``kind`` is "RESULT", "VOTE", "DISCUSS" or None.
    """
    is_reply = bool(REPLY_RE.match(subject))
    upper = subject.upper()
    if "[RESULT" in upper or "RESULT]" in upper:
        kind: Optional[str] = "RESULT"
    elif "[VOTE" in upper or "VOTE]" in upper:
        kind = "VOTE"
    elif "[DISCUSS" in upper or "DISCUSS]" in upper:
        kind = "DISCUSS"
    else:
        kind = None
    sip = SUBJECT_SIP_RE.search(subject)
    key = f"{int(sip.group(1))}{(sip.group(2) or '').lower()}" if sip else None
    core = subject
    while REPLY_RE.match(core):
        core = REPLY_RE.sub("", core, count=1)
    core = re.sub(r"\[[^\]]*\]", " ", core)
    core = SUBJECT_SIP_RE.sub(" ", core)
    core = re.sub(r"^[\s:,\-]+", "", core).strip()
    core = re.sub(r"^\s*proposal\s+(?:for|to)\s+", "", core, flags=re.I)
    return kind, is_reply, key, core.strip()


def _tokens(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {w.rstrip("s") for w in words if w not in STOPWORDS and len(w) > 1}


def similarity(a: str, b: str) -> float:
    """Overlap of meaningful words, relative to the shorter title."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / min(len(ta), len(tb))


def normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def evidence_ok(evidence: Any, source: str) -> bool:
    """A model's evidence must be a real quote from the source text."""
    return (
        isinstance(evidence, str)
        and len(evidence.strip()) >= 12
        and normalize_ws(evidence) in normalize_ws(source)
    )


def result_regex(body: str) -> Optional[str]:
    """Return "passed" or "failed" if the result email says so plainly."""
    first_part = "\n".join(
        line for line in body.splitlines() if not line.lstrip().startswith(">")
    )  # ignore quoted text
    failed = FAILED_RE.search(first_part)
    passed = PASSED_RE.search(first_part)
    if passed and not failed:
        return "passed"
    if failed and not passed:
        return "failed"
    return None


def current_stage(labels: set[str]) -> int:
    """Index of the furthest stage label on an issue, or -1."""
    return max(
        (i for i, stage in enumerate(STAGES) if STAGE_LABELS[stage] in labels),
        default=-1,
    )


def parse_comments(text: str) -> dict[str, str]:
    """Split the stock comments file on ``<!-- STAGE name -->`` markers."""
    parts = re.split(r"^<!--\s*STAGE\s+([\w-]+)\s*-->\s*$", text, flags=re.M)
    return {parts[i]: parts[i + 1].strip() for i in range(1, len(parts) - 1, 2)}


def render_comment(template: str, values: dict[str, Optional[str]]) -> str:
    """Fill placeholders; a link whose URL is unknown becomes plain text."""

    def link(match: re.Match[str]) -> str:
        value = values.get(match.group(2))
        return f"[{match.group(1)}]({value})" if value else match.group(1)

    text = re.sub(r"\[([^\]]+)\]\(\{(\w+)\}\)", link, template)
    return re.sub(
        r"\{(\w+)\}", lambda m: str(values.get(m.group(1)) or m.group(0)), text
    )


def match_email(
    email: Email,
    issues: dict[int, Issue],
    ask_model: Optional[Callable[[Email, list[Issue]], Optional[int]]],
) -> Match:
    """Find the SIP issue a DISCUSS/VOTE/RESULT email is about."""
    _, _, key, core = classify_subject(email.subject)
    linked = sorted({int(n) for n in ISSUE_URL_RE.findall(email.body)} & set(issues))
    by_number = [n for n, i in issues.items() if key and parse_title(i.title)[1] == key]
    sims = {n: similarity(core, strip_title(i.title)) for n, i in issues.items()}

    def via_model(candidates: list[int], reason: str) -> Match:
        candidates = sorted(set(candidates))
        if not ask_model:
            return Match(None, f"{reason}; no model configured", candidates)
        chosen = ask_model(email, [issues[n] for n in candidates])
        if chosen in candidates:
            return Match(chosen, "model", candidates)
        return Match(None, f"{reason}; model not confident", candidates)

    if len(linked) == 1:
        target = linked[0]
        conflicting = [
            n for n in by_number if n != target and sims[n] >= STRONG_SIMILARITY
        ]
        target_strong = target in by_number and sims[target] >= STRONG_SIMILARITY
        if conflicting and not target_strong:
            return via_model([target, *conflicting], "issue link and subject disagree")
        return Match(target, "issue link", [target])
    if len(linked) > 1:
        strong_linked = [
            n for n in linked if n in by_number and sims[n] >= STRONG_SIMILARITY
        ]
        if len(strong_linked) == 1:
            return Match(strong_linked[0], "issue link+number+title", strong_linked)
        return via_model(linked, "links to several SIP issues")

    strong = [n for n in by_number if sims[n] >= STRONG_SIMILARITY]
    if len(strong) == 1:
        return Match(strong[0], "number+title", strong)

    similar = sorted(
        (n for n, s in sims.items() if s >= CANDIDATE_SIMILARITY),
        key=lambda n: -sims[n],
    )[:3]
    candidates = sorted(set(by_number) | set(similar))
    if not candidates:
        return Match(None, "no candidate issue", [])
    return via_model(candidates, "only weak signals")


# --------------------------------------------------------------------------
# I/O
# --------------------------------------------------------------------------


def _http(
    method: str,
    url: str,
    headers: dict[str, str],
    data: Optional[dict[str, Any]] = None,
    retries: int = 3,
) -> tuple[Any, dict[str, str]]:
    payload = json.dumps(data).encode() if data is not None else None
    for attempt in range(retries):
        req = urllib.request.Request(  # noqa: S310 - fixed https URLs only
            url, data=payload, method=method, headers=headers
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
                raw = resp.read()
                return (json.loads(raw) if raw else None), dict(resp.headers)
        except urllib.error.HTTPError as ex:
            if ex.code in (502, 503, 504) and attempt < retries - 1:
                time.sleep(2**attempt)
                continue
            raise
        except urllib.error.URLError:
            if attempt < retries - 1:
                time.sleep(2**attempt)
                continue
            raise
    raise RuntimeError("unreachable")


class GitHub:
    def __init__(self, token: str, repo: str) -> None:
        self.repo = repo
        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "superset-sip-steward",
        }
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def call(
        self, method: str, path: str, data: Optional[dict[str, Any]] = None
    ) -> Any:
        url = path if path.startswith("http") else f"{GITHUB_API}{path}"
        return _http(
            method, url, {**self.headers, "Content-Type": "application/json"}, data
        )[0]

    def paginate(self, path: str) -> list[Any]:
        url: Optional[str] = f"{GITHUB_API}{path}"
        out: list[Any] = []
        while url:
            body, headers = _http("GET", url, self.headers)
            out.extend(body["items"] if isinstance(body, dict) else body)
            nxt = re.search(r'<([^>]+)>;\s*rel="next"', headers.get("Link", ""))
            url = nxt.group(1) if nxt else None
        return out

    def search_issues(self, query: str) -> list[dict[str, Any]]:
        q = urllib.parse.quote(f"repo:{self.repo} is:issue {query}")
        return self.paginate(f"/search/issues?q={q}&per_page=100")


def to_issue(raw: dict[str, Any]) -> Issue:
    return Issue(
        number=raw["number"],
        title=raw["title"],
        state=raw["state"],
        labels={label["name"] for label in raw.get("labels", [])},
        body=raw.get("body") or "",
        created_at=raw["created_at"],
        html_url=raw["html_url"],
    )


def fetch_archive() -> list[Email]:
    """Non-reply DISCUSS/VOTE/RESULT emails from dev@ that name or link a SIP."""
    url = (
        f"{PONYMAIL_API}/stats.lua?list={LIST_NAME}&domain={LIST_DOMAIN}"
        f"&d=lte={ARCHIVE_MONTHS}M&q=SIP"
    )
    body, _ = _http("GET", url, {"User-Agent": "superset-sip-steward"})
    candidates = []
    for raw in body.get("emails", []):
        subject = raw.get("subject", "")
        kind, is_reply, _, _ = classify_subject(subject)
        if kind and not is_reply:
            candidates.append(Email(raw["id"], subject, int(raw["epoch"])))
    emails = []
    for email in candidates:
        detail, _ = _http(
            "GET",
            f"{PONYMAIL_API}/email.lua?id={email.id}",
            {"User-Agent": "superset-sip-steward"},
        )
        email.body = (detail or {}).get("body", "") or ""
        # Some SIP threads never say SIP in the subject but link their issue.
        if "SIP" in email.subject.upper() or ISSUE_URL_RE.search(email.body):
            emails.append(email)
    return sorted(emails, key=lambda e: e.epoch)


class Model:
    """Apache LLMAO, through its Anthropic-compatible messages endpoint."""

    def __init__(self, key: str, model: str) -> None:
        self.key = key
        self.model = model

    def ask(self, system: str, prompt: str) -> Optional[dict[str, Any]]:
        try:
            body, _ = _http(
                "POST",
                f"{LLMAO_URL}/v1/messages",
                {
                    "Authorization": f"Bearer {self.key}",
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                    "User-Agent": "superset-sip-steward",
                },
                {
                    "model": self.model,
                    "max_tokens": 400,
                    "temperature": 0,
                    "system": system,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            text = "".join(
                block.get("text", "")
                for block in body.get("content", [])
                if block.get("type") == "text"
            )
            found = re.search(r"\{.*\}", text, re.S)
            return json.loads(found.group()) if found else None
        except Exception as ex:  # noqa: BLE001 - any failure means "not confident"
            print(f"::warning::LLMAO request failed: {ex}", file=sys.stderr)
            return None

    def pick_issue(self, email: Email, candidates: list[Issue]) -> Optional[int]:
        listing = "\n\n".join(
            f"Issue #{i.number}: {i.title}\n{i.body[:600]}" for i in candidates
        )
        answer = self.ask(
            "You match Apache Superset mailing list threads to the GitHub issue "
            "of the Superset Improvement Proposal (SIP) they discuss. SIP numbers "
            "were sometimes reused or changed, so judge by the proposal's "
            "content, not the number alone. Answer with JSON only: "
            '{"issue": <number or null>, "confidence": "high"|"medium"|"low", '
            '"evidence": "<an exact quote from the EMAIL BODY that identifies the '
            'proposal>"}. Use null unless one issue is clearly the same proposal.',
            f"EMAIL SUBJECT: {email.subject}\n\nEMAIL BODY:\n{email.body[:3000]}"
            f"\n\nCANDIDATE ISSUES:\n{listing}",
        )
        if not answer or answer.get("confidence") != "high":
            return None
        if not evidence_ok(answer.get("evidence"), email.body):
            return None
        number = answer.get("issue")
        return number if isinstance(number, int) else None

    def vote_outcome(self, email: Email) -> Optional[str]:
        answer = self.ask(
            "You read the result email of an Apache project vote. Answer with "
            'JSON only: {"outcome": "passed"|"failed"|"unclear", "evidence": '
            '"<an exact quote from the email stating the outcome>"}.',
            f"SUBJECT: {email.subject}\n\nBODY:\n{email.body[:3000]}",
        )
        if not answer or not evidence_ok(answer.get("evidence"), email.body):
            return None
        outcome = answer.get("outcome")
        return outcome if outcome in ("passed", "failed") else None


# --------------------------------------------------------------------------
# The run
# --------------------------------------------------------------------------


class Steward:
    def __init__(
        self, gh: GitHub, model: Optional[Model], live: bool, comments: dict[str, str]
    ) -> None:
        self.gh = gh
        self.model = model
        self.live = live
        self.comments = comments
        self.report = Report(live=live)
        self.now = time.time()
        # VOTE thread ids that some RESULT email reported as failed.
        self.failed_votes: set[str] = set()

    # -- GitHub writes, all gated on live mode ------------------------------

    def _write(
        self, method: str, path: str, data: Optional[dict[str, Any]] = None
    ) -> None:
        if self.live:
            self.gh.call(method, f"/repos/{self.gh.repo}{path}", data)

    def ensure_labels(self) -> None:
        existing = {
            label["name"]
            for label in self.gh.paginate(f"/repos/{self.gh.repo}/labels?per_page=100")
        }
        for name, (color, description) in LABEL_COLORS.items():
            if name not in existing:
                self.report.actions.append(f"create label `{name}`")
                self._write(
                    "POST", "/labels",
                    {"name": name, "color": color, "description": description},
                )  # fmt: skip

    def has_marker(self, issue: Issue, stage: str) -> bool:
        marker = COMMENT_MARKER.format(stage=stage)
        comments = self.gh.paginate(
            f"/repos/{self.gh.repo}/issues/{issue.number}/comments?per_page=100"
        )
        return any(
            marker in (c.get("body") or "")
            and (c.get("user") or {}).get("login") == "github-actions[bot]"
            for c in comments
        )

    def closed_before(self, issue: Issue) -> bool:
        """Whether the steward already closed this issue as approved once.

        Covers both orders of a close and its comment: the marker comment, or
        a close event by the workflow's bot, means a later reopen is deliberate.
        """
        if self.has_marker(issue, "approved"):
            return True
        events = self.gh.paginate(
            f"/repos/{self.gh.repo}/issues/{issue.number}/events?per_page=100"
        )
        return any(
            e.get("event") == "closed"
            and (e.get("actor") or {}).get("login") == "github-actions[bot]"
            for e in events
        )

    def comment(
        self, issue: Issue, stage: str, values: dict[str, Optional[str]]
    ) -> None:
        template = self.comments.get(stage)
        if not template or self.has_marker(issue, stage):
            return
        body = (
            render_comment(template, values)
            + "\n\n"
            + COMMENT_MARKER.format(stage=stage)
        )
        self.report.actions.append(f"#{issue.number}: post the `{stage}` comment")
        self._write("POST", f"/issues/{issue.number}/comments", {"body": body})

    # -- Steps --------------------------------------------------------------

    def collect_issues(self) -> dict[int, Issue]:
        found: dict[int, Issue] = {}
        for query in (f"label:{SIP_LABEL}", "in:title SIP"):
            for raw in self.gh.search_issues(query):
                if "pull_request" not in raw:
                    found[raw["number"]] = to_issue(raw)
        return {n: i for n, i in found.items() if parse_title(i.title)[0]}

    def number_and_label(self, issues: dict[int, Issue]) -> None:
        next_number = max_sip_number(i.title for i in issues.values()) + 1
        for issue in sorted(issues.values(), key=lambda i: i.created_at):
            if not issue.is_open:
                continue
            if SIP_LABEL not in issue.labels:
                self.report.actions.append(f"#{issue.number}: add the `sip` label")
                self._write(
                    "POST", f"/issues/{issue.number}/labels", {"labels": [SIP_LABEL]}
                )
                issue.labels.add(SIP_LABEL)
            _, key = parse_title(issue.title)
            if key or is_placeholder_title(issue.title):
                continue
            title = numbered_title(issue.title, next_number)
            self.report.actions.append(f"#{issue.number}: retitle to `{title}`")
            self.report.board_moves.append(
                f"#{issue.number} (SIP-{next_number}): add to the board in "
                f"**{BOARD_COLUMNS['numbered']}** if it isn't there yet"
            )
            self._write("PATCH", f"/issues/{issue.number}", {"title": title})
            self.comment(
                issue,
                "numbered",
                {
                    "number": str(next_number),
                    "title": strip_title(issue.title),
                    "issue_url": issue.html_url,
                    "board_url": BOARD_URL,
                },
            )
            issue.title = title
            next_number += 1

        for key, numbers in sorted(duplicate_numbers(issues.values()).items()):
            refs = ", ".join(f"#{n}" for n in numbers)
            self.report.attention.append(
                f"SIP-{key} is used by more than one issue: {refs}"
            )

    def report_unlabeled_templates(self, issues: dict[int, Issue]) -> None:
        query = (
            'is:open "Rejected Alternatives" "Migration Plan and Compatibility" '
            f"-label:{SIP_LABEL}"
        )
        for raw in self.gh.search_issues(query):
            if "pull_request" not in raw and raw["number"] not in issues:
                self.report.attention.append(
                    f"#{raw['number']} looks like a SIP (template sections) but "
                    f"isn't titled `[SIP] ...`: {raw['title']}"
                )

    @staticmethod
    def _find_vote(
        result: Email, vote_by_thread: dict[str, tuple[Email, int]]
    ) -> Optional[tuple[Email, int]]:
        """The VOTE thread a RESULT email reports on: linked, or same subject."""
        linked = set(THREAD_URL_RE.findall(result.body))
        for thread_id, vote in vote_by_thread.items():
            if thread_id in linked:
                return vote
        subject = classify_subject(result.subject)[2:]
        for vote in reversed(vote_by_thread.values()):
            if classify_subject(vote[0].subject)[2:] == subject:
                return vote
        return None

    def _vote_passed(
        self, number: int, result: Email, label: str, vote_id: str = ""
    ) -> bool:
        """Approve only when the email says so plainly and the model agrees."""
        outcome = result_regex(result.body)
        confirmed = self.model.vote_outcome(result) if self.model else None
        if outcome == "passed" and confirmed == "passed":
            return True
        if outcome == "failed" or confirmed == "failed":
            self.failed_votes.add(vote_id)
            self.report.attention.append(
                f"#{number}: the vote looks like it failed, per {label}"
            )
        else:
            self.report.attention.append(
                f"#{number}: couldn't confirm the outcome of {label}"
            )
        return False

    def advance_stages(self, issues: dict[int, Issue], emails: list[Email]) -> None:
        evidence = self._collect_evidence(issues, emails)
        for number, stages in sorted(evidence.items()):
            issue = issues[number]
            target = max(stages)
            if not issue.is_open:
                continue
            have = current_stage(issue.labels)
            if target < have:
                continue
            if target == have:
                # An open SIP already labelled approved means an earlier run
                # failed after labelling; retry the comment and the close
                # unless the approved comment is already there.
                if STAGES[target] != "approved":
                    continue
                if self.closed_before(issue):
                    continue  # already closed once; a reopen is deliberate
                self.move(issue, target, stages, relabel=False)
                continue
            if STAGES[target] == "approved" and self.closed_before(issue):
                continue  # closed as approved once; a reopen is deliberate
            self.move(issue, target, stages)

    @staticmethod
    def _unrelated_thread(
        email: Email, number: Optional[int], issues: dict[int, Issue]
    ) -> bool:
        """A non-SIP thread that merely links an issue or is not about the match."""
        if "SIP" in email.subject.upper():
            return False
        if number is None:
            return True  # a non-SIP thread that links no SIP issue
        return (
            similarity(
                classify_subject(email.subject)[3], strip_title(issues[number].title)
            )
            < STRONG_SIMILARITY
        )

    def _drop_failed_approvals(
        self, evidence: dict[int, dict[int, tuple[Email, Optional[Email]]]]
    ) -> None:
        """A vote reported as failed is never approved, whatever RESULT order."""
        approved = STAGES.index("approved")
        for number, stages in list(evidence.items()):
            entry = stages.get(approved)
            if entry and entry[1] and entry[1].id in self.failed_votes:
                self.report.attention.append(
                    f"#{number}: a RESULT reported this vote as failed; not approved"
                )
                del stages[approved]
                if not stages:
                    del evidence[number]

    def _collect_evidence(
        self, issues: dict[int, Issue], emails: list[Email]
    ) -> dict[int, dict[int, tuple[Email, Optional[Email]]]]:
        ask = self.model.pick_issue if self.model else None
        # issue number -> stage index -> (email, vote email for results)
        evidence: dict[int, dict[int, tuple[Email, Optional[Email]]]] = {}
        vote_by_thread: dict[str, tuple[Email, int]] = {}

        for email in emails:
            kind = classify_subject(email.subject)[0]
            label = f"`{email.subject}` ({email.url})"
            vote = self._find_vote(email, vote_by_thread) if kind == "RESULT" else None
            match = match_email(email, issues, ask)
            if vote and match.issue not in (None, vote[1]):
                self.report.attention.append(
                    f"{label}: result matched #{match.issue} but its vote matched "
                    f"#{vote[1]}; skipped"
                )
                continue
            number = (
                match.issue if match.issue is not None else (vote[1] if vote else None)
            )
            how = match.how if match.issue is not None else "its vote thread"
            if self._unrelated_thread(email, number, issues):
                continue  # a non-SIP thread that is not about any SIP
            if number is None:
                cands = ", ".join(f"#{n}" for n in match.candidates) or "none"
                self.report.attention.append(
                    f"{label}: not matched ({match.how}; candidates: {cands})"
                )
                continue
            self.report.matched.append(f"{label} -> #{number} ({how})")
            if kind == "VOTE":
                vote_by_thread[email.id] = (email, number)
            if not issues[number].is_open:
                continue  # nothing left to change on a closed SIP
            if kind == "RESULT":
                if vote is None:
                    self.report.attention.append(
                        f"#{number}: {label} has no matching VOTE thread; not approved"
                    )
                    continue
                if not self._vote_passed(number, email, label, vote[0].id):
                    continue
                stage = STAGES.index("approved")
            else:
                stage = STAGES.index("voting" if kind == "VOTE" else "in-discussion")
            evidence.setdefault(number, {})[stage] = (email, vote[0] if vote else None)

        self._drop_failed_approvals(evidence)
        return evidence

    def move(
        self,
        issue: Issue,
        target: int,
        stages: dict[int, tuple[Email, Optional[Email]]],
        relabel: bool = True,
    ) -> None:
        stage = STAGES[target]
        email, vote = stages[target]
        discuss = stages.get(0, (None, None))[0]
        vote_email = vote or stages.get(1, (None, None))[0]
        label = STAGE_LABELS[stage]
        if relabel:
            self.report.actions.append(f"#{issue.number}: label `{label}`")
            for other in STAGE_LABELS.values():
                if other != label and other in issue.labels:
                    self.report.actions.append(f"#{issue.number}: remove `{other}`")
                    self._write(
                        "DELETE",
                        f"/issues/{issue.number}/labels/{urllib.parse.quote(other)}",
                    )
            self._write("POST", f"/issues/{issue.number}/labels", {"labels": [label]})
            self.report.board_moves.append(
                f"#{issue.number}: move to **{BOARD_COLUMNS[stage]}**"
            )
        values = {
            "number": parse_title(issue.title)[1],
            "title": strip_title(issue.title),
            "issue_url": issue.html_url,
            "board_url": BOARD_URL,
            "discuss_url": discuss.url if discuss else None,
            "vote_url": vote_email.url if vote_email else None,
            "result_url": email.url if stage == "approved" else None,
        }
        recent = self.now - email.epoch < COMMENT_WINDOW_DAYS * 86400
        if stage == "approved":
            self.report.actions.append(f"#{issue.number}: close as completed")
            self._write(
                "PATCH",
                f"/issues/{issue.number}",
                {"state": "closed", "state_reason": "completed"},
            )
            self.comment(issue, stage, values)
        elif recent:
            self.comment(issue, stage, values)

    def label_in_development(self) -> None:
        for raw in self.gh.search_issues(f'label:"{STAGE_LABELS["approved"]}"'):
            issue = to_issue(raw)
            if DEV_LABEL in issue.labels:
                continue
            events = self.gh.paginate(
                f"/repos/{self.gh.repo}/issues/{issue.number}/timeline?per_page=100"
            )
            prs = sorted(
                {
                    e["source"]["issue"]["number"]
                    for e in events
                    if e.get("event") == "cross-referenced"
                    and e.get("source", {}).get("issue", {}).get("pull_request")
                    and e["source"]["issue"]
                    .get("repository_url", "")
                    .endswith(f"/{self.gh.repo}")
                }
            )
            if not prs:
                continue
            refs = ", ".join(f"#{n}" for n in prs)
            self.report.actions.append(
                f"#{issue.number}: label `{DEV_LABEL}` (referenced by {refs})"
            )
            self.report.board_moves.append(
                f"#{issue.number}: move to **{BOARD_COLUMNS['in-development']}**"
            )
            self._write(
                "POST", f"/issues/{issue.number}/labels", {"labels": [DEV_LABEL]}
            )

    def run(self) -> str:
        self.ensure_labels()
        issues = self.collect_issues()
        self.number_and_label(issues)
        self.report_unlabeled_templates(issues)
        self.advance_stages(issues, fetch_archive())
        self.label_in_development()
        if not self.model:
            self.report.attention.append(
                "LLMAO_KEY is not set: ambiguous threads and vote results were "
                "skipped rather than checked with the model"
            )
        return self.report.render()


def main() -> int:
    live = os.environ.get("SIP_STEWARD_LIVE", "").strip().lower() == "true"
    gh = GitHub(
        os.environ.get("GITHUB_TOKEN", ""),
        os.environ.get("GITHUB_REPOSITORY", "apache/superset"),
    )
    key = os.environ.get("LLMAO_KEY", "")
    model = Model(key, os.environ.get("LLMAO_MODEL") or DEFAULT_MODEL) if key else None
    comments = parse_comments(COMMENTS_PATH.read_text(encoding="utf-8"))
    steward = Steward(gh, model, live, comments)
    try:
        steward.run()
    finally:
        # A failed write mid-run must not lose the record of earlier moves.
        report = steward.report.render()
        print(report)
        if summary := os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(summary, "a", encoding="utf-8") as fh:
                fh.write(report + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
