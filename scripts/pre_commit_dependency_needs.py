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
"""Decides whether pre-commit.yml's frontend/docs dependency installs, and
its pinned Node.js setup, are needed for a given set of changed files.

Every hook that actually needs those installs is already path-gated in
.pre-commit-config.yaml (oxfmt-frontend, oxlint-frontend, custom-rules-frontend,
stylelint-frontend, type-checking-frontend on `superset-frontend/*.{js,jsx,ts,
tsx,css,scss,sass,json}`; oxlint-docs on `docs/*.{js,jsx,ts,tsx}`), so a
changed-file list that matches none of these patterns means npm ci / yarn
install can be skipped without any hook missing its dependencies.

oxfmt-websocket (`superset-websocket/*.{js,ts}`) needs neither install, but
it does run `npx oxfmt`, which needs the pinned Node.js version from the
Setup Node.js step -- so a websocket-only change must still trip
needs_websocket to keep that step from being skipped, even though it
doesn't need needs_frontend/needs_docs.

A previous inline-bash version of this (`printf '%s\\n' "$files" | grep -q
...`) risked a false "not needed" result: under `set -o pipefail`, grep -q's
early exit on a match can SIGPIPE a producer still mid-write for a large
enough list, and that failure surfaces as the `if` condition's own status.
Plain Python reading stdin to EOF has no equivalent early-exit-close
behavior, so it isn't exposed to that failure mode at all.
"""

import os
import re
import sys
from typing import List

# Mirrors the union of oxfmt-frontend/oxlint-frontend/custom-rules-frontend/
# stylelint-frontend/type-checking-frontend's own `files:` patterns (oxfmt
# additionally covers css/scss/sass/json; the rest are js/jsx/ts/tsx only).
FRONTEND_PATTERNS: List[str] = [
    r"^superset-frontend/.*\.(js|jsx|ts|tsx|css|scss|sass|json)$"
]
# Mirrors oxlint-docs's own `files:` pattern exactly. Most docs contributions
# are prose (.md/.mdx), which this correctly treats as not needing the install.
DOCS_PATTERNS: List[str] = [r"^docs/.*\.(js|jsx|ts|tsx)$"]
# Mirrors oxfmt-websocket's own `files:` pattern exactly (JSON excluded there
# too -- see that hook's comment in .pre-commit-config.yaml).
WEBSOCKET_PATTERNS: List[str] = [r"^superset-websocket/.*\.(js|ts)$"]


def _matches_any(files: List[str], patterns: List[str]) -> bool:
    compiled = [re.compile(pattern) for pattern in patterns]
    return any(pattern.match(file) for file in files for pattern in compiled)


def needs_frontend(files: List[str]) -> bool:
    return _matches_any(files, FRONTEND_PATTERNS)


def needs_docs(files: List[str]) -> bool:
    return _matches_any(files, DOCS_PATTERNS)


def needs_websocket(files: List[str]) -> bool:
    return _matches_any(files, WEBSOCKET_PATTERNS)


def main() -> None:
    """Reads newline-separated changed file paths from stdin, writes
    needs_frontend/needs_docs/needs_websocket booleans to $GITHUB_OUTPUT (or
    stdout, for a local/manual run outside CI)."""
    files = [line.strip() for line in sys.stdin if line.strip()]
    lines = [
        f"needs_frontend={'true' if needs_frontend(files) else 'false'}",
        f"needs_docs={'true' if needs_docs(files) else 'false'}",
        f"needs_websocket={'true' if needs_websocket(files) else 'false'}",
    ]
    if output_path := os.getenv("GITHUB_OUTPUT"):
        with open(output_path, "a", encoding="utf-8") as f:
            for line in lines:
                print(line, file=f)
    else:
        for line in lines:
            print(line)


if __name__ == "__main__":
    main()
