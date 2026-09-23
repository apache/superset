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

"""Cross-platform Python port of ``po2json.sh``.

Compiles ``superset/translations/**/*.po`` into sibling ``.json`` files for
the frontend (``po2json``), then formats the generated JSON with ``oxfmt`` --
the same two steps ``po2json.sh`` performed, in the same order.

Each tool is invoked as ``node <package's own bin entry point>``, resolved
from the package's own ``package.json`` "bin" field, rather than through the
platform-specific ``node_modules/.bin`` wrapper (a symlink on POSIX, a
``.cmd``/``.ps1`` shim on Windows). ``node`` is a real executable on every
platform, so this never goes through ``cmd.exe`` the way invoking a ``.cmd``
wrapper does (even with ``subprocess``'s ``shell=False``) -- so there is no
shell-metacharacter or ``%VAR%``-expansion surface to defend against here.

Usage:
    python scripts/translations/compile_po.py
"""

from __future__ import annotations

import glob
import json  # noqa: TID251 - standalone script, not the Flask app
import os
import shutil
import subprocess
import sys

ROOT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
)
FRONTEND_DIR = os.path.join(ROOT_DIR, "superset-frontend")
TRANSLATIONS_DIR = os.path.join(ROOT_DIR, "superset", "translations")


def resolve_node_entry(package: str) -> str | None:
    """Resolve an installed npm package's CLI entry point.

    Reads the entry path out of the package's own ``package.json`` "bin"
    field instead of guessing at the ``node_modules/.bin`` wrapper's shape,
    so the result can always be run via ``node <entry>`` directly.
    """
    pkg_dir = os.path.join(FRONTEND_DIR, "node_modules", package)
    manifest_path = os.path.join(pkg_dir, "package.json")
    if not os.path.isfile(manifest_path):
        return None
    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)
    bin_field = manifest.get("bin")
    rel_entry = bin_field.get(package) if isinstance(bin_field, dict) else bin_field
    if not rel_entry:
        return None
    entry_path = os.path.join(pkg_dir, rel_entry)
    return entry_path if os.path.isfile(entry_path) else None


def run(command: list[str]) -> int:
    """Run a command directly, with no shell involved, and return its exit
    code.

    ``NODE_NO_WARNINGS=1`` keeps node's own warnings (experimental-feature
    notices and the like) out of the build log, as po2json.sh did.
    """
    env = {**os.environ, "NODE_NO_WARNINGS": "1"}
    return subprocess.run(command, check=False, env=env).returncode  # noqa: S603


def convert_po_to_json(node_bin: str, po2json_entry: str, po_file: str) -> str | None:
    """Convert one ``.po`` file to its sibling ``.json`` via ``po2json``.

    Returns the generated ``.json`` path on success, ``None`` on failure.
    """
    json_dest = f"{os.path.splitext(po_file)[0]}.json"
    rc = run(
        [
            node_bin,
            po2json_entry,
            "--domain",
            "superset",
            "--format",
            "jed1.x",
            "--fuzzy",
            po_file,
            json_dest,
        ]
    )
    return json_dest if rc == 0 else None


def main() -> int:
    """Convert every ``.po`` file under ``superset/translations`` to
    ``.json``, then format the generated JSON with ``oxfmt``."""
    node_bin = shutil.which("node")
    if not node_bin:
        print("ERROR: node not found in PATH.", file=sys.stderr)
        return 1

    po2json_entry = resolve_node_entry("po2json")
    oxfmt_entry = resolve_node_entry("oxfmt")
    if not po2json_entry or not oxfmt_entry:
        print(
            "ERROR: po2json/oxfmt not found under "
            f"{FRONTEND_DIR}/node_modules. Run `npm install` in "
            "superset-frontend first.",
            file=sys.stderr,
        )
        return 1

    if not os.path.isdir(TRANSLATIONS_DIR):
        print(
            f"ERROR: translations directory not found: {TRANSLATIONS_DIR}",
            file=sys.stderr,
        )
        return 1

    po_files = sorted(
        glob.glob(os.path.join(TRANSLATIONS_DIR, "**", "*.po"), recursive=True)
    )
    print(f"Converting {len(po_files)} .po file(s) to .json...")
    json_files: list[str] = []
    failed: list[str] = []
    for po_file in po_files:
        json_dest = convert_po_to_json(node_bin, po2json_entry, po_file)
        if json_dest:
            json_files.append(json_dest)
        else:
            failed.append(po_file)
    if failed:
        print(f"ERROR: {len(failed)} file(s) failed conversion:", file=sys.stderr)
        for po_file in failed:
            print(f"  - {po_file}", file=sys.stderr)
        return 1

    if json_files:
        # Format only the files po2json just generated -- not every tracked
        # ``.json`` under TRANSLATIONS_DIR (e.g. the committed
        # empty_language_pack.json, which po2json.sh never touched either).
        # Every generated file here is named messages.json, which
        # "superset/translations/**/messages.json" gitignores; oxfmt >=0.62
        # respects .gitignore even for explicitly-passed paths, so passing
        # only these would otherwise exit non-zero with "All matched files
        # may have been excluded by ignore rules." --no-error-on-unmatched-
        # pattern tolerates that instead of failing (carried over from
        # po2json.sh's identical per-file workaround).
        rc = run(
            [
                node_bin,
                oxfmt_entry,
                "--write",
                "--no-error-on-unmatched-pattern",
                *json_files,
            ]
        )
        if rc != 0:
            print("ERROR: oxfmt step failed.", file=sys.stderr)
            return 1

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
