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
"""Command line entry point: ``python -m automation.orchestrator <command>``."""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime, timedelta, timezone

from . import dispatch as ops
from .api import Devin, GitHub

REPO = os.environ.get("REPO", "moliyadhaval/superset")
ORG_ID = os.environ.get("DEVIN_ORG_ID", "org-eef03b923043402190c037ffa8141840")
DASHBOARD_ISSUE = int(os.environ.get("DASHBOARD_ISSUE", "18"))


def _require(*names: str) -> None:
    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        sys.exit(f"missing environment variable(s): {', '.join(missing)}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="automation.orchestrator")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("dispatch", help="dispatch one fix session per eligible issue")
    p.add_argument(
        "--prompt-file", required=True, help="file holding the canonical fix prompt"
    )
    p.add_argument("--cap", type=int, default=30)
    p.add_argument("--dry-run", action="store_true")

    p = sub.add_parser(
        "watch-session", help="poll a session; fail unless it produced a PR"
    )
    p.add_argument("session_id")
    p.add_argument("--issue", type=int, required=True)
    p.add_argument("--timeout-minutes", type=int, default=90)
    p.add_argument("--poll-seconds", type=float, default=60)
    p.add_argument(
        "--keep-branch",
        action="store_true",
        help="do not delete the orphan branch on failure",
    )

    p = sub.add_parser(
        "stale-branches", help="list (or delete) fix branches without an open/merged PR"
    )
    p.add_argument("--days", type=int, default=int(os.environ.get("STALE_DAYS", "3")))
    p.add_argument("--delete", action="store_true")
    p.add_argument(
        "--force", action="store_true", help="actually delete branches (safety check)"
    )

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,
    )
    gh = GitHub(REPO)
    devin = Devin(ORG_ID)
    today = datetime.now(timezone.utc).date().isoformat()

    if args.cmd == "dispatch":
        # Dry runs still list Devin sessions to compute "attempt exists".
        _require("GH_TOKEN", "DEVIN_API_KEY")
        with open(args.prompt_file, encoding="utf-8") as fh:
            prompt = fh.read()
        outcomes = ops.dispatch(
            gh, devin, fix_prompt=prompt, cap=args.cap, dry_run=args.dry_run
        )
        table = ops.dashboard_table(outcomes)
        print(table)
        if not args.dry_run:
            ops.ensure_comment(
                gh,
                DASHBOARD_ISSUE,
                f"dispatch:{today}",
                f"### Dispatch run {today}\n\n{table}",
            )
        return 1 if any(o.status == "failed" for o in outcomes) else 0

    if args.cmd == "watch-session":
        _require("GH_TOKEN", "DEVIN_API_KEY")
        ok, detail, confirmed = False, "watch aborted", False
        try:
            ok, detail = ops.watch_session(
                devin,
                args.session_id,
                timeout=timedelta(minutes=args.timeout_minutes),
                poll=args.poll_seconds,
            )
            confirmed = True
        finally:
            verdict = "✅ PR opened" if ok else "❌ Failed"
            line = f"[Issue #{args.issue}] {verdict} - {detail}"
            logging.getLogger("automation").log(
                logging.INFO if ok else logging.ERROR, line
            )
            try:
                ops.ensure_comment(
                    gh, DASHBOARD_ISSUE, f"session:{args.session_id}", line
                )
            except Exception:
                if confirmed:
                    raise
                # Reporting is best-effort; keep the original watch exception.
                logging.getLogger("automation").exception("dashboard update failed")
            finally:
                # Only a confirmed failure (dead/finished-without-PR/timeout)
                # justifies deleting the branch; an aborted watch may leave a
                # session that is still pushing to it.
                if confirmed and not ok and not args.keep_branch:
                    ops.cleanup_branch(gh, args.issue, force=True)
        return 0 if ok else 1

    _require("GH_TOKEN")
    for name, reason in ops.stale_branches(
        gh, timedelta(days=args.days), delete=args.delete, force=args.force
    ):
        action = (
            "deleted"
            if args.delete and args.force
            else "would delete"
            if args.delete
            else "stale"
        )
        print(f"{name}\t{reason}\t{action}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
