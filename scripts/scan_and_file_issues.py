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
"""Audit Superset's real dependency lockfiles and file a GitHub issue per finding.

This script runs ``pip-audit`` against the repository's *real* pinned
requirements lockfiles (``requirements/*.txt``), parses the JSON report, and
files one idempotent GitHub issue per actionable vulnerability so that a
downstream remediation orchestrator can pick them up.

Nothing here is synthetic: the manifests audited are the ones already committed
to the repository, and the findings come straight from the Python advisory
databases via ``pip-audit`` and OSV.

Triage rules
------------
* A finding is *actionable* when ``pip-audit`` reports at least one concrete
  ``fix_versions`` entry. Actionable findings are filed under the
  ``devin-remediate`` label -- the queue the orchestrator consumes.
* Findings with no available fix are filed under ``no-fix-available`` (so they
  remain visible) but are kept out of the remediation queue.
* Severity is enriched from the OSV API and used both to drop low-severity
  noise (``SCAN_MIN_SEVERITY``) and to sort the most severe, clearly-fixable
  findings first before applying the volume cap (``SCAN_MAX_ISSUES``).

Environment variables
----------------------
``GITHUB_TOKEN`` (required)
    Token used to authenticate against the GitHub REST API.
``GITHUB_REPOSITORY`` (required)
    Target repository in ``owner/name`` form (provided automatically by GitHub
    Actions).
``SCAN_MANIFESTS`` (default ``requirements/base.txt``)
    Comma-separated list of requirements lockfiles to audit, relative to the
    repository root.
``SCAN_MAX_ISSUES`` (default ``25``)
    Maximum number of *actionable* issues to file per run. Sorting puts the
    most severe findings first, so the cap drops the least severe overflow.
``SCAN_MIN_SEVERITY`` (default ``LOW``)
    Minimum severity to consider. One of ``LOW``, ``MODERATE``/``MEDIUM``,
    ``HIGH``, ``CRITICAL``.
``SCAN_INCLUDE_NO_FIX`` (default ``true``)
    When truthy, also file ``no-fix-available`` issues for findings without a
    fix. Set to ``false`` to ignore them entirely.
``SCAN_DRY_RUN`` (default ``false``)
    When truthy, do everything except creating labels/issues (prints what would
    be filed). Useful for local testing without a write token.
"""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final

import requests

logger = logging.getLogger("scan_and_file_issues")

REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[1]

REMEDIATE_LABEL: Final[str] = "devin-remediate"
NO_FIX_LABEL: Final[str] = "no-fix-available"

DEFAULT_MANIFESTS: Final[tuple[str, ...]] = ("requirements/base.txt",)
DEFAULT_MAX_ISSUES: Final[int] = 25
DEFAULT_MIN_SEVERITY: Final[str] = "LOW"

OSV_API_URL: Final[str] = "https://api.osv.dev/v1/vulns/{vuln_id}"
GITHUB_API_URL: Final[str] = "https://api.github.com"
HTTP_TIMEOUT: Final[float] = 30.0

# Higher rank == more severe. ``MEDIUM`` and ``MODERATE`` are treated as equal
# because NVD and GitHub use different labels for the same band.
SEVERITY_RANK: Final[dict[str, int]] = {
    "CRITICAL": 4,
    "HIGH": 3,
    "MODERATE": 2,
    "MEDIUM": 2,
    "LOW": 1,
    "UNKNOWN": 0,
}

# Only keep fully-pinned ``name==version`` requirement lines. Editable installs
# (``-e ./superset-core``), VCS URLs and unpinned entries are dropped because
# pip-audit would otherwise try to build them, which needs source/system deps.
PINNED_LINE_RE: Final[re.Pattern[str]] = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9._-]*(\[[A-Za-z0-9,._-]+\])?==\S+",
)


