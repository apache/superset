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

# This script is a cross-platform Python equivalent of po2json.sh.
# It generates .json files from .po translation files used by the frontend.

import glob
import os
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

_SHELL = os.name == "nt"


def run_command(command: list[str], cwd: str | None = None, timeout: int = 120) -> int:
    try:
        result = subprocess.run(  # noqa: S603
            command, text=True, shell=_SHELL, check=False, cwd=cwd, timeout=timeout
        )
        return result.returncode
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return 1


def find_command(names: list[str]) -> str | None:
    for name in names:
        path = shutil.which(name)
        if path:
            return path
    return None


def install_npm_packages(npm_cmd: str, root_dir: str, packages: list[str]) -> bool:
    rc = run_command(
        [npm_cmd, "install", "--no-save", "--prefer-offline", *packages],
        cwd=root_dir,
    )
    return rc == 0


def convert_po_file(
    po_file: str, frontend_trans_dir: str, po2json_cmd: list[str]
) -> tuple[bool, str, str]:
    locale_rel = os.path.relpath(
        po_file, start=os.path.dirname(os.path.dirname(po_file))
    )
    json_dest = os.path.join(
        frontend_trans_dir, os.path.splitext(locale_rel)[0] + ".json"
    )
    os.makedirs(os.path.dirname(json_dest), exist_ok=True)

    cmd = [
        *po2json_cmd,
        "--domain",
        "superset",
        "--format",
        "jed1.x",
        "--fuzzy",
        po_file,
        json_dest,
    ]
    rc = run_command(cmd, timeout=60)
    if rc != 0:
        return False, po_file, f"po2json failed (rc={rc})"
    return True, po_file, ""


def compile_translations() -> int:
    root_dir = os.path.abspath(
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    )
    translations_dir = os.path.join(root_dir, "superset", "translations")
    frontend_trans_dir = os.path.join(
        root_dir, "superset-frontend", "src", "translations"
    )

    try:
        import babel  # noqa: F401
    except ImportError:
        print("ERROR: Babel is not installed. Run: pip install babel", file=sys.stderr)
        return 1

    npm_cmd = find_command(["npm"])
    npx_cmd = find_command(["npx"])
    if not npm_cmd or not npx_cmd:
        print("ERROR: Node.js/npm/npx not found in PATH.", file=sys.stderr)
        return 1

    if not os.path.isdir(translations_dir):
        print(
            f"ERROR: translations directory not found: {translations_dir}",
            file=sys.stderr,
        )
        return 1

    print("Step 1: Compiling .po files with pybabel...")
    rc = run_command(
        [
            sys.executable,
            "-m",
            "babel.messages.frontend",
            "compile",
            "-d",
            translations_dir,
        ],
        cwd=root_dir,
    )
    if rc != 0:
        print("ERROR: pybabel compile failed.", file=sys.stderr)
        return 1

    node_modules_bin = os.path.join(root_dir, "node_modules", ".bin")
    po2json_bin = os.path.join(node_modules_bin, "po2json")
    prettier_bin = os.path.join(node_modules_bin, "prettier")

    print("Step 2: Installing npm packages (po2json, prettier)...")
    packages_needed = []
    if not os.path.isfile(po2json_bin):
        packages_needed.append("po2json")
    if not os.path.isfile(prettier_bin):
        packages_needed.append("prettier")

    if packages_needed:
        ok = install_npm_packages(npm_cmd, root_dir, packages_needed)
        if not ok:
            print("WARNING: npm install failed, falling back to npx.", file=sys.stderr)

    if os.path.isfile(po2json_bin):
        po2json_cmd: list[str] = [po2json_bin]
    else:
        po2json_cmd = [npx_cmd, "-y", "po2json"]

    if os.path.isfile(prettier_bin):
        prettier_cmd: list[str] | None = [prettier_bin]
    else:
        prettier_cmd = [npx_cmd, "-y", "prettier"] if npx_cmd else None

    po_files = glob.glob(
        os.path.join(translations_dir, "**", "*.po"), recursive=True
    )
    print(f"Step 3: Converting {len(po_files)} .po files to JSON (frontend path)...")

    failures: list[str] = []
    max_workers = min(8, (os.cpu_count() or 1) * 2)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(convert_po_file, f, frontend_trans_dir, po2json_cmd): f
            for f in po_files
        }
        for future in as_completed(futures):
            ok, po_path, err = future.result()
            if not ok:
                print(f"  FAILED: {po_path} — {err}", file=sys.stderr)
                failures.append(po_path)
            else:
                print(f"  OK: {po_path}")

    if failures:
        print(
            f"\nERROR: {len(failures)} file(s) failed conversion:", file=sys.stderr
        )
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1

    json_files = glob.glob(
        os.path.join(frontend_trans_dir, "**", "*.json"), recursive=True
    )
    if json_files and prettier_cmd:
        print(f"Step 4: Running prettier on {len(json_files)} JSON files...")
        rc = run_command(
            [*prettier_cmd, "--write", *json_files], cwd=root_dir, timeout=300
        )
        if rc != 0:
            print("WARNING: prettier step failed.", file=sys.stderr)

    print("\nPipeline completed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(compile_translations())