@dataclass
class Finding:
    """A single vulnerability affecting one pinned dependency."""

    package: str
    current_version: str
    vuln_id: str
    manifest_path: str
    aliases: list[str] = field(default_factory=list)
    fix_versions: list[str] = field(default_factory=list)
    description: str = ""
    severity: str = "UNKNOWN"
    advisory_url: str = ""

    @property
    def fixed_version(self) -> str | None:
        """Return the lowest available fix version, or ``None`` if unfixable."""
        if not self.fix_versions:
            return None
        return min(self.fix_versions, key=_version_key)

    @property
    def is_actionable(self) -> bool:
        """True when a concrete fix version exists and can be remediated."""
        return self.fixed_version is not None

    @property
    def dedupe_key(self) -> tuple[str, str]:
        """Stable identity used to collapse duplicate hits across manifests."""
        return (self.package.lower(), self.vuln_id)

    @property
    def severity_rank(self) -> int:
        """Numeric severity used for sorting and threshold comparisons."""
        return SEVERITY_RANK.get(self.severity.upper(), 0)

    @property
    def label(self) -> str:
        """The triage label this finding should be filed under."""
        return REMEDIATE_LABEL if self.is_actionable else NO_FIX_LABEL

    @property
    def title(self) -> str:
        """Stable, unique issue title used as the idempotency key."""
        return f"[{self.label}] {self.package} {self.vuln_id}"


def _version_key(version: str) -> tuple[int | str, ...]:
    """Build a sortable key from a version string without external deps.

    Numeric segments are compared numerically and non-numeric segments
    lexically, which is good enough to pick the lowest fix version among the
    candidates pip-audit reports.
    """
    parts: list[int | str] = []
    for chunk in re.split(r"[.\-+]", version):
        parts.append(int(chunk) if chunk.isdigit() else chunk)
    return tuple(parts)


def _env_flag(name: str, default: bool) -> bool:
    """Parse a boolean-ish environment variable."""
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def read_pinned_requirements(manifest: Path) -> list[str]:
    """Return only the fully-pinned ``name==version`` lines from a lockfile."""
    lines: list[str] = []
    for raw in manifest.read_text(encoding="utf-8").splitlines():
        stripped = raw.strip()
        if PINNED_LINE_RE.match(stripped):
            # Drop inline comments / hashes appended after the spec.
            lines.append(stripped.split(" ")[0].split(";")[0].strip())
    return lines


def run_pip_audit(manifest: Path) -> dict[str, Any]:
    """Run ``pip-audit`` against the pinned subset of ``manifest``.

    pip-audit exits non-zero when it finds vulnerabilities, which is *not* an
    error for us. We therefore key success off whether a parseable JSON report
    was produced rather than off the exit code, and only raise when the tool
    genuinely failed (e.g. could not resolve a package).
    """
    pinned = read_pinned_requirements(manifest)
    if not pinned:
        raise RuntimeError(f"No pinned requirements found in {manifest}")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_req = Path(tmp) / "pinned.txt"
        tmp_req.write_text("\n".join(pinned) + "\n", encoding="utf-8")
        report_path = Path(tmp) / "report.json"

        cmd = [
            sys.executable,
            "-m",
            "pip_audit",
            "--requirement",
            str(tmp_req),
            "--no-deps",
            "--format",
            "json",
            "--output",
            str(report_path),
        ]
        logger.info("Auditing %s (%d pinned packages)", manifest, len(pinned))
        result = subprocess.run(  # noqa: S603 - args are fully controlled
            cmd,
            capture_output=True,
            text=True,
            check=False,
        )

        if not report_path.exists():
            raise RuntimeError(
                f"pip-audit produced no report for {manifest} "
                f"(exit {result.returncode}):\n{result.stderr.strip()}"
            )
        return json.loads(report_path.read_text(encoding="utf-8"))


def parse_findings(report: dict[str, Any], manifest_path: str) -> list[Finding]:
    """Translate a pip-audit JSON report into :class:`Finding` objects."""
    findings: list[Finding] = []
    for dep in report.get("dependencies", []):
        name = dep.get("name", "")
        version = dep.get("version", "")
        for vuln in dep.get("vulns", []):
            findings.append(
                Finding(
                    package=name,
                    current_version=version,
                    vuln_id=vuln.get("id", ""),
                    manifest_path=manifest_path,
                    aliases=list(vuln.get("aliases", [])),
                    fix_versions=list(vuln.get("fix_versions", [])),
                    description=(vuln.get("description") or "").strip(),
                )
            )
    return findings


def _qualitative_from_cvss(vector: str) -> str:
    """Map a CVSS v3.x base score (computed from ``vector``) to a band.

    Only CVSS v3.x is computed here; for any other version we return
    ``UNKNOWN`` and rely on the qualitative GitHub severity instead.
    """
    if not vector.startswith("CVSS:3"):
        return "UNKNOWN"
    metrics = dict(part.split(":", 1) for part in vector.split("/")[1:] if ":" in part)
    weights = {
        "AV": {"N": 0.85, "A": 0.62, "L": 0.55, "P": 0.2},
        "AC": {"L": 0.77, "H": 0.44},
        "PR": {"N": 0.85, "L": 0.62, "H": 0.27},
        "UI": {"N": 0.85, "R": 0.62},
        "C": {"H": 0.56, "L": 0.22, "N": 0.0},
        "I": {"H": 0.56, "L": 0.22, "N": 0.0},
        "A": {"H": 0.56, "L": 0.22, "N": 0.0},
    }
    try:
        # PR weight differs when scope is changed.
        if metrics.get("S") == "C" and metrics.get("PR") in {"L", "H"}:
            weights["PR"] = {"N": 0.85, "L": 0.68, "H": 0.5}
        iss = 1 - (
            (1 - weights["C"][metrics["C"]])
            * (1 - weights["I"][metrics["I"]])
            * (1 - weights["A"][metrics["A"]])
        )
        impact = (
            7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15
            if metrics.get("S") == "C"
            else 6.42 * iss
        )
        exploitability = (
            8.22
            * weights["AV"][metrics["AV"]]
            * weights["AC"][metrics["AC"]]
            * weights["PR"][metrics["PR"]]
            * weights["UI"][metrics["UI"]]
        )
        if impact <= 0:
            score = 0.0
        elif metrics.get("S") == "C":
            score = min(1.08 * (impact + exploitability), 10.0)
        else:
            score = min(impact + exploitability, 10.0)
        score = round(score + 0.0999999, 1)  # CVSS round-up to one decimal.
    except (KeyError, ValueError):
        return "UNKNOWN"

    if score == 0:
        return "UNKNOWN"
    if score < 4.0:
        return "LOW"
    if score < 7.0:
        return "MEDIUM"
    if score < 9.0:
        return "HIGH"
    return "CRITICAL"


def _advisory_url(advisory_id: str) -> str:
    """Return a canonical human advisory URL for a CVE/GHSA/other id."""
    if advisory_id.startswith("GHSA-"):
        return f"https://github.com/advisories/{advisory_id}"
    if advisory_id.startswith("CVE-"):
        return f"https://nvd.nist.gov/vuln/detail/{advisory_id}"
    return f"https://osv.dev/vulnerability/{advisory_id}"


def enrich_severity(finding: Finding, session: requests.Session) -> None:
    """Populate ``severity`` and ``advisory_url`` from the OSV database.

    The advisory id sometimes 404s (e.g. freshly minted CVEs) while its GHSA
    alias resolves, and a CVE record may resolve yet carry no qualitative
    severity that only its GHSA alias provides. Every known id is therefore
    tried in turn: the first resolving record fixes the advisory link, but the
    search continues until a concrete severity is found. GitHub-reviewed
    advisories expose a clean qualitative severity; otherwise we fall back to a
    CVSS v3 computation from the vector string.
    """
    for candidate in [finding.vuln_id, *finding.aliases]:
        if not candidate:
            continue
        try:
            resp = session.get(
                OSV_API_URL.format(vuln_id=candidate),
                timeout=HTTP_TIMEOUT,
            )
        except requests.RequestException as exc:
            logger.debug("OSV lookup failed for %s: %s", candidate, exc)
            continue
        if resp.status_code != 200:
            continue

        if not finding.advisory_url:
            finding.advisory_url = _advisory_url(candidate)

        data = resp.json()
        qualitative = (data.get("database_specific", {}).get("severity") or "").upper()
        if qualitative in SEVERITY_RANK and qualitative != "UNKNOWN":
            finding.severity = qualitative
            return
        for entry in data.get("severity", []):
            band = _qualitative_from_cvss(entry.get("score", ""))
            if band != "UNKNOWN":
                finding.severity = band
                return


def build_issue_body(finding: Finding) -> str:
    """Render the human-readable + machine-readable issue body."""
    machine = {
        "package": finding.package,
        "current_version": finding.current_version,
        "fixed_version": finding.fixed_version,
        "vuln_id": finding.vuln_id,
        "manifest_path": finding.manifest_path,
    }
    fixed = finding.fixed_version or "_no fix available_"
    aliases = ", ".join(finding.aliases) if finding.aliases else "—"
    advisory = (
        f"[{finding.vuln_id}]({finding.advisory_url})"
        if finding.advisory_url
        else finding.vuln_id
    )
    description = finding.description or "_No description provided by advisory._"

    return f"""## Dependency vulnerability detected

This issue was filed automatically by `scripts/scan_and_file_issues.py`, which
audits Superset's **real** pinned dependency lockfiles with `pip-audit`. It is
not a synthetic or planted finding.

| Field | Value |
| --- | --- |
| Package | `{finding.package}` |
| Installed (vulnerable) version | `{finding.current_version}` |
| Fixed version | `{fixed}` |
| Severity | `{finding.severity}` |
| Advisory | {advisory} |
| Aliases | {aliases} |
| Manifest | `{finding.manifest_path}` |

### Advisory summary

{description}

### Remediation

Bump `{finding.package}` from `{finding.current_version}` to at least
`{fixed}` in `{finding.manifest_path}` (and any constraint/`.in` source it is
compiled from), then re-run the lockfile compilation.

<!-- Machine-readable payload for the remediation orchestrator. Do not edit. -->
```json
{json.dumps(machine, indent=2)}
```
"""


class GitHubClient:
    """Thin GitHub REST client for labels and issues."""

    def __init__(self, token: str, repo: str, session: requests.Session) -> None:
        self._repo = repo
        self._session = session
        self._base = f"{GITHUB_API_URL}/repos/{repo}"
        self._session.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            }
        )

    def ensure_label(self, name: str, color: str, description: str) -> None:
        """Create the label if it does not already exist."""
        resp = self._session.get(f"{self._base}/labels/{name}", timeout=HTTP_TIMEOUT)
        if resp.status_code == 200:
            return
        if resp.status_code != 404:
            resp.raise_for_status()
        created = self._session.post(
            f"{self._base}/labels",
            json={"name": name, "color": color, "description": description},
            timeout=HTTP_TIMEOUT,
        )
        # 422 == already exists due to a race; treat as success.
        if created.status_code not in (201, 422):
            created.raise_for_status()
        logger.info("Ensured label %s", name)

    def existing_open_issue_titles(self, labels: list[str]) -> set[str]:
        """Return titles of open issues carrying any of ``labels``."""
        titles: set[str] = set()
        for label in labels:
            page = 1
            while True:
                resp = self._session.get(
                    f"{self._base}/issues",
                    params={
                        "state": "open",
                        "labels": label,
                        "per_page": 100,
                        "page": page,
                    },
                    timeout=HTTP_TIMEOUT,
                )
                resp.raise_for_status()
                batch = resp.json()
                if not batch:
                    break
                # The issues endpoint also returns PRs; ignore those.
                titles.update(
                    item["title"] for item in batch if "pull_request" not in item
                )
                if len(batch) < 100:
                    break
                page += 1
        return titles

    def create_issue(self, title: str, body: str, labels: list[str]) -> str:
        """Create an issue and return its HTML URL."""
        resp = self._session.post(
            f"{self._base}/issues",
            json={"title": title, "body": body, "labels": labels},
            timeout=HTTP_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()["html_url"]


def collect_findings(manifests: list[str]) -> list[Finding]:
    """Audit every manifest and return de-duplicated findings."""
    by_key: dict[tuple[str, str], Finding] = {}
    for rel_path in manifests:
        manifest = (REPO_ROOT / rel_path).resolve()
        if not manifest.is_file():
            logger.warning("Manifest not found, skipping: %s", rel_path)
            continue
        try:
            report = run_pip_audit(manifest)
        except (RuntimeError, json.JSONDecodeError) as exc:
            # A single unresolvable manifest must not abort the whole run.
            logger.error("Skipping %s: %s", rel_path, exc)
            continue
        for finding in parse_findings(report, rel_path):
            by_key.setdefault(finding.dedupe_key, finding)
    return list(by_key.values())


def select_findings(
    findings: list[Finding],
    *,
    min_severity: str,
    max_issues: int,
    include_no_fix: bool,
) -> list[Finding]:
    """Apply severity filtering, sorting and the volume cap.

    Actionable findings are sorted most-severe-first and capped at
    ``max_issues``. No-fix findings (when included) are appended afterwards and
    are not subject to the cap, since they are informational only.
    """
    threshold = SEVERITY_RANK.get(min_severity.upper(), 0)
    eligible = [f for f in findings if f.severity_rank >= threshold]

    def sort_key(finding: Finding) -> tuple[int, str]:
        return (-finding.severity_rank, finding.vuln_id)

    actionable = sorted((f for f in eligible if f.is_actionable), key=sort_key)[
        :max_issues
    ]

    selected = list(actionable)
    if include_no_fix:
        selected.extend(
            sorted((f for f in eligible if not f.is_actionable), key=sort_key)
        )
    return selected


def file_issues(
    client: GitHubClient,
    findings: list[Finding],
    *,
    dry_run: bool,
) -> None:
    """Ensure labels exist and create one issue per new finding."""
    if not findings:
        logger.info("No findings to file.")
        return

    if not dry_run:
        client.ensure_label(
            REMEDIATE_LABEL,
            color="b60205",
            description="Actionable dependency vuln with an available fix.",
        )
        if any(not f.is_actionable for f in findings):
            client.ensure_label(
                NO_FIX_LABEL,
                color="fbca04",
                description="Dependency vuln with no fix available yet.",
            )

    existing = (
        set()
        if dry_run
        else client.existing_open_issue_titles([REMEDIATE_LABEL, NO_FIX_LABEL])
    )

    created = skipped = 0
    for finding in findings:
        if finding.title in existing:
            logger.info("Skip existing issue: %s", finding.title)
            skipped += 1
            continue
        if dry_run:
            logger.info("[dry-run] Would file: %s", finding.title)
            created += 1
            continue
        url = client.create_issue(
            finding.title, build_issue_body(finding), [finding.label]
        )
        logger.info("Filed %s -> %s", finding.title, url)
        created += 1

    logger.info(
        "Done. filed/queued=%d, skipped_existing=%d, total_considered=%d",
        created,
        skipped,
        len(findings),
    )


def main() -> int:
    """Entry point: audit manifests and file issues. Returns an exit code."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    token = os.environ.get("GITHUB_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY")
    dry_run = _env_flag("SCAN_DRY_RUN", default=False)

    if not repo:
        logger.error("GITHUB_REPOSITORY is required (owner/name).")
        return 2
    if not token and not dry_run:
        logger.error("GITHUB_TOKEN is required unless SCAN_DRY_RUN is set.")
        return 2

    manifests = [
        m.strip()
        for m in os.environ.get("SCAN_MANIFESTS", ",".join(DEFAULT_MANIFESTS)).split(
            ","
        )
        if m.strip()
    ]
    max_issues = int(os.environ.get("SCAN_MAX_ISSUES", str(DEFAULT_MAX_ISSUES)))
    min_severity = os.environ.get("SCAN_MIN_SEVERITY", DEFAULT_MIN_SEVERITY)
    include_no_fix = _env_flag("SCAN_INCLUDE_NO_FIX", default=True)

    logger.info(
        "Scanning %s (max=%d, min_severity=%s, include_no_fix=%s, dry_run=%s)",
        manifests,
        max_issues,
        min_severity,
        include_no_fix,
        dry_run,
    )

    findings = collect_findings(manifests)
    if not findings:
        logger.info("pip-audit reported no vulnerabilities. Nothing to file.")
        return 0
    logger.info("pip-audit reported %d raw finding(s).", len(findings))

    with requests.Session() as session:
        for finding in findings:
            enrich_severity(finding, session)

        selected = select_findings(
            findings,
            min_severity=min_severity,
            max_issues=max_issues,
            include_no_fix=include_no_fix,
        )
        logger.info("%d finding(s) selected after triage/severity/cap.", len(selected))

        client = GitHubClient(token or "", repo, session)
        file_issues(client, selected, dry_run=dry_run)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
